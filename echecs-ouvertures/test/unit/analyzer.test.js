'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('../../src/core/repertoire');
const { analyzeGame, analyzePosition, createAnalyzer } = require('../../src/server/analyzer');
const { createStore } = require('../../src/server/store');
const { openings, game, fakeEngine } = require('../helpers');

const NAJDORF_QH5 = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Qh5', 'e6', 'Qe2'];

test('analyse d’une partie : seuls les coups du joueur hors théorie, avec perte', async () => {
  const e = fakeEngine();
  const info = R.gameOpening(game(NAJDORF_QH5), 'moi', openings);
  const cache = new Map();
  const a = await analyzeGame(e, info, 12, cache);
  assert.equal(a.depth, 12);
  assert.deepEqual(a.moves.map((m) => m.san), ['Qh5', 'Qe2']);
  const qh5 = a.moves[0];
  assert.equal(qh5.ply, 11);
  assert.ok(qh5.best.uci && qh5.second.uci);
  assert.deepEqual(qh5.played.score, { cp: -200 });
  assert.ok(qh5.loss > 19 && qh5.loss < 21, `perte ${qh5.loss}`);
  assert.equal(e.searches, 4, 'MultiPV puis searchmoves pour chaque coup');
  // Même partie : tout vient du cache.
  await analyzeGame(e, info, 12, cache);
  assert.equal(e.searches, 4);
});

test('coup joué parmi les deux meilleurs : pas de recherche complémentaire', async () => {
  const e = fakeEngine();
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const r1 = await analyzePosition(e, fen, 'x', 10, new Map());
  const first = r1.best.uci;
  const r = await analyzePosition(e, fen, first, 10, new Map());
  assert.equal(r.loss, 0);
  const r2 = await analyzePosition(e, fen, r.second.uci, 10, new Map());
  assert.ok(r2.loss > 0 && r2.loss < 2);
  assert.equal(e.searches, 2 + 1 + 1);
});

test('tâche d’analyse en arrière-plan : parties récentes, filtre de cadence, reprise sans refaire', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ro-an-'));
  const store = createStore(dir);
  const games = [game(NAJDORF_QH5, { timeClass: 'blitz' }), game(['d4', 'd5', 'c4', 'e6', 'Qd3'], { timeClass: 'rapid' }), game(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Qe2'], { timeClass: 'blitz' })];
  const infos = games.map((g) => R.gameOpening(g, 'moi', openings));
  const e = fakeEngine();
  const an = createAnalyzer({ store, engineRef: () => e, infosFor: () => infos });
  const wait = async () => { while (an.status().status === 'running') await new Promise((r) => setTimeout(r, 5)); };
  an.start('moi', { nombre: 10, cadence: 'blitz', depth: 12 });
  await wait();
  assert.equal(an.status().status, 'done');
  assert.equal(an.status().done, 2);
  const saved = store.loadAnalyses('moi');
  assert.deepEqual(Object.keys(saved).sort(), [games[0].id, games[2].id].sort());
  const st = an.start('moi', { nombre: 10, depth: 12 });
  assert.equal(st.total, 1, 'les parties déjà analysées ne sont pas refaites');
  await wait();
  assert.equal(Object.keys(store.loadAnalyses('moi')).length, 3);
  const deeper = an.start('moi', { nombre: 1, depth: 14 });
  assert.equal(deeper.total, 1, 'profondeur plus grande : la partie la plus récente est refaite');
  await wait();
  assert.ok(fs.existsSync(path.join(dir, 'cache', 'evaluations.json')), 'cache des évaluations sur disque');
});
