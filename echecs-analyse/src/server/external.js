'use strict';
/**
 * Services externes facultatifs : Lichess cloud-eval et table de finales Lichess.
 * Toute absence de réponse, limitation (429) ou panne est silencieuse : l'analyse locale continue.
 * Après une limitation, le service est mis en pause quelques minutes.
 */
const { normalizeCastlingUci, pieceCount, Chess } = require('../core/chessutil');

const USER_AGENT = 'AnalyseEchecs/1.0 (application de bureau locale)';

function createExternal(fetchImpl, opts = {}) {
  const timeoutMs = opts.timeoutMs || 6000;
  const pausedUntil = { cloud: 0, tb: 0 };
  const stats = { cloud: { ok: 0, miss: 0, err: 0 }, tb: { ok: 0, miss: 0, err: 0 } };

  async function get(kind, url) {
    if (Date.now() < pausedUntil[kind]) return { status: 'paused' };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: ctrl.signal });
      if (r.status === 429) { pausedUntil[kind] = Date.now() + 5 * 60 * 1000; stats[kind].err++; return { status: 'rate-limited' }; }
      if (r.status === 404) { stats[kind].miss++; return { status: 'missing' }; }
      if (!r.ok) { stats[kind].err++; if (r.status >= 500) pausedUntil[kind] = Date.now() + 60 * 1000; return { status: 'error' }; }
      stats[kind].ok++;
      return { status: 'ok', data: await r.json() };
    } catch (e) {
      stats[kind].err++;
      pausedUntil[kind] = Date.now() + 30 * 1000;
      return { status: 'error' };
    } finally { clearTimeout(t); }
  }

  /** Évaluation cloud, convertie au point de vue du joueur au trait. */
  async function cloudEval(fen, multiPv = 2) {
    const r = await get('cloud', `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`);
    if (r.status !== 'ok' || !r.data || !Array.isArray(r.data.pvs)) return { status: r.status };
    const white = fen.split(' ')[1] === 'w';
    const lines = r.data.pvs.map((pv) => {
      const moves = (pv.moves || '').split(' ').filter(Boolean);
      if (moves.length) moves[0] = normalizeCastlingUci(fen, moves[0]);
      let score;
      if (typeof pv.mate === 'number') score = { mate: white ? pv.mate : -pv.mate };
      else score = { cp: white ? pv.cp : -pv.cp };
      return { score, pv: normalizeLine(fen, moves) };
    });
    return { status: 'ok', depth: r.data.depth, knodes: r.data.knodes, lines, source: 'Lichess cloud-eval' };
  }

  /** Table de finales (≤ 7 pièces, sans roque). Catégories converties au point de vue du joueur au trait. */
  async function tablebase(fen) {
    if (pieceCount(fen) > 7) return { status: 'not-applicable' };
    const castling = fen.split(' ')[2];
    if (castling && castling !== '-') return { status: 'not-applicable' };
    const r = await get('tb', `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen.replace(/ /g, '_'))}`);
    if (r.status !== 'ok' || !r.data || !r.data.category) return { status: r.status };
    const invert = { win: 'loss', loss: 'win', 'cursed-win': 'blessed-loss', 'blessed-loss': 'cursed-win', 'maybe-win': 'maybe-loss', 'maybe-loss': 'maybe-win', 'syzygy-win': 'syzygy-loss', 'syzygy-loss': 'syzygy-win', draw: 'draw', unknown: 'unknown' };
    return {
      status: 'ok',
      source: 'Table de finales Lichess',
      category: r.data.category,
      dtz: r.data.dtz,
      dtm: r.data.dtm,
      moves: (r.data.moves || []).map((m) => ({ uci: m.uci, san: m.san, category: invert[m.category] || 'unknown', dtz: m.dtz, dtm: m.dtm })),
    };
  }

  return { cloudEval, tablebase, stats };
}

/** Normalise les roques d'une variante entière (format e1h1 → e1g1). */
function normalizeLine(fen, moves) {
  const c = new Chess(fen);
  const out = [];
  for (let u of moves) {
    u = normalizeCastlingUci(c.fen(), u);
    try { if (!c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })) break; } catch (e) { break; }
    out.push(u);
  }
  return out;
}

module.exports = { createExternal, USER_AGENT };
