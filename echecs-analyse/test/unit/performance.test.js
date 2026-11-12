'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { performanceRating, expected, logLik, gameRecord, periodKey, performanceBy, LR_HALF_CHI2_95 } = require('../../src/core/performance');

const rep = (n, opp, score) => Array.from({ length: n }, () => ({ opp, score }));

test('Elo de performance : 50 % contre 1500 → 1500, intervalle symétrique', () => {
  const r = performanceRating([...rep(10, 1500, 1), ...rep(10, 1500, 0)]);
  assert.ok(Math.abs(r.perf - 1500) < 1e-6);
  assert.ok(Math.abs((r.perf - r.low) - (r.high - r.perf)) < 1e-3);
  assert.equal(r.bound, null);
  assert.equal(r.n, 20);
});

test('Elo de performance : 75 % contre un même adversaire → R + 400·log10(3)', () => {
  const r = performanceRating([...rep(30, 1600, 1), ...rep(10, 1600, 0)]);
  assert.ok(Math.abs(r.perf - (1600 + 400 * Math.log10(3))) < 1e-4, String(r.perf));
  // Les nulles comptent pour un demi-point : 2 nulles = 1 gain + 1 perte pour l'estimation.
  const d = performanceRating([...rep(29, 1600, 1), ...rep(9, 1600, 0), ...rep(2, 1600, 0.5)]);
  assert.ok(Math.abs(d.perf - r.perf) < 1e-4);
});

test('Elo de performance : maximum de vraisemblance, Σ E = Σ s, et bornes à −1,92 de log-vraisemblance', () => {
  const games = [{ opp: 1200, score: 1 }, { opp: 1450, score: 0.5 }, { opp: 1700, score: 0 }, { opp: 1550, score: 1 }, { opp: 1350, score: 0 }];
  const r = performanceRating(games);
  const sumE = games.reduce((a, g) => a + expected(r.perf, g.opp), 0);
  assert.ok(Math.abs(sumE - 2.5) < 1e-6);
  const llMax = logLik(r.perf, games);
  assert.ok(logLik(r.perf + 5, games) < llMax && logLik(r.perf - 5, games) < llMax);
  assert.ok(Math.abs(logLik(r.low, games) - (llMax - LR_HALF_CHI2_95)) < 1e-6);
  assert.ok(Math.abs(logLik(r.high, games) - (llMax - LR_HALF_CHI2_95)) < 1e-6);
  assert.ok(r.low < r.perf && r.perf < r.high);
});

test('Elo de performance : l’intervalle se resserre avec le nombre de parties (≈ 1/√n)', () => {
  const small = performanceRating([...rep(6, 1500, 1), ...rep(4, 1500, 0)]);
  const big = performanceRating([...rep(600, 1500, 1), ...rep(400, 1500, 0)]);
  const w = (r) => r.high - r.low;
  assert.ok(Math.abs(small.perf - big.perf) < 1e-6);
  assert.ok(w(small) / w(big) > 9 && w(small) / w(big) < 11.5, String(w(small) / w(big)));
  // Erreur type de Wald cohérente avec la largeur de l'intervalle pour un grand échantillon.
  assert.ok(Math.abs(w(big) / 2 - 1.96 * big.se) < 2);
});

test('Elo de performance : 100 % ou 0 % → pas d’estimation finie, une seule borne', () => {
  const all = performanceRating(rep(5, 1500, 1));
  assert.equal(all.perf, null);
  assert.equal(all.bound, 'haut');
  assert.equal(all.high, null);
  assert.ok(all.low > 1500);
  assert.ok(Math.abs(logLik(all.low, rep(5, 1500, 1)) + LR_HALF_CHI2_95) < 1e-6);
  const none = performanceRating(rep(5, 1500, 0));
  assert.equal(none.bound, 'bas');
  assert.ok(none.high < 1500 && none.low === null);
  assert.ok(Math.abs((all.low - 1500) - (1500 - none.high)) < 1e-4, 'symétrie');
  assert.equal(performanceRating([]).perf, null);
});

test('point de vue du joueur, périodes et regroupements', () => {
  const g = { id: 'a', endTime: Date.UTC(2025, 2, 31, 23) / 1000, timeClass: 'blitz', rated: true, result: '0-1', white: { username: 'Autre', rating: 1500 }, black: { username: 'Moi', rating: 1400 } };
  const r = gameRecord(g, 'moi');
  assert.deepEqual([r.color, r.score, r.opp, r.myRating], ['b', 1, 1500, 1400]);
  assert.equal(gameRecord(g, 'personne'), null);
  assert.equal(periodKey(g.endTime, 'mois'), '2025-03');
  assert.equal(periodKey(g.endTime, 'trimestre'), '2025-T1');
  assert.equal(periodKey(g.endTime, 'annee'), '2025');
  const recs = [r, { ...r, timeClass: 'rapid', score: 0, myRating: 1410, endTime: r.endTime + 10 }, { ...r, myRating: 1420, endTime: r.endTime + 20 }];
  const by = performanceBy(recs, (x) => x.timeClass);
  assert.deepEqual(by.map((b) => [b.key, b.n, b.lastRating]), [['blitz', 2, 1420], ['rapid', 1, 1410]]);
});
