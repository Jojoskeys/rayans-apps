'use strict';
/**
 * Bilan sur plusieurs parties analysées.
 * 1. summarizeGame : résumé compact d'une partie analysée (calculé une fois côté serveur, mis en cache).
 * 2. aggregateBilan : regroupements (période, cadence, couleur, phase) du point de vue d'un joueur.
 * Fonctions pures, testées dans test/unit/bilan.test.js. Règles : REGLES-ANALYSE.md, section 8.
 */
const { moveAccuracy, HARMONIC_FLOOR } = require('./scoring');
const { phasesOf, PHASES } = require('./phases');
const { periodKey } = require('./performance');

const ERROR_KEYS = ['gaffe', 'erreur', 'imprecision', 'occasion_manquee'];
const SUMMARY_VERSION = 1; // à incrémenter si les règles de classement ou de résumé changent

function emptyStats() {
  return { n: 0, sumAcc: 0, sumInv: 0, gaffe: 0, erreur: 0, imprecision: 0, occasion_manquee: 0 };
}
function addMove(st, loss, category) {
  const a = moveAccuracy(loss);
  st.n += 1; st.sumAcc += a; st.sumInv += 1 / Math.max(a, HARMONIC_FLOOR);
  if (ERROR_KEYS.includes(category)) st[category] += 1;
}
function addStats(dst, src) {
  for (const k of Object.keys(dst)) dst[k] += src[k] || 0;
}
/** Précision agrégée d'un ensemble de coups : même formule qu'une partie (30 % arithmétique + 70 % harmonique). */
function pooledAccuracy(st) {
  if (!st.n) return null;
  return Math.min(100, Math.max(0, 0.3 * (st.sumAcc / st.n) + 0.7 * (st.n / st.sumInv)));
}

/** Résumé d'une partie analysée complète, pour les deux camps. */
function summarizeGame(game, report) {
  const phases = phasesOf(report.plies);
  const sides = {};
  for (const c of ['w', 'b']) sides[c] = { accuracy: report.players[c].accuracy, moves: 0, counts: {}, phases: {} };
  for (const c of ['w', 'b']) for (const ph of PHASES) sides[c].phases[ph] = emptyStats();
  report.plies.forEach((p, i) => {
    if (!p.classification) return;
    const s = sides[p.color];
    s.moves += 1;
    s.counts[p.classification.category] = (s.counts[p.classification.category] || 0) + 1;
    addMove(s.phases[phases[i]], p.classification.loss, p.classification.category);
  });
  return {
    v: SUMMARY_VERSION,
    id: game.id, url: game.url || null, endTime: game.endTime, timeClass: game.timeClass, rated: game.rated, result: game.result,
    white: { username: game.white.username, rating: game.white.rating },
    black: { username: game.black.username, rating: game.black.rating },
    depth: report.analysis && report.analysis.settings ? report.analysis.settings.depth : null,
    sides,
  };
}

function colorOf(summary, me) {
  const m = String(me || '').toLowerCase();
  if (summary.white.username && summary.white.username.toLowerCase() === m) return 'w';
  if (summary.black.username && summary.black.username.toLowerCase() === m) return 'b';
  return null;
}

/** Filtres communs au bilan et à l'Elo de performance. */
function matchFilters(rec, f = {}) {
  if (f.timeClass && rec.timeClass !== f.timeClass) return false;
  if (f.color && rec.color !== f.color) return false;
  if (f.from && (!rec.endTime || rec.endTime < f.from)) return false;
  if (f.to && (!rec.endTime || rec.endTime > f.to)) return false;
  if (f.ratedOnly && !rec.rated) return false;
  return true;
}

function groupStats(items) {
  const n = items.length;
  const accs = items.map((i) => i.accuracy).filter((a) => typeof a === 'number');
  const mean = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null;
  let ci = null;
  if (accs.length >= 2) {
    const v = accs.reduce((a, b) => a + (b - mean) ** 2, 0) / (accs.length - 1);
    ci = 1.96 * Math.sqrt(v / accs.length);
  }
  const sum = (k) => items.reduce((a, i) => a + (i.counts[k] || 0), 0);
  const moves = items.reduce((a, i) => a + i.moves, 0);
  const per = (k) => (n ? sum(k) / n : null);
  return {
    games: n, moves, accuracy: mean, accuracyCI: ci,
    gaffesPerGame: per('gaffe'), erreursPerGame: per('erreur'), imprecisionsPerGame: per('imprecision'), occasionsPerGame: per('occasion_manquee'),
    gaffes: sum('gaffe'), erreurs: sum('erreur'),
    wins: items.filter((i) => i.score === 1).length, draws: items.filter((i) => i.score === 0.5).length, losses: items.filter((i) => i.score === 0).length,
  };
}

function groupBy(items, key) {
  const m = new Map();
  for (const it of items) {
    const k = key(it);
    if (k == null) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([k, list]) => ({ key: k, ...groupStats(list) }));
}

/**
 * @param summaries résumés (summarizeGame) ; me : pseudo ; filters : { timeClass, color, from, to } ;
 * grain : 'mois' | 'trimestre' | 'annee'.
 */
function aggregateBilan(summaries, me, filters = {}, grain = 'mois') {
  const items = [];
  for (const s of summaries) {
    const c = colorOf(s, me);
    if (!c) continue;
    let score = 0.5;
    if (s.result === '1-0') score = c === 'w' ? 1 : 0; else if (s.result === '0-1') score = c === 'w' ? 0 : 1;
    const side = s.sides[c];
    const rec = { id: s.id, url: s.url, endTime: s.endTime, timeClass: s.timeClass, rated: s.rated, color: c, score, depth: s.depth, accuracy: side.accuracy, moves: side.moves, counts: side.counts, phases: side.phases, opponent: c === 'w' ? s.black : s.white };
    if (matchFilters(rec, filters)) items.push(rec);
  }
  const byPhase = PHASES.map((ph) => {
    const st = emptyStats();
    let games = 0;
    for (const it of items) { if (it.phases[ph].n) games++; addStats(st, it.phases[ph]); }
    const per100 = (k) => (st.n ? (100 * st[k]) / st.n : null);
    return { phase: ph, games, moves: st.n, accuracy: pooledAccuracy(st), gaffesPer100: per100('gaffe'), erreursPer100: per100('erreur'), imprecisionsPer100: per100('imprecision') };
  });
  const depths = {};
  for (const it of items) depths[it.depth] = (depths[it.depth] || 0) + 1;
  return {
    overall: groupStats(items),
    byPeriod: groupBy(items, (i) => periodKey(i.endTime, grain)),
    byTimeClass: groupBy(items, (i) => i.timeClass || 'inconnue'),
    byColor: groupBy(items, (i) => i.color),
    byPhase,
    depths,
    worst: items.slice().sort((a, b) => (b.counts.gaffe || 0) - (a.counts.gaffe || 0) || (a.accuracy ?? 101) - (b.accuracy ?? 101)).slice(0, 10)
      .map((i) => ({ id: i.id, endTime: i.endTime, timeClass: i.timeClass, color: i.color, score: i.score, accuracy: i.accuracy, gaffes: i.counts.gaffe || 0, erreurs: i.counts.erreur || 0, opponent: i.opponent })),
  };
}

module.exports = { SUMMARY_VERSION, summarizeGame, aggregateBilan, pooledAccuracy, matchFilters, colorOf, ERROR_KEYS };
