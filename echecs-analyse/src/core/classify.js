'use strict';
/**
 * Classement des coups (catégories inspirées de Chess.com, règles propres documentées dans
 * docs/REGLES-ANALYSE.md). Fonctions pures, testées dans test/unit/classify.test.js.
 */
const { scoreWin, moveLoss } = require('./scoring');
const { Chess, VALUES, uciToObj, frSan } = require('./chessutil');

const BASE_THRESHOLDS = { excellent: 2.5, bon: 6, imprecision: 12, erreur: 22 };
const DEFAULT_LENIENCY = 0.15; // assouplissement maximal (15 %) appliqué à 800 Elo et moins
const LENIENCY_ELO_TOP = 1400;
const LENIENCY_ELO_SPAN = 600; // assouplissement complet atteint à 1400 - 600 = 800 Elo

// Seuils des catégories spéciales (en points de chances de gain, point de vue du joueur).
const SPECIAL = {
  decisive: 90, // avantage décisif : W(meilleur) ≥ 90 (≈ +6,0)
  decisiveLostBelow: 75, // l'avantage n'est plus décisif si W(joué) < 75
  notLostAbove: 25, // en dessous, la position est devenue perdante : erreur/gaffe ordinaire
  onlyMoveGap: 15, // « très bon » : le 2e coup perd au moins 15 points
  onlyMoveMinW: 40, // « très bon » : la position préservée vaut au moins W = 40
  sacMin: 2, // « brillant » : au moins 2 points de matériel laissés
  sacMinW: 45, // « brillant » : la position reste au moins équilibrée
  sacMaxWBest: 97, // « brillant » : pas quand la partie est déjà totalement gagnée
  sacHorizon: 6, // demi-coups rejoués dans la variante pour confirmer le sacrifice
};

const CATEGORIES = {
  theorie: { label: 'Théorie', symbol: '≡', order: 0 },
  brillant: { label: 'Brillant', symbol: '!!', order: 1 },
  tres_bon: { label: 'Très bon', symbol: '!', order: 2 },
  meilleur: { label: 'Meilleur', symbol: '★', order: 3 },
  excellent: { label: 'Excellent', symbol: '', order: 4 },
  bon: { label: 'Bon', symbol: '', order: 5 },
  imprecision: { label: 'Imprécision', symbol: '?!', order: 6 },
  occasion_manquee: { label: 'Occasion manquée', symbol: '×', order: 7 },
  erreur: { label: 'Erreur', symbol: '?', order: 8 },
  gaffe: { label: 'Gaffe', symbol: '??', order: 9 },
};
const CATEGORY_KEYS = Object.keys(CATEGORIES);

/** Facteur d'assouplissement selon l'Elo du joueur au moment de la partie. */
function leniencyFactor(elo, leniency = DEFAULT_LENIENCY) {
  if (typeof elo !== 'number' || !Number.isFinite(elo) || elo <= 0) return 1;
  if (elo >= LENIENCY_ELO_TOP) return 1;
  const t = Math.min(1, (LENIENCY_ELO_TOP - elo) / LENIENCY_ELO_SPAN);
  return 1 + Math.max(0, leniency) * t;
}

function thresholdsFor(elo, leniency = DEFAULT_LENIENCY) {
  const f = leniencyFactor(elo, leniency);
  return {
    factor: f,
    excellent: BASE_THRESHOLDS.excellent * f,
    bon: BASE_THRESHOLDS.bon * f,
    imprecision: BASE_THRESHOLDS.imprecision * f,
    erreur: BASE_THRESHOLDS.erreur * f,
  };
}

/** Catégorie ordinaire à partir de la perte (bornes incluses : 2,5 → excellent). */
function ordinaryCategory(loss, thr) {
  if (loss <= thr.excellent) return 'excellent';
  if (loss <= thr.bon) return 'bon';
  if (loss <= thr.imprecision) return 'imprecision';
  if (loss <= thr.erreur) return 'erreur';
  return 'gaffe';
}

