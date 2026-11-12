'use strict';
/**
 * Analyse d'une partie en arrière-plan : pour chaque demi-coup, recherche libre MultiPV 2 à la profondeur
 * cible depuis la position AVANT le coup ; si le coup joué n'est dans aucune des deux lignes, recherche
 * complémentaire « searchmoves <coup joué> » à la même profondeur en MultiPV 1.
 * Chaque demi-coup est enregistré dès qu'il est calculé (reprise possible après interruption).
 */
const { Chess } = require('../core/chessutil');
const { gamePositions } = require('../core/games');
const { classifyPly, CATEGORIES } = require('../core/classify');
const { explainMove } = require('../core/motifs');
const { CancelledError } = require('./engine');

const DEFAULT_SETTINGS = { depth: 22, multipv: 2, leniency: 0.15, useCloud: true, useTablebase: true };

function lineOut(l) {
  return l ? { uci: l.pv && l.pv[0], score: l.score, pv: l.pv || [], depth: l.depth } : null;
}

async function analyzePosition(engine, fen, uci, { depth, signal, priority, newGame }) {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) {
    const score = chess.isCheckmate() ? { mate: 0 } : { cp: 0 };
    return { terminal: chess.isCheckmate() ? 'mat' : 'pat', legalCount: 0, best: null, second: null, played: null, finalScore: score };
  }
  const free = await engine.search({ fen, depth, multipv: 2, signal, priority, newGame });
  const best = lineOut(free.lines[0]);
  const second = lineOut(free.lines[1]);
  if (best && !best.uci) best.uci = free.bestmove;
  let played = null;
  if (uci) {
    if (best && best.uci === uci) played = { ...best, source: 'ligne 1 (MultiPV)' };
    else if (second && second.uci === uci) played = { ...second, source: 'ligne 2 (MultiPV)' };
    else {
      const r = await engine.search({ fen, depth, multipv: 1, searchmoves: [uci], signal, priority });
      played = { ...lineOut(r.lines[0]), source: 'recherche complémentaire searchmoves' };
      if (!played.uci) played.uci = uci;
    }
  }
  return { legalCount: legal.length, best, second, played };
}

/**
 * Repli en cas de plantage du moteur : une relance avec les mêmes réglages, puis une relance en mode
 * prudent (1 fil, 64 Mo). Un plantage persistant est remonté à l'interface avec le code de sortie.
 */
async function withRecovery(engine, fn, onFallback) {
  try { return await fn(); } catch (e) {
    if (!e.crashed) throw e;
    try { return await fn(); } catch (e2) {
      if (!e2.crashed) throw e2;
      engine.reconfigure({ threads: 1, hash: 64 });
      if (onFallback) onFallback(e2);
      return fn();
    }
  }
}

