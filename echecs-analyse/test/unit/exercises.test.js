'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractMistakes, quickCheck, nextState, selectExercises, acceptedByClassification, BOX_DAYS, RETRY_MINUTES } = require('../../src/core/exercises');

const ex = {
  id: 'g:5', fen: 'x', uci: 'a2a3', category: 'gaffe', threshold: 2.5,
  best: { uci: 'e2e4', score: { cp: 100 } }, second: { uci: 'd2d4', score: { cp: 90 } }, tbKeep: ['g1f3'],
};

test('exercices : extraction des erreurs d’un camp uniquement', () => {
  const mk = (ply, color, category, extra = {}) => ({ ply, color, san: 'x', uci: 'a2a3', fenBefore: `f${ply}`, best: { uci: 'e2e4', score: { cp: 50 }, pv: ['e2e4'] }, classification: { category, loss: 30, factor: 1.1 }, ...extra });
  const report = { plies: [mk(1, 'w', 'gaffe'), mk(2, 'b', 'gaffe'), mk(3, 'w', 'bon'), mk(5, 'w', 'imprecision'), mk(7, 'w', 'erreur', { tablebase: { category: 'win', moves: [{ uci: 'h2h4', category: 'win' }, { uci: 'h2h3', category: 'draw' }] } })] };
  const m = extractMistakes(report, 'w', ['ouverture', 'ouverture', 'milieu', 'milieu', 'finale']);
  assert.deepEqual(m.map((x) => [x.ply, x.category, x.phase]), [[1, 'gaffe', 'ouverture'], [5, 'imprecision', 'milieu'], [7, 'erreur', 'finale']]);
  assert.deepEqual(m[2].tbKeep, ['h2h4']);
  assert.ok(Math.abs(m[0].threshold - 2.75) < 1e-9, 'seuil « excellent » assoupli selon l’Elo');
});

test('exercices : réponses acceptées sans moteur', () => {
  assert.equal(quickCheck(ex, 'e2e4').accepted, true);
  assert.equal(quickCheck(ex, 'g1f3').accepted, true, 'table de finales');
  assert.equal(quickCheck(ex, 'd2d4').accepted, true, '2e choix à moins de 2,5 points');
  assert.equal(quickCheck({ ...ex, second: { uci: 'd2d4', score: { cp: -200 } } }, 'd2d4'), null, '2e choix trop faible : évaluation moteur');
  assert.equal(quickCheck(ex, 'a2a3').accepted, false, 'le coup de la partie est refusé');
  assert.equal(quickCheck(ex, 'b2b3'), null);
  assert.equal(acceptedByClassification('excellent'), true);
  assert.equal(acceptedByClassification('bon'), false);
});

test('exercices : répétition espacée (boîtes de Leitner)', () => {
  const now = 1_000_000_000_000;
  let s = nextState(null, true, now);
  assert.equal(s.box, 1); assert.equal(s.due, now + BOX_DAYS[1] * 86400000);
  s = nextState(s, true, now);
  assert.equal(s.box, 2); assert.equal(s.due, now + 3 * 86400000);
  s = nextState(s, false, now);
  assert.deepEqual([s.box, s.attempts, s.successes, s.due], [0, 3, 2, now + RETRY_MINUTES * 60000]);
  for (let i = 0; i < 10; i++) s = nextState(s, true, now);
  assert.equal(s.box, BOX_DAYS.length - 1);
});

test('exercices : sélection et ordre (à revoir, puis nouveaux par gravité, puis à venir)', () => {
  const now = 1_000_000_000_000;
  const items = [
    { id: 'a', category: 'erreur', endTime: 3, ply: 1, timeClass: 'rapid', phase: 'milieu' },
    { id: 'b', category: 'gaffe', endTime: 2, ply: 1, timeClass: 'rapid', phase: 'finale' },
    { id: 'c', category: 'gaffe', endTime: 1, ply: 1, timeClass: 'blitz', phase: 'milieu' },
    { id: 'd', category: 'imprecision', endTime: 1, ply: 2, timeClass: 'rapid', phase: 'milieu' },
  ];
  const states = { c: { box: 0, due: now - 1 }, a: { box: 3, due: now + 1000 } };
  const r = selectExercises(items, states, {}, now);
  assert.deepEqual(r.exercises.map((e) => e.id), ['c', 'b', 'a']);
  assert.deepEqual(r.counts, { total: 3, due: 2, neverSeen: 1, mastered: 1 });
  assert.deepEqual(selectExercises(items, states, { categories: ['imprecision'] }, now).exercises.map((e) => e.id), ['d']);
  assert.deepEqual(selectExercises(items, states, { timeClass: 'rapid', phase: 'finale' }, now).exercises.map((e) => e.id), ['b']);
  assert.deepEqual(selectExercises(items, states, { onlyDue: true }, now).exercises.map((e) => e.id), ['c', 'b']);
});