const TB_RANK = { win: 2, 'syzygy-win': 2, 'maybe-win': 1, 'cursed-win': 1, draw: 0, 'blessed-loss': -1, 'maybe-loss': -1, 'syzygy-loss': -2, loss: -2 };
function tbRank(cat) { return Object.prototype.hasOwnProperty.call(TB_RANK, cat) ? TB_RANK[cat] : null; }

/**
 * Détection d'un sacrifice confirmé par la variante du coup joué (rejouée légalement) :
 *  - l'adversaire prend du matériel dans la variante, et
 *  - au point « calme » le plus loin dans les SPECIAL.sacHorizon premiers demi-coups (le coup suivant de la
 *    variante n'est pas une prise, et au moins une réponse adverse a été jouée), le joueur a au moins
 *    SPECIAL.sacMin points de matériel de moins qu'avant son coup ;
 *  - ou bien la variante complète se termine par un mat en faveur du joueur après qu'il a concédé au moins
 *    SPECIAL.sacMin points à la suite d'une prise adverse.
 * Mesurer à un point calme évite de prendre un simple échange en cours pour un sacrifice.
 */
function detectSacrifice(fenBefore, line) {
  if (!line || line.length < 2) return null;
  const c = new Chess(fenBefore);
  const me = c.turn();
  const bal = () => {
    let s = 0;
    for (const row of c.board()) for (const sq of row) if (sq) s += (sq.color === me ? 1 : -1) * VALUES[sq.type];
    return s;
  };
  const isCapture = (u) => {
    if (!u) return false;
    const from = c.get(u.slice(0, 2));
    return !!c.get(u.slice(2, 4)) || !!(from && from.type === 'p' && u[0] !== u[2]);
  };
  const start = bal();
  let settled = null;
  let worstAfterCapture = 0;
  let oppCapture = null;
  for (let i = 0; i < line.length; i++) {
    let m;
    try { m = c.move(uciToObj(line[i])); } catch (e) { m = null; }
    if (!m) return null;
    const d = start - bal();
    if (i % 2 === 1 && m.captured) { oppCapture = oppCapture || m; if (d > worstAfterCapture) worstAfterCapture = d; }
    if (i < SPECIAL.sacHorizon && i >= 1 && !isCapture(line[i + 1])) settled = d;
    if (i >= SPECIAL.sacHorizon && !c.isCheckmate()) continue;
  }
  const matesOpponent = c.isCheckmate() && c.turn() !== me;
  if (oppCapture && settled !== null && settled >= SPECIAL.sacMin) return { deficit: settled, capture: oppCapture.san };
  if (oppCapture && matesOpponent && worstAfterCapture >= SPECIAL.sacMin) return { deficit: worstAfterCapture, capture: oppCapture.san, mate: true };
  return null;
}

/**
 * Classe un demi-coup analysé.
 * @param {object} ply  données brutes : uci, fenBefore, legalCount, best{uci,score,pv},
 *                      second{uci,score,pv}|null, played{score,pv}, tablebase|null, book(bool)
 * @param {object} opts { elo, leniency }
 */