function createAnalyzer({ store, engineRef, external, getSettings, openings }) {
  let job = { status: 'idle' };
  let controller = null;
  let runPromise = null;

  function settingsKey(s, engineName) {
    return { engine: engineName, depth: s.depth, multipv: s.multipv };
  }

  async function enrich(fen, uci, s, state, signal) {
    const out = { cloud: null, tablebase: null };
    const tasks = [];
    if (s.useCloud && external && !(state && state.cloudOff)) {
      tasks.push(external.cloudEval(fen, 2).then((r) => {
        if (r.status === 'ok') { out.cloud = { depth: r.depth, lines: r.lines, source: r.source }; if (state) state.cloudMiss = 0; } else if (state) {
          state.cloudMiss = (state.cloudMiss || 0) + 1;
          if (state.cloudMiss >= 2 || r.status === 'rate-limited') state.cloudOff = true; // la partie a quitté les positions connues
        }
      }));
    }
    if (s.useTablebase && external) {
      tasks.push(external.tablebase(fen).then((r) => { if (r.status === 'ok') out.tablebase = r; }));
    }
    await Promise.all(tasks);
    if (signal && signal.aborted) throw new CancelledError();
    return out;
  }

  async function run(gameId, signal) {
    const game = store.findGame(gameId);
    if (!game) throw new Error('Partie introuvable');
    const pos = gamePositions(game.pgn);
    const s = { ...DEFAULT_SETTINGS, ...getSettings() };
    const engine = engineRef();
    await engine.start();
    const key = settingsKey(s, engine.name);
    let analysis = store.loadAnalysis(gameId);
    if (!analysis || !analysis.settings || analysis.settings.depth !== key.depth || analysis.settings.multipv !== key.multipv
      || !analysis.engine || analysis.engine.name !== engine.name) {
      analysis = {
        gameId,
        engine: { name: engine.name, threads: engine.threads, hash: engine.hash },
        settings: { depth: s.depth, multipv: s.multipv },
        plies: [],
        complete: false,
        createdAt: Date.now(),
      };
    }
    const done = new Set(analysis.plies.map((p) => p.ply));
    job.total = pos.plies.length;
    job.done = done.size;
    const state = {};
    let first = true;
    for (const p of pos.plies) {
      if (done.has(p.ply)) continue;
      if (signal.aborted) throw new CancelledError();
      job.currentPly = p.ply;
      const [res, ext] = await Promise.all([
        withRecovery(engine, () => analyzePosition(engine, p.fenBefore, p.uci, { depth: s.depth, signal, newGame: first }), (err) => {
          job.warning = `Le moteur s’est arrêté (${err.message}) : analyse poursuivie en mode prudent (1 fil, 64 Mo).`;
          analysis.engine.fallback = job.warning;
        }),
        enrich(p.fenBefore, p.uci, s, state, signal),
      ]);
      first = false;
      analysis.plies.push({ ply: p.ply, ...res, ...ext });
      analysis.plies.sort((a, b) => a.ply - b.ply);
      analysis.engine.threads = engine.threads;
      analysis.engine.hash = engine.hash;
      analysis.updatedAt = Date.now();
      store.saveAnalysis(gameId, analysis);
      job.done = analysis.plies.length;
    }
    analysis.complete = analysis.plies.length >= pos.plies.length;
    analysis.finishedAt = Date.now();
    store.saveAnalysis(gameId, analysis);
  }

  return {
    status: () => ({ ...job }),
    async start(gameId) {
      if (job.status === 'running') {
        if (job.gameId === gameId) return this.status();
        await this.cancel();
      }
      controller = new AbortController();
      job = { status: 'running', gameId, done: 0, total: 0, startedAt: Date.now() };
      const signal = controller.signal;
      runPromise = run(gameId, signal).then(() => {
        job.status = 'done';
      }, (e) => {
        if (e && e.cancelled) job.status = 'cancelled';
        else { job.status = 'error'; job.error = e.message; }
      });
      return this.status();
    },
    async cancel() {
      if (controller) controller.abort();
      if (runPromise) await runPromise;
    },
    /** Évaluation d'un coup exploré (prioritaire sur l'analyse de fond). */
    async evaluateMove(fen, uci, eloForLeniency) {
      const s = { ...DEFAULT_SETTINGS, ...getSettings() };
      const chess = new Chess(fen);
      let mv;
      try { mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch (e) { mv = null; }
      if (!mv) throw new Error('Coup illégal');
      const engine = engineRef();
      await engine.start();
      const [res, ext] = await Promise.all([
        withRecovery(engine, () => analyzePosition(engine, fen, uci, { depth: s.depth, priority: true })),
        enrich(fen, uci, s, null, null),
      ]);
      const raw = { ...res, ...ext, uci, san: mv.san, fenBefore: fen, book: false }; // les coups explorés ne sont jamais classés « théorie »
      const cls = classifyPly(raw, { elo: eloForLeniency, leniency: s.leniency });
      const expl = explainMove(raw, cls);
      const after = new Chess(chess.fen());
      let terminal = null;
      if (after.isCheckmate()) terminal = 'mat';
      else if (after.isStalemate()) terminal = 'pat';
      else if (after.isDraw()) terminal = 'nulle';
      return {
        ...raw,
        fenAfter: chess.fen(),
        terminalAfter: terminal,
        engine: { name: engine.name, depth: s.depth },
        classification: cls.category ? {
          category: cls.category, label: CATEGORIES[cls.category].label, symbol: CATEGORIES[cls.category].symbol,
          loss: cls.loss, reasons: cls.reasons, wBest: cls.wBest, wPlayed: cls.wPlayed,
        } : null,
        explanation: expl,
      };
    },
  };
}

module.exports = { createAnalyzer, analyzePosition, withRecovery, DEFAULT_SETTINGS };
