'use strict';
/**
 * Validation des parties Chess.com importées et déduplication.
 * Seules les parties standard terminées avec un résultat établi et cohérent sont conservées.
 */
const { Chess, STANDARD_FEN } = require('./chessutil');

const WIN = 'win';
const LOSS_CODES = new Set(['checkmated', 'resigned', 'timeout', 'abandoned', 'lose']);
const DRAW_CODES = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);
const VALID_RESULTS = new Set(['1-0', '0-1', '1/2-1/2']);

const REJECT = {
  variant: 'variante non prise en charge',
  setup: 'position de départ non standard',
  ongoing: 'partie en cours ou résultat absent',
  undetermined: 'résultat indéterminé',
  incoherent: 'résultat incohérent avec le PGN',
  pgn: 'PGN invalide',
  noid: 'identifiant manquant',
};

function stableId(g) {
  if (g && typeof g.uuid === 'string' && g.uuid) return g.uuid;
  if (g && typeof g.url === 'string' && g.url) {
    const m = g.url.match(/\/game\/(?:live|daily)\/(\d+)/);
    return m ? `url-${m[0].includes('daily') ? 'daily' : 'live'}-${m[1]}` : `url-${g.url}`;
  }
  return null;
}

function expectedResult(white, black) {
  const w = white && white.result;
  const b = black && black.result;
  if (!w || !b) return null;
  if (w === WIN && LOSS_CODES.has(b)) return '1-0';
  if (b === WIN && LOSS_CODES.has(w)) return '0-1';
  if (DRAW_CODES.has(w) && DRAW_CODES.has(b)) return '1/2-1/2';
  return null;
}

/**
 * Valide une partie brute de l'API Chess.com.
 * @returns {{ ok: true, game: object } | { ok: false, reason: string, code: string }}
 */
function validateGame(g) {
  const id = stableId(g);
  if (!id) return { ok: false, code: 'noid', reason: REJECT.noid };
  if (g.rules !== 'chess') return { ok: false, code: 'variant', reason: REJECT.variant };
  if (g.initial_setup && g.initial_setup.trim() !== STANDARD_FEN) return { ok: false, code: 'setup', reason: REJECT.setup };
  if (!g.white || !g.black || !g.pgn || typeof g.pgn !== 'string') return { ok: false, code: 'ongoing', reason: REJECT.ongoing };

  const expected = expectedResult(g.white, g.black);
  if (!expected) return { ok: false, code: 'undetermined', reason: REJECT.undetermined };

  const chess = new Chess();
  try {
    chess.loadPgn(g.pgn);
  } catch (e) {
    return { ok: false, code: 'pgn', reason: REJECT.pgn };
  }
  const headers = chess.getHeaders();
  if (headers.SetUp === '1' || (headers.FEN && headers.FEN !== STANDARD_FEN)) {
    return { ok: false, code: 'setup', reason: REJECT.setup };
  }
  if (headers.Variant && headers.Variant.toLowerCase() !== 'standard') return { ok: false, code: 'variant', reason: REJECT.variant };
  const result = headers.Result;
  if (!result || result === '*') return { ok: false, code: 'ongoing', reason: REJECT.ongoing };
  if (!VALID_RESULTS.has(result)) return { ok: false, code: 'undetermined', reason: REJECT.undetermined };
  if (result !== expected) return { ok: false, code: 'incoherent', reason: REJECT.incoherent };

  // Cohérence avec la position finale.
  const loser = chess.turn();
  if (chess.isCheckmate()) {
    const mateResult = loser === 'w' ? '0-1' : '1-0';
    if (result !== mateResult) return { ok: false, code: 'incoherent', reason: REJECT.incoherent };
  } else {
    if (g.white.result === 'checkmated' || g.black.result === 'checkmated') {
      return { ok: false, code: 'incoherent', reason: REJECT.incoherent };
    }
  }
  if (chess.isStalemate() && result !== '1/2-1/2') return { ok: false, code: 'incoherent', reason: REJECT.incoherent };
  if ((g.white.result === 'stalemate' || g.black.result === 'stalemate') && !chess.isStalemate()) {
    return { ok: false, code: 'incoherent', reason: REJECT.incoherent };
  }

  const history = chess.history({ verbose: true });
  const game = {
    id,
    url: g.url || null,
    pgn: g.pgn,
    endTime: g.end_time || null,
    timeClass: g.time_class || null,
    timeControl: g.time_control || null,
    rated: !!g.rated,
    result,
    white: { username: g.white.username, rating: g.white.rating || null, result: g.white.result },
    black: { username: g.black.username, rating: g.black.rating || null, result: g.black.result },
    plyCount: history.length,
    termination: headers.Termination || null,
    date: headers.UTCDate || headers.Date || null,
  };
  return { ok: true, game };
}

/** Fusionne des parties dans un index { id: game } sans doublon. Renvoie le nombre d'ajouts. */
function mergeGames(index, games) {
  let added = 0;
  for (const g of games) {
    if (!g || !g.id) continue;
    if (!Object.prototype.hasOwnProperty.call(index, g.id)) added += 1;
    index[g.id] = g;
  }
  return added;
}

/** Positions successives d'une partie (pour l'interface et l'analyse). */
function gamePositions(pgn) {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const headers = chess.getHeaders();
  const moves = chess.history({ verbose: true });
  return {
    headers,
    plies: moves.map((m, i) => ({
      ply: i + 1,
      san: m.san,
      uci: m.from + m.to + (m.promotion || ''),
      color: m.color,
      fenBefore: m.before,
      fenAfter: m.after,
    })),
  };
}

module.exports = { validateGame, mergeGames, stableId, expectedResult, gamePositions, REJECT, LOSS_CODES, DRAW_CODES };