function classifyPly(ply, opts = {}) {
  const thr = thresholdsFor(opts.elo, opts.leniency === undefined ? DEFAULT_LENIENCY : opts.leniency);
  if (!ply || !ply.best || !ply.played || !ply.best.score || !ply.played.score) {
    return { category: null, loss: null, reasons: ['Coup non évalué'], thresholds: thr };
  }
  const isBest = ply.uci === ply.best.uci;
  const wBest = scoreWin(ply.best.score);
  const wPlayed = isBest ? wBest : scoreWin(ply.played.score);
  const loss = isBest ? 0 : moveLoss(ply.best.score, ply.played.score);
  const ordinary = ordinaryCategory(loss, thr);
  const reasons = [];
  const tb = ply.tablebase && ply.tablebase.category ? ply.tablebase : null;
  const tbBest = tb && tb.moves && tb.moves.length ? tb.moves[0] : null;
  const tbPlayed = tb && tb.moves ? tb.moves.find((m) => m.uci === ply.uci) : null;
  const isTbBest = !!(tbBest && tbBest.uci === ply.uci);

  let category = ordinary;

  // 1. Théorie : coup de la base d'ouvertures, sans perte supérieure au seuil « bon ».
  if (ply.book && loss <= thr.bon) {
    category = 'theorie';
    reasons.push('Coup répertorié dans la base d’ouvertures lichess-org/chess-openings');
  } else {
    // 2. Brillant : sacrifice confirmé, objectivement correct.
    let sac = null;
    if (loss <= thr.excellent && wPlayed >= SPECIAL.sacMinW && wBest < SPECIAL.sacMaxWBest) {
      sac = detectSacrifice(ply.fenBefore, ply.played.pv);
    }
    if (sac) {
      category = 'brillant';
      reasons.push(`Sacrifice de ${sac.deficit} point(s) de matériel accepté dans la variante (${frSan(sac.capture)}) et évaluation maintenue`);
    } else if (isBest || isTbBest) {
      // 3. Très bon : seul coup qui préserve le résultat ou un avantage significatif.
      let only = false;
      if (ply.legalCount >= 2 && tb && tbPlayed && tb.moves.length >= 2) {
        const r = tbRank(tbPlayed.category);
        const keep = tb.moves.filter((m) => tbRank(m.category) === r).length;
        if (r !== null && r >= 0 && r === tbRank(tb.category) && keep === 1) {
          only = true;
          reasons.push('Seul coup qui préserve le résultat selon la table de finales');
        }
      }
      if (!only && ply.legalCount >= 2 && isBest && ply.second && ply.second.score) {
        const wSecond = scoreWin(ply.second.score);
        if (wBest - wSecond >= SPECIAL.onlyMoveGap && wBest >= SPECIAL.onlyMoveMinW) {
          only = true;
          reasons.push(`Seul bon coup : le 2e choix du moteur perd ${(wBest - wSecond).toFixed(1)} points`);
        }
      }
      if (only) category = 'tres_bon';
      else {
        category = 'meilleur';
        reasons.push(isBest ? 'Meilleur coup selon Stockfish' : 'Meilleur coup selon la table de finales');
      }
    } else if (['imprecision', 'erreur', 'gaffe'].includes(ordinary) && wPlayed >= SPECIAL.notLostAbove) {
      // 4. Occasion manquée : mat, gain forcé ou avantage décisif laissé passer.
      const mateMissed = typeof ply.best.score.mate === 'number' && ply.best.score.mate > 0
        && !(typeof ply.played.score.mate === 'number' && ply.played.score.mate > 0);
      const decisiveLost = wBest >= SPECIAL.decisive && wPlayed < SPECIAL.decisiveLostBelow;
      const tbWinLost = !!(tb && tbRank(tb.category) === 2 && tbPlayed && tbRank(tbPlayed.category) < 2);
      if (mateMissed || decisiveLost || tbWinLost) {
        category = 'occasion_manquee';
        if (mateMissed) reasons.push(`Mat en ${ply.best.score.mate} laissé passer`);
        if (tbWinLost) reasons.push('Gain forcé (table de finales) laissé passer');
        if (decisiveLost && !mateMissed) reasons.push('Avantage décisif laissé passer');
      }
    }
  }
  if (category === ordinary && reasons.length === 0) {
    reasons.push(`Perte de ${loss.toFixed(1)} point(s) de chances de gain`);
  }
  return { category, ordinary, loss, wBest, wPlayed, isBest, thresholds: thr, reasons };
}

module.exports = {
  BASE_THRESHOLDS, DEFAULT_LENIENCY, LENIENCY_ELO_TOP, LENIENCY_ELO_SPAN, SPECIAL, CATEGORIES, CATEGORY_KEYS,
  leniencyFactor, thresholdsFor, ordinaryCategory, detectSacrifice, classifyPly, tbRank,
};
