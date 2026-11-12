'use strict';
/**
 * Analyse des ouvertures en arrière-plan : pour chaque partie choisie, les coups du joueur joués hors théorie
 * dans les 15 premiers coups sont évalués par Stockfish (MultiPV 2, puis « searchmoves » si le coup joué
 * n'est pas parmi les deux meilleurs). Les évaluations sont mises en cache par position : une ouverture
 * jouée souvent n'est calculée qu'une fois.
 */
const { epd } = require('../core/openings');
const { moveLoss } = require('../core/scoring');
const { movesToAnalyze } = require('../core/repertoire');

const DEPTHS = [10, 12, 14, 16, 18];
const DEFAULT_SETTINGS = { depth: 12, nombre: 50 };
const ANALYSIS_VERSION = 1;
const CACHE_MAX = 50000;

/** Évalue un coup joué dans une position : meilleurs coups, score du coup joué et perte. */
async function analyzePosition(engine, fen, uci, depth, cache, signal) {
  const key = `${depth}|${epd(fen)}`;
  let lines = cache.get(key);
  if (!lines) {
    const r = await engine.search({ fen, depth, multipv: 2, signal });
    lines = r.lines.filter((l) => l.pv && l.pv.length && l.score).map((l) => ({ uci: l.pv[0], score: l.score, pv: l.pv.slice(0, 12) }));
    cache.set(key, lines);
  }
  const best = lines[0];
  if (!best) return null;
  const second = lines[1] || null;
  const inLines = lines.find((l) => l.uci === uci);
  let playedScore = inLines ? inLines.score : cache.get(`${key}|${uci}`);
  if (!playedScore) {
    const r = await engine.search({ fen, depth, multipv: 1, searchmoves: [uci], signal });
    playedScore = r.lines[0] && r.lines[0].score;
    if (!playedScore) return null;
    cache.set(`${key}|${uci}`, playedScore);
  }
  return { best, second, played: { score: playedScore }, loss: moveLoss(best.score, playedScore) };
}

/** Analyse d'une partie (info = gameOpening). */
async function analyzeGame(engine, info, depth, cache, signal) {
  const moves = [];
  for (const p of movesToAnalyze(info)) {
    if (signal && signal.aborted) throw new Error('annulé');
    const r = await analyzePosition(engine, p.fenBefore, p.uci, depth, cache, signal);
    if (!r) continue;
    moves.push({ ply: p.ply, fen: p.fenBefore, uci: p.uci, san: p.san, best: r.best, second: r.second, played: r.played, loss: r.loss });
  }
  return { version: ANALYSIS_VERSION, depth, analysedAt: Date.now(), moves };
}

function createAnalyzer({ store, engineRef, infosFor }) {
  let job = { status: 'idle' };
  let controller = null;
  const raw = store.loadCache('evaluations', {});
  const cache = new Map(Object.entries(raw));
  const saveCache = () => {
    // On garde les entrées les plus récentes si le cache devient trop gros.
    const entries = [...cache.entries()];
    const kept = entries.length > CACHE_MAX ? entries.slice(entries.length - CACHE_MAX) : entries;
    store.saveCache('evaluations', Object.fromEntries(kept));
  };

  /** Parties à analyser : les plus récentes, filtrées par cadence, sans celles déjà analysées à cette profondeur. */
  function pick(username, { nombre, cadence, depth }) {
    const analyses = store.loadAnalyses(username);
    const infos = infosFor(username).filter((i) => !cadence || i.timeClass === cadence).sort((a, b) => (b.endTime || 0) - (a.endTime || 0)).slice(0, nombre);
    const todo = infos.filter((i) => { const a = analyses[i.gameId]; return !a || a.version !== ANALYSIS_VERSION || a.depth < depth; });
    return { todo, already: infos.length - todo.length };
  }

  async function run(username, todo, depth, signal) {
    const engine = engineRef();
    for (const info of todo) {
      if (signal.aborted) throw new Error('annulé');
      job.current = info.opening.name || info.opening.family;
      job.message = `Partie ${job.done + 1}/${job.total} : ${job.current}`;
      const a = await analyzeGame(engine, info, depth, cache, signal);
      const all = store.loadAnalyses(username);
      all[info.gameId] = a;
      store.saveAnalyses(username, all);
      saveCache();
      job.done++;
      job.positions += a.moves.length;
    }
  }

  return {
    DEPTHS,
    status: () => ({ ...job }),
    pick,
    start(username, opts) {
      if (job.status === 'running') throw new Error('Une analyse est déjà en cours');
      const depth = DEPTHS.includes(opts.depth) ? opts.depth : DEFAULT_SETTINGS.depth;
      const nombre = Math.max(1, Math.min(2000, parseInt(opts.nombre, 10) || DEFAULT_SETTINGS.nombre));
      const { todo, already } = pick(username, { nombre, cadence: opts.cadence || null, depth });
      controller = new AbortController();
      const signal = controller.signal;
      job = { status: 'running', username, depth, total: todo.length, done: 0, already, positions: 0, startedAt: Date.now(), message: 'Démarrage…' };
      if (!todo.length) {
        job.status = 'done';
        job.message = already ? `Les ${already} partie(s) choisie(s) sont déjà analysées.` : 'Aucune partie à analyser : importez d’abord vos parties.';
        return this.status();
      }
      run(username, todo, depth, signal).then(() => {
        job.status = 'done';
        job.message = `Analyse terminée : ${job.done} partie(s), ${job.positions} coup(s) hors théorie évalués.`;
      }, (e) => {
        job.status = signal.aborted ? 'cancelled' : 'error';
        job.error = signal.aborted ? null : e.message;
        job.message = signal.aborted ? `Analyse interrompue (${job.done}/${job.total} parties conservées).` : `Analyse arrêtée : ${e.message}`;
      });
      return this.status();
    },
    cancel() { if (controller) controller.abort(); },
    /** Score (point de vue du joueur au trait) d'un coup dans une position, à la profondeur donnée. */
    async scoreMove(fen, uci, depth) {
      const key = `${depth}|${epd(fen)}|${uci}`;
      if (cache.has(key)) return cache.get(key);
      const r = await engineRef().search({ fen, depth, multipv: 1, searchmoves: [uci], priority: true });
      const score = r.lines[0] && r.lines[0].score;
      if (score) { cache.set(key, score); saveCache(); }
      return score || null;
    },
    async close() { if (controller) controller.abort(); },
  };
}

module.exports = { createAnalyzer, analyzePosition, analyzeGame, DEPTHS, DEFAULT_SETTINGS, ANALYSIS_VERSION };
