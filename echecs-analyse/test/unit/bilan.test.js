'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { phasesOf, rawPhase } = require('../../src/core/phases');
const { summarizeGame, aggregateBilan, pooledAccuracy } = require('../../src/core/bilan');
const { playerAccuracy } = require('../../src/core/scoring');
const { gamePositions } = require('../../src/core/games');

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

test('phases : départ = ouverture, coup 16 = milieu, ≤ 6 pièces = finale, jamais de retour', () => {
  assert.equal(rawPhase(START), 0);
  assert.equal(rawPhase(START.replace(' 0 1', ' 0 16')), 1);
  assert.equal(rawPhase('r3k2r/pppqbppp/2npbn2/8/8/2NPBN2/PPPQBPPP/R3K2R w KQkq - 0 8'), 1, 'premières rangées dégarnies');
  assert.equal(rawPhase('4k3/8/8/8/8/8/8/R2QK2R w - - 0 40'), 2);
  const ph = phasesOf([{ fenBefore: START }, { fenBefore: '4k3/8/8/8/8/8/8/4K3 w - - 0 40' }, { fenBefore: START }]);
  assert.deepEqual(ph, ['ouverture', 'finale', 'finale']);
});

function fakeReport(pgn, lossesW, lossesB, cats) {
  const pos = gamePositions(pgn);
  const lw = [...lossesW]; const lb = [...lossesB];
  const plies = pos.plies.map((p, i) => {
    const loss = p.color === 'w' ? lw.shift() : lb.shift();
    return { ...p, classification: { category: cats[i] || 'excellent', loss } };
  });
  return {
    plies,
    players: { w: { accuracy: playerAccuracy(lossesW).accuracy }, b: { accuracy: playerAccuracy(lossesB).accuracy } },
    analysis: { settings: { depth: 18 } },
  };
}

test('bilan : résumé d’une partie, agrégation par cadence, couleur, phase et période', () => {
  const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *';
  const g1 = { id: 'g1', endTime: Date.UTC(2025, 0, 5) / 1000, timeClass: 'blitz', rated: true, result: '1-0', white: { username: 'Moi', rating: 1500 }, black: { username: 'X', rating: 1500 } };
  const g2 = { ...g1, id: 'g2', endTime: Date.UTC(2025, 1, 5) / 1000, timeClass: 'rapid', result: '1-0', white: { username: 'Y', rating: 1500 }, black: { username: 'moi', rating: 1500 } };
  const s1 = summarizeGame(g1, fakeReport(pgn, [0, 30, 1], [0, 0, 0], { 2: 'gaffe' }));
  const s2 = summarizeGame(g2, fakeReport(pgn, [0, 0, 0], [5, 15, 0], { 3: 'erreur', 1: 'bon' }));
  assert.equal(s1.depth, 18);
  assert.equal(s1.sides.w.moves, 3);
  assert.equal(s1.sides.w.counts.gaffe, 1);
  assert.equal(s1.sides.w.phases.ouverture.n, 3);

  const b = aggregateBilan([s1, s2], 'MOI');
  assert.equal(b.overall.games, 2);
  assert.equal(b.overall.gaffesPerGame, 0.5);
  assert.equal(b.overall.erreursPerGame, 0.5);
  assert.deepEqual([b.overall.wins, b.overall.losses], [1, 1]);
  const expectedMean = (playerAccuracy([0, 30, 1]).accuracy + playerAccuracy([5, 15, 0]).accuracy) / 2;
  assert.ok(Math.abs(b.overall.accuracy - expectedMean) < 1e-9);
  assert.deepEqual(b.byPeriod.map((p) => [p.key, p.games]), [['2025-01', 1], ['2025-02', 1]]);
  assert.deepEqual(b.byTimeClass.map((p) => p.key), ['blitz', 'rapid']);
  assert.deepEqual(b.byColor.map((p) => [p.key, p.games]), [['b', 1], ['w', 1]]);
  const op = b.byPhase.find((p) => p.phase === 'ouverture');
  assert.equal(op.moves, 6);
  assert.ok(Math.abs(op.accuracy - playerAccuracy([0, 30, 1, 5, 15, 0]).accuracy) < 1e-9, 'précision de phase = formule appliquée à tous les coups de la phase');
  assert.ok(Math.abs(op.gaffesPer100 - 100 / 6) < 1e-9);
  assert.deepEqual(b.depths, { 18: 2 });
  assert.equal(b.worst[0].id, 'g1');

  const blancs = aggregateBilan([s1, s2], 'moi', { color: 'w' });
  assert.equal(blancs.overall.games, 1);
  assert.equal(aggregateBilan([s1, s2], 'moi', { timeClass: 'rapid' }).overall.games, 1);
  assert.equal(aggregateBilan([s1, s2], 'moi', { from: Date.UTC(2025, 1, 1) / 1000 }).overall.games, 1);
  assert.equal(aggregateBilan([s1, s2], 'moi', {}, 'annee').byPeriod[0].key, '2025');
  assert.equal(pooledAccuracy({ n: 0 }), null);
});
