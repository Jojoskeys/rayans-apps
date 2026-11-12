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

const DEPTHS = [12, 14, 16, 18, 20, 22, 24];
const MAX_CONSECUTIVE_ERRORS = 2;

/**
 * File d'attente d'analyses, traitée une partie à la fois en arrière-plan.
 * - Enregistrée sur disque (file-attente.json) ; au redémarrage, une file non vide est mise en pause.
 * - « Analyser » sur une partie la place en tête et interrompt la partie en cours (son avancement,
 *   enregistré demi-coup par demi-coup, reprend plus tard).
 * - Chaque élément garde sa profondeur. Deux échecs consécutifs mettent la file en pause.
 */
function createAnalyzer({ store, engineRef, external, getSettings, openings }) {
  const saved = store.loadQueue ? store.loadQueue() : { items: [] };
  const q = { items: Array.isArray(saved.items) ? saved.items.filter((i) => i && i.gameId) : [], paused: false, message: null };
  if (q.items.length) { q.paused = true; q.message = 'File d’attente reprise après redémarrage : en pause.'; }
  let current = null; // { gameId, depth, done, total, startedAt, warning, controller }
  let last = null; // dernière partie terminée : { status, gameId, error, depth }
  const errors = {}; // gameId → message (dernières erreurs)
  let processed = 0; let failed = 0; let consecutiveErrors = 0;
  const speed = {}; // profondeur → { ms, plies } mesurés pendant cette session
  let pumping = null;

  const persist = () => { if (store.saveQueue) store.saveQueue({ items: q.items }); };

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

  async function run(item, signal, cur) {
    const { gameId } = item;
    const game = store.findGame(gameId);
    if (!game) throw new Error('Partie introuvable');
    const pos = gamePositions(game.pgn);
    const s = { ...DEFAULT_SETTINGS, ...getSettings() };
    const depth = item.depth || s.depth;
    const engine = engineRef();
    await engine.start();
    let analysis = store.loadAnalysis(gameId);
    if (!analysis || !analysis.settings || analysis.settings.depth !== depth || analysis.settings.multipv !== s.multipv
      || !analysis.engine || analysis.engine.name !== engine.name) {
      analysis = {
        gameId,
        engine: { name: engine.name, threads: engine.threads, hash: engine.hash },
        settings: { depth, multipv: s.multipv },
        plies: [],
        complete: false,
        createdAt: Date.now(),
      };
    }
    const done = new Set(analysis.plies.map((p) => p.ply));
    cur.total = pos.plies.length;
    cur.done = done.size;
    const state = {};
    let first = true;
    const sp = speed[depth] || (speed[depth] = { ms: 0, plies: 0 });
    for (const p of pos.plies) {
      if (done.has(p.ply)) continue;
      if (signal.aborted) throw new CancelledError();
      cur.currentPly = p.ply;
      const t0 = Date.now();
      const [res, ext] = await Promise.all([
        withRecovery(engine, () => analyzePosition(engine, p.fenBefore, p.uci, { depth, signal, newGame: first }), (err) => {
          cur.warning = `Le moteur s’est arrêté (${err.message}) : analyse poursuivie en mode prudent (1 fil, 64 Mo).`;
          analysis.engine.fallback = cur.warning;
        }),
        enrich(p.fenBefore, p.uci, s, state, signal),
      ]);
      first = false;
      sp.ms += Date.now() - t0; sp.plies += 1;
      analysis.plies.push({ ply: p.ply, ...res, ...ext });
      analysis.plies.sort((a, b) => a.ply - b.ply);
      analysis.engine.threads = engine.threads;
      analysis.engine.hash = engine.hash;
      analysis.updatedAt = Date.now();
      store.saveAnalysis(gameId, analysis);
      cur.done = analysis.plies.length;
    }
    analysis.complete = analysis.plies.length >= pos.plies.length;
    analysis.finishedAt = Date.now();
    analysis.updatedAt = analysis.updatedAt || analysis.finishedAt;
    store.saveAnalysis(gameId, analysis);
  }

  function pump() {
    if (pumping) return pumping;
    pumping = (async () => {
      while (!q.paused && q.items.length) {
        const item = q.items[0];
        const controller = new AbortController();
        current = { gameId: item.gameId, depth: item.depth, done: 0, total: item.plyCount || 0, startedAt: Date.now(), controller };
        let outcome;
        try {
          await run(item, controller.signal, current);
          outcome = { status: 'done' };
        } catch (e) {
          outcome = e && e.cancelled ? { status: 'cancelled' } : { status: 'error', error: e && e.message ? e.message : String(e) };
        }
        const reason = controller.signal.aborted ? controller.signal.reason : null;
        const warning = current.warning;
        current = null;
        if (outcome.status === 'cancelled' && (reason === 'pause' || reason === 'preempt' || reason === 'close')) {
          if (reason === 'close') break;
          continue; // l'élément reste dans la file
        }
        const idx = q.items.indexOf(item);
        if (idx >= 0) q.items.splice(idx, 1);
        last = { status: outcome.status, gameId: item.gameId, depth: item.depth, error: outcome.error || null, warning: warning || null };
        processed += 1;
        if (outcome.status === 'error') {
          failed += 1; consecutiveErrors += 1;
          errors[item.gameId] = outcome.error;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && q.items.length) {
            q.paused = true;
            q.message = `File mise en pause après ${MAX_CONSECUTIVE_ERRORS} échecs consécutifs : ${outcome.error}`;
          }
        } else if (outcome.status === 'done') { consecutiveErrors = 0; delete errors[item.gameId]; }
        persist();
      }
    })().finally(() => { pumping = null; });
    return pumping;
  }

  function depthOrDefault(d) {
    const s = { ...DEFAULT_SETTINGS, ...getSettings() };
    return DEPTHS.includes(d) ? d : s.depth;
  }
  function plyCountOf(gameId) { const g = store.findGame(gameId); return g ? g.plyCount : 0; }

  function etaMs() {
    let total = 0;
    for (const it of q.items) {
      const sp = speed[it.depth];
      if (!sp || sp.plies < 5) return null;
      let left = it.plyCount || 0;
      if (current && current.gameId === it.gameId) left = Math.max(0, (current.total || left) - current.done);
      total += left * (sp.ms / sp.plies);
    }
    return Math.round(total);
  }

  function status() {
    let base;
    if (current) base = { status: 'running', gameId: current.gameId, depth: current.depth, done: current.done, total: current.total, currentPly: current.currentPly, warning: current.warning || null, startedAt: current.startedAt };
    else if (q.paused && q.items.length) base = { status: 'paused', gameId: q.items[0].gameId, depth: q.items[0].depth };
    else if (last) base = { ...last };
    else base = { status: 'idle' };
    const sp = Object.fromEntries(Object.entries(speed).filter(([, v]) => v.plies).map(([d, v]) => [d, Math.round(v.ms / v.plies)]));
    base.queue = {
      length: q.items.length,
      paused: q.paused,
      message: q.message,
      items: q.items.slice(0, 200).map((i) => ({ gameId: i.gameId, depth: i.depth, plyCount: i.plyCount })),
      processed, failed,
      remainingPlies: q.items.reduce((a, i) => a + (i.plyCount || 0), 0) - (current ? current.done : 0),
      etaMs: etaMs(),
      msPerPly: sp,
    };
    base.errors = { ...errors };
    return base;
  }

  function resetCountersIfIdle() {
    if (!q.items.length && !current) { processed = 0; failed = 0; consecutiveErrors = 0; }
  }

  return {
    DEPTHS,
    status,
    isQueued: (id) => q.items.some((i) => i.gameId === id),
    /** Analyse prioritaire d'une partie : en tête de file, la partie en cours est interrompue (reprise plus tard). */
    async start(gameId, depth) {
      const d = depthOrDefault(depth);
      if (current && current.gameId === gameId && current.depth === d && !q.paused) return status();
      resetCountersIfIdle();
      q.items = q.items.filter((i) => i.gameId !== gameId);
      q.items.unshift({ gameId, depth: d, plyCount: plyCountOf(gameId), addedAt: Date.now() });
      q.paused = false; q.message = null; consecutiveErrors = 0;
      delete errors[gameId];
      persist();
      if (current) current.controller.abort('preempt');
      pump();
      return status();
    },
    /** Ajoute des parties en fin de file (celles déjà présentes sont ignorées). */
    enqueue(gameIds, depth) {
      const d = depthOrDefault(depth);
      resetCountersIfIdle();
      const present = new Set(q.items.map((i) => i.gameId));
      let added = 0;
      for (const id of gameIds) {
        if (present.has(id)) continue;
        present.add(id);
        q.items.push({ gameId: id, depth: d, plyCount: plyCountOf(id), addedAt: Date.now() });
        added += 1;
      }
      if (added) { q.paused = false; q.message = null; consecutiveErrors = 0; }
      persist();
      pump();
      return { added, status: status() };
    },
    /** Retire une partie de la file ; si elle est en cours, son calcul est arrêté et la file continue. */
    async cancelGame(gameId) {
      q.items = q.items.filter((i) => i.gameId !== gameId);
      persist();
      if (current && current.gameId === gameId) {
        current.controller.abort('remove');
        if (pumping) await Promise.race([pumping, new Promise((r) => setTimeout(r, 5000))]);
      }
      return status();
    },
    async pause() {
      q.paused = true; q.message = null;
      if (current) current.controller.abort('pause');
      if (pumping) await pumping;
      return status();
    },
    resume() {
      q.paused = false; q.message = null; consecutiveErrors = 0;
      pump();
      return status();
    },
    async clear() {
      q.items = []; q.message = null;
      persist();
      if (current) current.controller.abort('remove');
      if (pumping) await pumping;
      processed = 0; failed = 0;
      return status();
    },
    /** Arrêt de l'application : la partie en cours reste dans la file enregistrée. */
    async close() {
      if (current) current.controller.abort('close');
      if (pumping) await pumping;
    },
    /** Compatibilité : arrête le calcul en cours sans toucher à la file (fermeture). */
    async cancel() { return this.close(); },
    /** Attend la fin du traitement de la file (tests). */
    idle: () => pumping || Promise.resolve(),
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

module.exports = { createAnalyzer, analyzePosition, withRecovery, DEFAULT_SETTINGS, DEPTHS };
