'use strict';
/**
 * Chances de gain et perte d'un coup (formules reprises d'Analyse Échecs).
 * Convention : { cp } ou { mate }, du point de vue du joueur au trait AVANT le coup.
 */
const WIN_K = 0.00368208;
const MATE_CP = 10000;
const MATE_STEP = 10;

/** Chances de gain Lichess, en points de pourcentage (0-100). */
function winChance(cp) {
  return 50 + 50 * (2 / (1 + Math.exp(-WIN_K * cp)) - 1);
}

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

/** Perte en points de pourcentage de chances de gain : max(0, W(meilleur) - W(joué)). */
function moveLoss(bestScore, playedScore) {
  const wb = scoreWin(bestScore);
  const wp = scoreWin(playedScore);
  if (wb === null || wp === null) return null;
  return Math.max(0, wb - wp);
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

module.exports = { WIN_K, winChance, scoreToCp, scoreWin, moveLoss, formatScore };
