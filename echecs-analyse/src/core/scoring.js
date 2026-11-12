'use strict';
/**
 * Formules de notation : chances de gain, perte, précision, Elo estimé.
 * Toutes les fonctions sont pures et testées dans test/unit/scoring.test.js.
 *
 * Convention des scores : { cp: <centipions> } ou { mate: <n> }, toujours du point de vue
 * du joueur au trait dans la position AVANT le coup (le joueur qui joue le coup évalué).
 *  - mate > 0 : ce joueur mate en n coups ; mate < 0 : il est maté en |n| coups.
 *  - mate = 0 : position terminale où ce joueur est maté (fin de partie).
 */

const WIN_K = 0.00368208;
const MATE_CP = 10000; // équivalent centipions d'un mat imminent
const MATE_STEP = 10; // un mat plus lointain vaut un peu moins

/** Chances de gain Lichess, en points de pourcentage (0-100). */
function winChance(cp) {
  return 50 + 50 * (2 / (1 + Math.exp(-WIN_K * cp)) - 1);
}

/**
 * Convertit un score UCI en équivalent centipions.
 * Mat en n pour le joueur : 10000 - 10·n ; maté en n : -(10000 - 10·n). Mat 0 (déjà maté) : -10000.
 * Avec ces valeurs, W vaut 100,00 (ou 0,00) à 0,01 près : un mat est une victoire certaine
 * et deux mats de longueurs différentes ont une perte quasi nulle.
 */
function scoreToCp(score) {
  if (!score) return null;
  if (typeof score.mate === 'number') {
    if (score.mate === 0) return -MATE_CP;
    const sign = score.mate > 0 ? 1 : -1;
    return sign * (MATE_CP - MATE_STEP * Math.min(Math.abs(score.mate), 500));
  }
  if (typeof score.cp === 'number') return score.cp;
  return null;
}

function scoreWin(score) {
  const cp = scoreToCp(score);
  return cp === null ? null : winChance(cp);
}

/** Inverse le point de vue d'un score (utile pour passer au camp adverse). */
function negateScore(score) {
  if (!score) return score;
  if (typeof score.mate === 'number') return { mate: score.mate === 0 ? 0 : -score.mate };
  return { cp: -score.cp };
}

/** Perte en points de pourcentage : max(0, W(meilleur) - W(joué)). */
function moveLoss(bestScore, playedScore) {
  const wb = scoreWin(bestScore);
  const wp = scoreWin(playedScore);
  if (wb === null || wp === null) return null;
  return Math.max(0, wb - wp);
}

/** Précision d'un coup : 103,1668 × exp(-0,04354 × perte) - 3,1669, bornée à [0, 100]. */
function moveAccuracy(loss) {
  const raw = 103.1668 * Math.exp(-0.04354 * loss) - 3.1669;
  return Math.min(100, Math.max(0, raw));
}

/**
 * Plancher appliqué dans la moyenne harmonique : une précision de coup nulle (perte ≥ ~80 points)
 * rendrait la moyenne harmonique nulle quel que soit le reste de la partie. On utilise donc
 * max(précision, 1) dans la moyenne harmonique uniquement (la moyenne arithmétique garde 0).
 */
const HARMONIC_FLOOR = 1;

/**
 * Précision d'un joueur sur une partie : 30 % moyenne arithmétique + 70 % moyenne harmonique.
 * Renvoie { accuracy: null, count: 0 } si aucun coup n'est évaluable.
 */
function playerAccuracy(losses) {
  const values = losses.filter((l) => typeof l === 'number' && Number.isFinite(l)).map(moveAccuracy);
  if (values.length === 0) return { accuracy: null, count: 0 };
  const arith = values.reduce((a, b) => a + b, 0) / values.length;
  const harm = values.length / values.reduce((a, v) => a + 1 / Math.max(v, HARMONIC_FLOOR), 0);
  const accuracy = 0.3 * arith + 0.7 * harm;
  return { accuracy: Math.min(100, Math.max(0, accuracy)), count: values.length, arithmetic: arith, harmonic: harm };
}

/**
 * Elo estimé pour la partie (heuristique propre à l'application, indépendante de Chess.com).
 * 1. Table précision → Elo brute, interpolation linéaire.
 * 2. Rétrécissement vers 1500 selon la taille de l'échantillon : poids = n / (n + 12).
 * 3. Marge indicative ± 900 / √n, arrondie à 50.
 * Sous MIN_MOVES coups évalués, aucun chiffre n'est donné (échantillon trop court).
 */
const ELO_TABLE = [
  [0, 300], [40, 450], [50, 700], [60, 1000], [70, 1350], [80, 1700],
  [85, 1950], [90, 2250], [95, 2600], [98, 2850], [100, 3000],
];
const ELO_PRIOR = 1500;
const ELO_SHRINK = 12;
const ELO_MIN_MOVES = 10;

function rawEloFromAccuracy(acc) {
  const a = Math.min(100, Math.max(0, acc));
  for (let i = 1; i < ELO_TABLE.length; i++) {
    const [x1, y1] = ELO_TABLE[i];
    const [x0, y0] = ELO_TABLE[i - 1];
    if (a <= x1) return y0 + ((a - x0) / (x1 - x0)) * (y1 - y0);
  }
  return ELO_TABLE[ELO_TABLE.length - 1][1];
}

function estimateElo(accuracy, count) {
  if (accuracy === null || accuracy === undefined || !count) {
    return { elo: null, margin: null, tooShort: true, count: count || 0 };
  }
  if (count < ELO_MIN_MOVES) return { elo: null, margin: null, tooShort: true, count };
  const raw = rawEloFromAccuracy(accuracy);
  const w = count / (count + ELO_SHRINK);
  const elo = Math.round((ELO_PRIOR + w * (raw - ELO_PRIOR)) / 10) * 10;
  const margin = Math.round(900 / Math.sqrt(count) / 50) * 50;
  return { elo, margin, tooShort: false, count, raw: Math.round(raw) };
}

/** Formatage d'un score pour l'affichage (point de vue fourni). */
function formatScore(score) {
  if (!score) return '—';
  if (typeof score.mate === 'number') {
    if (score.mate === 0) return '#0';
    return (score.mate > 0 ? '#' : '#-') + Math.abs(score.mate);
  }
  const v = score.cp / 100;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
}

module.exports = {
  WIN_K, MATE_CP, HARMONIC_FLOOR, ELO_MIN_MOVES, ELO_TABLE,
  winChance, scoreToCp, scoreWin, negateScore, moveLoss, moveAccuracy, playerAccuracy,
  rawEloFromAccuracy, estimateElo, formatScore,
};
