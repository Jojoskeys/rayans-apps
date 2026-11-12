'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../src/core/scoring');

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('W(cp) : formule Lichess', () => {
  near(S.winChance(0), 50);
  // Valeurs de référence calculées avec la formule 50 + 50 × (2 / (1 + exp(-0,00368208 × cp)) - 1)
  near(S.winChance(100), 50 + 50 * (2 / (1 + Math.exp(-0.368208)) - 1));
  near(S.winChance(100), 59.1033, 1e-3);
  near(S.winChance(-300), 100 - S.winChance(300));
  near(S.winChance(600), 90.1077, 1e-3);
  assert.ok(S.winChance(10000) > 99.99);
});

test('mats : conversion et perte', () => {
  assert.equal(S.scoreToCp({ mate: 1 }), 9990);
  assert.equal(S.scoreToCp({ mate: -3 }), -9970);
  assert.equal(S.scoreToCp({ mate: 0 }), -10000);
  assert.ok(S.moveLoss({ mate: 2 }, { mate: 5 }) < 0.01, 'deux mats : perte quasi nulle');
  near(S.moveLoss({ mate: 3 }, { cp: 0 }), 50, 0.01);
  assert.ok(S.moveLoss({ cp: 0 }, { mate: -1 }) > 49.99);
  assert.equal(S.moveLoss({ cp: 50 }, { cp: 120 }), 0, 'perte jamais négative');
});

test('orientation : le score est celui du joueur au trait (cas des Noirs)', () => {
  assert.deepEqual(S.negateScore({ cp: 35 }), { cp: -35 });
  assert.deepEqual(S.negateScore({ mate: 4 }), { mate: -4 });
  // Les Noirs jouent : meilleur +1,00 pour eux, coup joué -2,00 pour eux → grosse perte.
  near(S.moveLoss({ cp: 100 }, { cp: -200 }), S.winChance(100) - S.winChance(-200));
});

test('précision par coup : 103,1668 × exp(-0,04354 × perte) - 3,1669 bornée', () => {
  near(S.moveAccuracy(0), 99.9999, 1e-4);
  near(S.moveAccuracy(10), 103.1668 * Math.exp(-0.4354) - 3.1669);
  assert.equal(S.moveAccuracy(100), 0);
  assert.ok(S.moveAccuracy(-5) <= 100);
});

test('précision joueur : 30 % arithmétique + 70 % harmonique, plancher et cas vide', () => {
  assert.deepEqual(S.playerAccuracy([]), { accuracy: null, count: 0 });
  const r = S.playerAccuracy([0, 10]);
  const a = [S.moveAccuracy(0), S.moveAccuracy(10)];
  const arith = (a[0] + a[1]) / 2;
  const harm = 2 / (1 / a[0] + 1 / a[1]);
  near(r.accuracy, 0.3 * arith + 0.7 * harm);
  assert.equal(r.count, 2);
  const z = S.playerAccuracy([0, 0, 100]);
  assert.ok(z.accuracy > 0, 'un coup à 0 % ne rend pas la moyenne harmonique nulle (plancher 1)');
  near(z.harmonic, 3 / (1 / S.moveAccuracy(0) * 2 + 1 / 1));
  assert.equal(S.playerAccuracy([null, undefined]).accuracy, null);
});

test('Elo estimé : échantillon court, monotonie, rétrécissement', () => {
  assert.equal(S.estimateElo(90, 5).elo, null);
  assert.equal(S.estimateElo(90, 5).tooShort, true);
  assert.equal(S.estimateElo(null, 0).tooShort, true);
  const a = S.estimateElo(70, 30); const b = S.estimateElo(90, 30);
  assert.ok(b.elo > a.elo);
  assert.ok(S.estimateElo(98, 10).elo < S.estimateElo(98, 60).elo, 'peu de coups : estimation rapprochée de 1500');
  assert.ok(S.estimateElo(90, 10).margin > S.estimateElo(90, 60).margin);
  assert.equal(S.rawEloFromAccuracy(60), 1000);
  assert.equal(S.rawEloFromAccuracy(65), 1175);
});

test('affichage des scores', () => {
  assert.equal(S.formatScore({ cp: 123 }), '+1.23');
  assert.equal(S.formatScore({ cp: -50 }), '−0.50');
  assert.equal(S.formatScore({ mate: 3 }), '#3');
  assert.equal(S.formatScore({ mate: -2 }), '#-2');
});
