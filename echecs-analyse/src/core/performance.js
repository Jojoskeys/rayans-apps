'use strict';
/**
 * Elo de performance calculé sur les résultats (pas sur la précision).
 * Modèle Elo logistique : E(R) = 1 / (1 + 10^((Rᵢ − R) / 400)), où Rᵢ est le classement Chess.com de
 * l'adversaire au moment de la partie. Un gain vaut 1, une nulle 0,5, une perte 0.
 * - Estimation : maximum de vraisemblance, log L(R) = Σ sᵢ ln Eᵢ(R) + (1 − sᵢ) ln(1 − Eᵢ(R)).
 *   Le maximum vérifie Σ Eᵢ(R) = Σ sᵢ : R est le classement pour lequel le score attendu égale le score obtenu.
 * - Intervalle de confiance à 95 % par rapport de vraisemblance : les R tels que
 *   log L(R) ≥ log L(R̂) − 1,920729 (moitié du quantile 0,95 du χ² à 1 degré de liberté).
 * - Score de 100 % (ou 0 %) : le maximum est infini ; seule la borne basse (ou haute) est donnée,
 *   obtenue avec la même règle (log L(R) ≥ −1,920729, le supremum valant 0).
 * Fonctions pures, testées dans test/unit/performance.test.js.
 */

const LR_HALF_CHI2_95 = 1.920729; // 3,841459 / 2
const SPAN = 4000; // marge de recherche autour des classements adverses

function expected(r, opp) {
  return 1 / (1 + Math.pow(10, (opp - r) / 400));
}

function logLik(r, games) {
  let ll = 0;
  for (const g of games) {
    // ln(E) et ln(1 − E) calculés de façon stable : ln E = −ln(1 + 10^((opp − r)/400)).
    const x = ((g.opp - r) / 400) * Math.LN10;
    const lnE = -softplus(x);
    const ln1mE = -softplus(-x);
    if (g.score > 0) ll += g.score * lnE;
    if (g.score < 1) ll += (1 - g.score) * ln1mE;
  }
  return ll;
}

function softplus(x) { // ln(1 + e^x) sans dépassement
  return x > 0 ? x + Math.log1p(Math.exp(-x)) : Math.log1p(Math.exp(x));
}

/** Recherche par dichotomie d'une racine de f croissante ou décroissante sur [lo, hi]. */
function bisect(f, lo, hi, iter = 100) {
  let flo = f(lo);
  for (let i = 0; i < iter && hi - lo > 1e-7; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * @param {{opp:number, score:number}[]} games  adversaire (classement) et score (1, 0,5 ou 0)
 * @returns {{n, score, wins, draws, losses, meanOpp, perf, low, high, se, bound}}
 *   perf/low/high : null si aucune partie ; bound = 'haut' (score 100 %, pas de borne haute),
 *   'bas' (score 0 %, pas de borne basse) ou null.
 */
function performanceRating(games) {
  const gs = games.filter((g) => Number.isFinite(g.opp) && (g.score === 0 || g.score === 0.5 || g.score === 1));
  const n = gs.length;
  const out = { n, score: 0, wins: 0, draws: 0, losses: 0, meanOpp: null, perf: null, low: null, high: null, se: null, bound: null };
  if (!n) return out;
  let total = 0; let sumOpp = 0; let minOpp = Infinity; let maxOpp = -Infinity;
  for (const g of gs) {
    total += g.score; sumOpp += g.opp;
    if (g.score === 1) out.wins++; else if (g.score === 0) out.losses++; else out.draws++;
    minOpp = Math.min(minOpp, g.opp); maxOpp = Math.max(maxOpp, g.opp);
  }
  out.score = total / n;
  out.meanOpp = sumOpp / n;
  const lo = minOpp - SPAN; const hi = maxOpp + SPAN;
  if (total === n || total === 0) {
    // Vraisemblance monotone : supremum 0 (atteint à l'infini).
    const f = (r) => logLik(r, gs) + LR_HALF_CHI2_95;
    if (total === n) { out.bound = 'haut'; out.low = bisect(f, lo, hi); } else { out.bound = 'bas'; out.high = bisect(f, lo, hi); }
    return out;
  }
  const score = (r) => gs.reduce((a, g) => a + expected(r, g.opp), 0) - total; // croissante en r
  const perf = bisect(score, lo, hi);
  const llMax = logLik(perf, gs);
  const f = (r) => logLik(r, gs) - llMax + LR_HALF_CHI2_95;
  out.perf = perf;
  out.low = bisect(f, lo, perf);
  out.high = bisect(f, perf, hi);
  // Erreur type (Wald), pour information : 1 / √(Σ E(1−E)) × 400 / ln 10.
  const info = gs.reduce((a, g) => { const e = expected(perf, g.opp); return a + e * (1 - e); }, 0);
  out.se = info > 0 ? 400 / Math.LN10 / Math.sqrt(info) : null;
  return out;
}

/**
 * Convertit une partie de l'historique en point de vue du joueur `me`.
 * Renvoie null si le joueur n'est pas dans la partie ou si le classement adverse manque.
 */
function gameRecord(g, me) {
  const m = String(me || '').toLowerCase();
  const isW = g.white && g.white.username && g.white.username.toLowerCase() === m;
  const isB = g.black && g.black.username && g.black.username.toLowerCase() === m;
  if (!isW && !isB) return null;
  const mine = isW ? g.white : g.black;
  const opp = isW ? g.black : g.white;
  let score = 0.5;
  if (g.result === '1-0') score = isW ? 1 : 0;
  else if (g.result === '0-1') score = isW ? 0 : 1;
  else if (g.result !== '1/2-1/2') return null;
  return {
    id: g.id, endTime: g.endTime || null, timeClass: g.timeClass || null, rated: !!g.rated,
    color: isW ? 'w' : 'b', score, opp: typeof opp.rating === 'number' ? opp.rating : NaN,
    myRating: typeof mine.rating === 'number' ? mine.rating : null,
  };
}

/** Clé de période (UTC) : 'mois' → AAAA-MM, 'trimestre' → AAAA-T1…T4, 'annee' → AAAA. */
function periodKey(endTime, grain) {
  if (!endTime) return null;
  const d = new Date(endTime * 1000);
  const y = d.getUTCFullYear(); const m = d.getUTCMonth() + 1;
  if (grain === 'annee') return String(y);
  if (grain === 'trimestre') return `${y}-T${Math.ceil(m / 3)}`;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Elo de performance par groupe. `key(record)` donne la clé du groupe (ex. cadence ou période).
 * Pour chaque groupe : performanceRating + dernier classement Chess.com du joueur dans ce groupe.
 */
function performanceBy(records, key) {
  const groups = new Map();
  for (const r of records) {
    const k = key(r);
    if (k == null) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups.entries()].map(([k, rs]) => {
    const sorted = rs.slice().sort((a, b) => (a.endTime || 0) - (b.endTime || 0));
    const last = [...sorted].reverse().find((r) => r.myRating != null);
    return { key: k, ...performanceRating(rs), lastRating: last ? last.myRating : null, from: sorted[0].endTime, to: sorted[sorted.length - 1].endTime };
  }).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

module.exports = { LR_HALF_CHI2_95, expected, logLik, performanceRating, gameRecord, periodKey, performanceBy };
