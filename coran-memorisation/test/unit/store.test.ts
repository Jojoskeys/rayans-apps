import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, relativeDayFr, todayISO } from '../../src/core/dates.ts';
import { newCard, schedule, MAX_INTERVAL } from '../../src/core/srs.ts';
import {
  emptyData, setVerseStatus, dueQueue, gradePortion, streak, overview, surahCounts, normalizeData, forecast, knownShare,
} from '../../src/core/store.ts';
import { SURAHS } from '../../src/core/quran.ts';

const D = '2026-03-10';
const keys = (s: number, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `${s}:${from + i}`);

test('dates civiles', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(daysBetween('2026-03-01', '2026-03-31'), 30);
  assert.equal(addDays('2026-03-28', 2), '2026-03-30'); // passage à l'heure d'été sans décalage
  assert.equal(relativeDayFr(D, D), "aujourd'hui");
  assert.equal(relativeDayFr('2026-03-08', D), 'en retard de 2 j');
  assert.equal(todayISO(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('répétition espacée : intervalles croissants, oubli = retour à 1 jour', () => {
  let c = newCard(D);
  assert.equal(c.due, '2026-03-11');
  c = schedule(c, 2, D);
  assert.equal(c.interval, 1);
  c = schedule(c, 2, D);
  assert.equal(c.interval, 3);
  c = schedule(c, 2, D);
  assert.equal(c.interval, 8); // 3 × 2,5
  const easy = schedule(c, 3, D);
  const hard = schedule(c, 1, D);
  assert.ok(easy.interval > c.interval * 2 && hard.interval < c.interval * 2);
  assert.ok(easy.ease > c.ease && hard.ease < c.ease);
  const lapse = schedule(c, 0, D);
  assert.equal(lapse.interval, 1);
  assert.equal(lapse.lapses, 1);
  assert.equal(lapse.due, '2026-03-11');
  let big = { ...c, interval: 100 };
  big = schedule(big, 3, D);
  assert.equal(big.interval, MAX_INTERVAL);
  let low = c;
  for (let i = 0; i < 20; i++) low = schedule(low, 0, D);
  assert.equal(low.ease, 1.3);
});

test('mémoriser crée une fiche de révision pour la portion, due demain', () => {
  let d = setVerseStatus(emptyData(), keys(93, 1, 11), 'memorized', D);
  assert.deepEqual(Object.keys(d.cards), ['93:1-11']);
  assert.equal(d.activity[D].memorized, 11);
  assert.equal(dueQueue(d, D).length, 0);
  assert.equal(dueQueue(d, addDays(D, 1)).length, 1);
  // « En cours » ne compte pas comme su : la fiche disparaît
  d = setVerseStatus(d, keys(93, 1, 11), 'learning', D);
  assert.deepEqual(d.cards, {});
  assert.equal(d.activity[D].memorized, 11);
  // Re-mémoriser compte à nouveau, mais pas un passage mémorisé -> à revoir
  d = setVerseStatus(d, ['93:1'], 'memorized', D);
  d = setVerseStatus(d, ['93:1'], 'weak', D);
  assert.equal(d.activity[D].memorized, 12);
});

test('file du jour : versets « à revoir » d\'abord, puis les plus en retard', () => {
  let d = emptyData();
  d = setVerseStatus(d, keys(112, 1, 4), 'memorized', '2026-03-01');
  d = setVerseStatus(d, keys(113, 1, 5), 'memorized', '2026-03-05');
  d = setVerseStatus(d, keys(114, 1, 6), 'memorized', D);
  d = setVerseStatus(d, ['114:3'], 'weak', D);
  const q = dueQueue(d, D);
  assert.deepEqual(q.map((x) => x.portion.id), ['114:1-6', '112:1-4', '113:1-5']);
  assert.equal(q[0].weak, true);
  assert.equal(q[1].overdue, 8);
});

test('noter une portion : nouvelle échéance, « à revoir » levé si réussi', () => {
  let d = setVerseStatus(emptyData(), keys(1, 1, 7), 'memorized', '2026-03-01');
  d = setVerseStatus(d, ['1:4'], 'weak', '2026-03-01');
  const failed = gradePortion(d, '1:1-7', 1, D);
  assert.equal(failed.verses['1:4'], 'weak');
  d = gradePortion(d, '1:1-7', 2, D);
  assert.equal(d.verses['1:4'], 'memorized');
  assert.equal(d.cards['1:1-7'].due, '2026-03-11');
  assert.equal(d.cards['1:1-7'].last, D);
  assert.equal(d.activity[D].reviews, 1);
  assert.equal(dueQueue(d, D).length, 0);
  assert.equal(gradePortion(d, 'inexistant', 2, D), d);
});

test('série de jours actifs', () => {
  const d = emptyData();
  for (const day of ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2026-03-08', '2026-03-09']) d.activity[day] = { reviews: 1, memorized: 0 };
  assert.deepEqual(streak(d, '2026-03-09'), { current: 2, best: 3 });
  assert.deepEqual(streak(d, '2026-03-10'), { current: 2, best: 3 }); // aujourd'hui pas encore fait : la série tient
  assert.deepEqual(streak(d, '2026-03-11'), { current: 0, best: 3 });
  d.activity['2026-03-10'] = { reviews: 0, memorized: 0 };
  assert.equal(streak(d, '2026-03-10').current, 2);
});

test('vue d\'ensemble : juz 30 et hizb 60', () => {
  let d = emptyData();
  for (let s = 78; s <= 114; s++) d = setVerseStatus(d, keys(s, 1, SURAHS[s - 1].ayas), 'memorized', D);
  d = setVerseStatus(d, keys(2, 1, 5), 'learning', D);
  const o = overview(d);
  assert.equal(o.juz[29].memorized, o.juz[29].size);
  assert.equal(o.juz[0].learning, 5);
  assert.equal(o.surahsComplete, 37);
  assert.equal(knownShare(o.hizb[59], o.hizb[59].size), 1);
  assert.equal(o.hizb[58].memorized, o.hizb[58].size);
  assert.deepEqual(surahCounts(d, 2), { memorized: 0, weak: 0, learning: 5 });
  assert.equal(o.total.memorized, 564);
  const f = forecast(d, D, 3);
  assert.deepEqual(f, [0, 38, 0]); // 37 sourates, Al-'Âdiyât coupée au quart de hizb 100:9
});

test('lecture de données : valeurs invalides ignorées, réglages bornés', () => {
  const d = normalizeData({
    verses: { '1:1': 'memorized', '1:99': 'memorized', '200:1': 'learning', '2:3': 'bizarre', '2:4': 'weak' },
    cards: { '1:1-7': { interval: 3, ease: 2.5, reps: 2, lapses: 0, due: '2026-03-12' }, '9:9-9': { interval: 1, ease: 2.5, due: 'x' }, '2:26-43': { interval: 1, ease: 2.5, reps: 1, lapses: 0, due: '2026-03-12' } },
    activity: { '2026-03-10': { reviews: 2, memorized: -3 }, nope: {} },
    settings: { arabicSize: 500, dailyLimit: 0, theme: 'violet', translation: false },
  });
  assert.deepEqual(d.verses, { '1:1': 'memorized', '2:4': 'weak' });
  assert.deepEqual(Object.keys(d.cards), ['1:1-7']); // 2:26-43 n'a aucun verset su
  assert.deepEqual(d.activity, { '2026-03-10': { reviews: 2, memorized: 0 } });
  assert.equal(d.settings.arabicSize, 64);
  assert.equal(d.settings.dailyLimit, 1);
  assert.equal(d.settings.theme, 'auto');
  assert.equal(d.settings.translation, false);
  assert.deepEqual(normalizeData(null), emptyData());
});
