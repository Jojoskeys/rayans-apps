'use strict';
// Tests avec le vrai binaire Stockfish (vendor/stockfish). Ignorés si le binaire est absent.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Engine, parseInfo } = require('../../src/server/engine');
const { analyzePosition } = require('../../src/server/analyzer');
const { classifyPly } = require('../../src/core/classify');
const { toWhite } = require('../../src/core/report');

const BIN = path.join(__dirname, '..', '..', 'vendor', 'stockfish', process.platform === 'win32' ? 'stockfish.exe' : 'stockfish');
const skip = !fs.existsSync(BIN) && 'binaire Stockfish absent (npm run fetch:stockfish)';

test('lecture des lignes info UCI', () => {
  const i = parseInfo('info depth 22 seldepth 30 multipv 2 score mate -3 nodes 10 pv e2e4 e7e5');
  assert.deepEqual(i.score, { mate: -3 });
  assert.equal(i.multipv, 2);
  assert.deepEqual(i.pv, ['e2e4', 'e7e5']);
  assert.equal(parseInfo('info depth 5 score cp 20 lowerbound nodes 1 pv e2e4').bound, 'lowerbound');
});

test('moteur natif : version, coup absent des deux lignes → searchmoves à la même profondeur', { skip, timeout: 120000 }, async (t) => {
  const e = new Engine(BIN, { threads: 2, hash: 64 });
  t.after(() => e.stop());
  await e.start();
  assert.match(e.name, /^Stockfish \d+/);
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const r = await analyzePosition(e, fen, 'f2f3', { depth: 22 });
  assert.equal(r.best.depth, 22);
  assert.equal(r.second.depth, 22);
  assert.notEqual(r.best.uci, 'f2f3');
  assert.notEqual(r.second.uci, 'f2f3');
  assert.equal(r.played.source, 'recherche complémentaire searchmoves');
  assert.equal(r.played.uci, 'f2f3');
  assert.equal(r.played.pv[0], 'f2f3');
  assert.equal(r.played.depth, 22);
  assert.ok(r.played.score.cp < r.best.score.cp);
  // Coup présent dans la ligne 1 : score réutilisé, pas de recherche complémentaire.
  // Coup présent dans une des deux lignes : score réutilisé, sans recherche complémentaire.
  // (Recherche multi-fils non déterministe : e4 et d4 peuvent échanger leur rang d'une recherche à l'autre.)
  const r2 = await analyzePosition(e, fen, r.best.uci, { depth: 22 });
  assert.match(r2.played.source, /^ligne [12] \(MultiPV\)$/);
});

test('orientation des scores pour les Noirs et mats (moteur réel)', { skip, timeout: 120000 }, async (t) => {
  const e = new Engine(BIN, { threads: 2, hash: 64 });
  t.after(() => e.stop());
  // Noirs au trait avec une dame de plus : score positif du point de vue des Noirs.
  const fen = '4k3/8/8/8/8/8/3q4/4K3 b - - 0 1'.replace('3q4/4K3', '8/q3K3');
  const r = await analyzePosition(e, '3qk3/8/8/8/8/8/8/4K3 b - - 0 1', 'd8d7', { depth: 12 });
  assert.ok(r.best.score.mate > 0 || r.best.score.cp > 500, JSON.stringify(r.best.score));
  const w = toWhite(r.best.score, 'b');
  assert.ok(w.mate < 0 || w.cp < -500, 'du point de vue des Blancs, le score est négatif');
  // Les Noirs lâchent leur dame : grosse perte de leur point de vue.
  const g = await analyzePosition(e, '3qk3/8/8/8/8/8/8/3QK3 b - - 0 1', 'd8d2', { depth: 12 });
  assert.equal(g.played.source, 'recherche complémentaire searchmoves');
  const cls = classifyPly({ uci: 'd8d2', fenBefore: '3qk3/8/8/8/8/8/8/3QK3 b - - 0 1', legalCount: g.legalCount, best: g.best, second: g.second, played: g.played });
  assert.equal(cls.category, 'gaffe');
  // Mat en 1 disponible pour les Blancs.
  const m = await analyzePosition(e, '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1a8', { depth: 12 });
  assert.equal(m.best.uci, 'a1a8');
  assert.deepEqual(m.best.score, { mate: 1 });
  // Positions terminales : mat et pat traités sans moteur.
  const mated = await analyzePosition(e, 'R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1', null, { depth: 12 });
  assert.equal(mated.terminal, 'mat');
  assert.deepEqual(mated.finalScore, { mate: 0 });
  const pat = await analyzePosition(e, '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', null, { depth: 12 });
  assert.equal(pat.terminal, 'pat');
  assert.ok(fen);
  e.stop();
});

test('annulation d’une recherche en cours', { skip, timeout: 60000 }, async (t) => {
  const e = new Engine(BIN, { threads: 1, hash: 16 });
  t.after(() => e.stop());
  const ctrl = new AbortController();
  const p = e.search({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', depth: 60, multipv: 2, signal: ctrl.signal });
  setTimeout(() => ctrl.abort(), 300);
  await assert.rejects(p, (err) => err.cancelled === true);
  const r = await e.search({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', depth: 6, multipv: 1 });
  assert.ok(r.bestmove, 'le moteur reste utilisable après une annulation');
  e.stop();
});
