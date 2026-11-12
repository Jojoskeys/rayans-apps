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
  // Position avec un coup évident (reprendre la dame) pour que le résultat soit stable.
  const fen2 = 'rnb1kbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBqKBNR w KQkq - 0 3';
  const r2 = await analyzePosition(e, fen2, 'e1d1', { depth: 22 });
  assert.equal(r2.best.uci, 'e1d1');
  assert.equal(r2.played.source, 'ligne 1 (MultiPV)');
  assert.deepEqual(r2.played.score, r2.best.score);
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

test('plantage du moteur : relance automatique puis mode prudent', { skip: process.platform === 'win32' && 'script shebang', timeout: 30000 }, async (t) => {
  const os = require('os');
  const { withRecovery } = require('../../src/server/analyzer');
  const fake = path.join(__dirname, '..', 'fixtures', 'faux-moteur.js');
  const counter = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'faux-')), 'n');
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  // 1 plantage : la relance suffit.
  process.env.FAUX_MOTEUR_COMPTEUR = counter; process.env.FAUX_MOTEUR_PLANTAGES = '1';
  let e = new Engine(fake, { threads: 4, hash: 256 });
  t.after(() => e.stop());
  let fallback = null;
  const r = await withRecovery(e, () => analyzePosition(e, fen, 'e2e4', { depth: 22 }), (err) => { fallback = err; });
  assert.equal(r.best.uci, 'e2e4');
  assert.equal(fallback, null);
  assert.equal(e.threads, 4);
  // 2 plantages : passage en mode prudent (1 fil, 64 Mo) avec le code de sortie dans le message.
  fs.writeFileSync(counter, '0'); process.env.FAUX_MOTEUR_PLANTAGES = '2';
  e.stop(); e = new Engine(fake, { threads: 4, hash: 256 });
  const r2 = await withRecovery(e, () => analyzePosition(e, fen, 'd2d4', { depth: 22 }), (err) => { fallback = err; });
  assert.equal(r2.played.source, 'ligne 2 (MultiPV)');
  assert.match(fallback.message, /code 3.*Illegal instruction/s);
  assert.equal(e.threads, 1);
  assert.equal(e.hash, 64);
  // Plantage persistant : erreur remontée.
  fs.writeFileSync(counter, '0'); process.env.FAUX_MOTEUR_PLANTAGES = '9';
  await assert.rejects(withRecovery(e, () => analyzePosition(e, fen, 'e2e4', { depth: 22 })), /arrêté de façon inattendue/);
  e.stop();
});
