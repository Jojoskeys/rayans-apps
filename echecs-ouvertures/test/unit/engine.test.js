'use strict';
// Tests avec le vrai binaire Stockfish (vendor/stockfish). Ignorés si le binaire est absent.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Engine, parseInfo } = require('../../src/server/engine');
const { analyzeGame } = require('../../src/server/analyzer');
const R = require('../../src/core/repertoire');
const { openings, game } = require('../helpers');

const BIN = path.join(__dirname, '..', '..', 'vendor', 'stockfish', process.platform === 'win32' ? 'stockfish.exe' : 'stockfish');
const skip = !fs.existsSync(BIN) && 'binaire Stockfish absent (npm run fetch:stockfish)';

test('lecture des lignes info UCI', () => {
  const i = parseInfo('info depth 22 seldepth 30 multipv 2 score mate -3 nodes 10 pv e2e4 e7e5');
  assert.deepEqual(i.score, { mate: -3 });
  assert.equal(i.multipv, 2);
  assert.deepEqual(i.pv, ['e2e4', 'e7e5']);
});

test('Stockfish réel : une dame offerte dans l’ouverture est une gaffe, le meilleur coup est accepté', { skip, timeout: 120000 }, async (t) => {
  const e = new Engine(BIN, { threads: 2, hash: 32 });
  t.after(() => e.stop());
  await e.start();
  assert.match(e.name, /^Stockfish \d+/);
  // 1. e4 e5 2. Dh5 Cc6 3. Dxe5+?? Cxe5 : la dame blanche est perdue.
  const info = R.gameOpening(game(['e4', 'e5', 'Qh5', 'Nc6', 'Qxe5+', 'Nxe5']), 'moi', openings);
  const a = await analyzeGame(e, info, 12, new Map());
  const blunder = a.moves.find((m) => m.san === 'Qxe5+');
  assert.ok(blunder, JSON.stringify(a.moves.map((m) => m.san)));
  assert.equal(R.categoryOf(blunder.loss), 'gaffe');
  const [d] = R.buildDrills([{ info, analysis: a }], openings);
  assert.equal(d.ply, 5);
  assert.equal(R.quickCheck(d, 'h5e5').accepted, false);
  assert.equal(R.quickCheck(d, d.best.uci).accepted, true);
});
