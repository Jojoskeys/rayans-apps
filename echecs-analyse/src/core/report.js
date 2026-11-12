'use strict';
/**
 * Assemble le rapport affiché : classement de chaque coup, explications, précision et Elo estimé
 * par joueur. Recalculé à chaque ouverture à partir des données brutes du moteur enregistrées sur
 * disque : aucun recalcul moteur, et un changement d'assouplissement s'applique immédiatement.
 */
const { classifyPly, CATEGORIES, CATEGORY_KEYS } = require('./classify');
const { explainMove } = require('./motifs');
const { playerAccuracy, estimateElo, negateScore } = require('./scoring');
const { gamePositions } = require('./games');

function toWhite(score, color) {
  return color === 'w' ? score : negateScore(score);
}

function buildReport(game, analysis, openings, settings = {}) {
  const pos = gamePositions(game.pgn);
  const { opening, bookPlies } = openings ? openings.analyze(pos.plies) : { opening: null, bookPlies: new Set() };
  const eloOf = (color) => {
    const r = color === 'w' ? game.white.rating : game.black.rating;
    if (typeof r === 'number') return r;
    const h = parseInt(color === 'w' ? pos.headers.WhiteElo : pos.headers.BlackElo, 10);
    return Number.isFinite(h) ? h : null;
  };
  const byPly = new Map(((analysis && analysis.plies) || []).map((p) => [p.ply, p]));
  const plies = [];
  const players = {};
  for (const c of ['w', 'b']) {
    const counts = {};
    for (const k of CATEGORY_KEYS) counts[k] = [];
    players[c] = { counts, losses: [], elo: eloOf(c) };
  }
  for (const p of pos.plies) {
    const a = byPly.get(p.ply);
    const entry = { ...p, book: bookPlies.has(p.ply), analyzed: !!a };
    if (a) {
      const raw = { ...a, uci: p.uci, san: p.san, fenBefore: p.fenBefore, book: bookPlies.has(p.ply) };
      const cls = classifyPly(raw, { elo: players[p.color].elo, leniency: settings.leniency });
      const expl = explainMove(raw, cls);
      entry.best = a.best;
      entry.second = a.second;
      entry.played = a.played;
      entry.cloud = a.cloud || null;
      entry.tablebase = a.tablebase || null;
      entry.legalCount = a.legalCount;
      entry.classification = cls.category ? {
        category: cls.category,
        label: CATEGORIES[cls.category].label,
        symbol: CATEGORIES[cls.category].symbol,
        loss: cls.loss,
        wBest: cls.wBest,
        wPlayed: cls.wPlayed,
        reasons: cls.reasons,
        factor: cls.thresholds.factor,
      } : null;
      entry.explanation = expl;
      entry.evalAfterWhite = a.played && a.played.score ? toWhite(a.played.score, p.color) : null;
      if (cls.category) {
        players[p.color].counts[cls.category].push(p.ply);
        players[p.color].losses.push(cls.loss);
      }
    }
    plies.push(entry);
  }
  const first = byPly.get(1);
  const startEval = first && first.best ? first.best.score : null; // Blancs au trait au départ
  for (const c of ['w', 'b']) {
    const acc = playerAccuracy(players[c].losses);
    players[c].accuracy = acc.accuracy;
    players[c].evaluatedMoves = acc.count;
    players[c].estimatedElo = estimateElo(acc.accuracy, acc.count);
    players[c].username = c === 'w' ? game.white.username : game.black.username;
    players[c].chesscomElo = players[c].elo;
    delete players[c].losses;
  }
  return {
    gameId: game.id,
    headers: pos.headers,
    opening,
    startEvalWhite: startEval,
    plies,
    players,
    analysis: analysis ? {
      complete: !!analysis.complete,
      engine: analysis.engine,
      settings: analysis.settings,
      analyzedPlies: (analysis.plies || []).length,
      totalPlies: pos.plies.length,
      updatedAt: analysis.updatedAt,
    } : null,
  };
}

module.exports = { buildReport, toWhite };
