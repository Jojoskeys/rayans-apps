'use strict';
/** Outils d'échecs partagés (serveur et interface), basés sur chess.js. */
const { Chess } = require('chess.js');

const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAMES = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
const NAMES_ART = { p: 'le pion', n: 'le cavalier', b: 'le fou', r: 'la tour', q: 'la dame', k: 'le roi' };
const NAMES_DE = { p: 'du pion', n: 'du cavalier', b: 'du fou', r: 'de la tour', q: 'de la dame', k: 'du roi' };
const FILES = 'abcdefgh';

function uciToObj(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined };
}

function moveToUci(m) {
  return m.from + m.to + (m.promotion || '');
}

/**
 * Normalise un coup UCI de roque exprimé « roi prend tour » (format Chess960 / Lichess cloud :
 * e1h1) vers le format standard (e1g1), uniquement si c'est bien un roque dans la position.
 */
function normalizeCastlingUci(fen, uci) {
  const c = new Chess(fen);
  const p = c.get(uci.slice(0, 2));
  if (!p || p.type !== 'k') return uci;
  const map = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' };
  const target = c.get(uci.slice(2, 4));
  if (map[uci] && target && target.type === 'r' && target.color === p.color) return map[uci];
  return uci;
}

/** Joue légalement une suite de coups UCI. Renvoie { sans, moves, fens, valid }. */
function playUciLine(fen, ucis, max = Infinity) {
  const c = new Chess(fen);
  const sans = [];
  const moves = [];
  const fens = [];
  let valid = true;
  for (const u of (ucis || []).slice(0, max)) {
    let m;
    try {
      m = c.move(uciToObj(u));
    } catch (e) {
      m = null;
    }
    if (!m) { valid = false; break; }
    sans.push(m.san);
    moves.push(m);
    fens.push(c.fen());
  }
  return { sans, moves, fens, valid, final: c };
}

/** Notation algébrique française : C cavalier, F fou, T tour, D dame, R roi. */
const FR = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' };
function frSan(san) { return san ? String(san).replace(/[KQRBN]/g, (c) => FR[c]) : san; }

/** Formate une variante en notation algébrique numérotée (française) à partir d'un FEN. */
function formatLine(fen, sans) {
  const parts = fen.split(' ');
  let moveNo = parseInt(parts[5], 10) || 1;
  let white = parts[1] === 'w';
  const out = [];
  sans.forEach((san, i) => {
    const f = frSan(san);
    if (white) out.push(`${moveNo}. ${f}`);
    else out.push(i === 0 ? `${moveNo}... ${f}` : f);
    if (!white) moveNo += 1;
    white = !white;
  });
  return out.join(' ');
}

/** Bilan matériel (blancs - noirs) en points. */
function materialBalance(chess) {
  let s = 0;
  for (const row of chess.board()) for (const sq of row) {
    if (sq) s += (sq.color === 'w' ? 1 : -1) * VALUES[sq.type];
  }
  return s;
}

function pieceCount(fen) {
  return fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
}

function sqToXY(sq) { return [FILES.indexOf(sq[0]), parseInt(sq[1], 10) - 1]; }
function xyToSq(x, y) { return FILES[x] + (y + 1); }

/** Cases attaquées par la pièce située en `sq` (géométrie pure, indépendante du trait). */
function attackedSquares(chess, sq) {
  const p = chess.get(sq);
  if (!p) return [];
  const [x, y] = sqToXY(sq);
  const out = [];
  const inside = (a, b) => a >= 0 && a < 8 && b >= 0 && b < 8;
  const steps = (dirs, slide) => {
    for (const [dx, dy] of dirs) {
      let a = x + dx; let b = y + dy;
      while (inside(a, b)) {
        const s = xyToSq(a, b);
        out.push(s);
        if (!slide || chess.get(s)) break;
        a += dx; b += dy;
      }
    }
  };
  const diag = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const ortho = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  switch (p.type) {
    case 'p': {
      const dy = p.color === 'w' ? 1 : -1;
      for (const dx of [-1, 1]) if (inside(x + dx, y + dy)) out.push(xyToSq(x + dx, y + dy));
      break;
    }
    case 'n': steps([[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]], false); break;
    case 'b': steps(diag, true); break;
    case 'r': steps(ortho, true); break;
    case 'q': steps(diag.concat(ortho), true); break;
    case 'k': steps(diag.concat(ortho), false); break;
    default: break;
  }
  return out;
}

/** Une pièce est-elle défendue par son camp ? (géométrie, ignore les clouages) */
function isDefended(chess, sq) {
  const p = chess.get(sq);
  if (!p) return false;
  for (const row of chess.board()) for (const q of row) {
    if (q && q.color === p.color && q.square !== sq && attackedSquares(chess, q.square).includes(sq)) return true;
  }
  return false;
}

function attackersOf(chess, sq, byColor) {
  const res = [];
  for (const row of chess.board()) for (const q of row) {
    if (q && q.color === byColor && attackedSquares(chess, q.square).includes(sq)) res.push(q);
  }
  return res;
}

function sideName(color) { return color === 'w' ? 'les Blancs' : 'les Noirs'; }

module.exports = {
  Chess, STANDARD_FEN, VALUES, NAMES, NAMES_ART, NAMES_DE, frSan,
  uciToObj, moveToUci, normalizeCastlingUci, playUciLine, formatLine, materialBalance, pieceCount,
  attackedSquares, isDefended, attackersOf, sideName,
};
