'use strict';
/** Outils d'échecs partagés (serveur et interface), basés sur chess.js. Repris d'Analyse Échecs. */
const { Chess } = require('chess.js');

const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function uciToObj(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined };
}

function moveToUci(m) {
  return m.from + m.to + (m.promotion || '');
}

/** Joue légalement une suite de coups UCI. Renvoie { sans, fens, valid }. */
function playUciLine(fen, ucis, max = Infinity) {
  const c = new Chess(fen);
  const sans = [];
  const fens = [];
  let valid = true;
  for (const u of (ucis || []).slice(0, max)) {
    let m;
    try { m = c.move(uciToObj(u)); } catch (e) { m = null; }
    if (!m) { valid = false; break; }
    sans.push(m.san);
    fens.push(c.fen());
  }
  return { sans, fens, valid };
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

/** Numéro de coup affiché pour un demi-coup (1 → « 1. », 2 → « 1… »). */
function moveLabel(ply) {
  return `${Math.ceil(ply / 2)}${ply % 2 === 1 ? '.' : '…'}`;
}

module.exports = { Chess, STANDARD_FEN, uciToObj, moveToUci, playUciLine, frSan, formatLine, moveLabel };
