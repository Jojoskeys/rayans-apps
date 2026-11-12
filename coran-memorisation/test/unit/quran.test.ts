import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SURAHS, TOTAL_VERSES, PORTIONS, BASMALA, parseTanzil, splitBasmala, tokenizeVerse, juzOf, hizbOf, quarterOf,
  pageOf, globalIndex, fromGlobalIndex, portionOf, juzRange, hizbRange, audioFileName, isSajda,
} from '../../src/core/quran.ts';

const read = (f: string) => readFileSync(new URL(`../../data/${f}`, import.meta.url), 'utf8');
const arabic = parseTanzil(read('quran-uthmani.txt'));
const french = parseTanzil(read('fr.hamidullah.txt'));

test('114 sourates, 6236 versets, numérotation cohérente', () => {
  assert.equal(SURAHS.length, 114);
  assert.equal(SURAHS.reduce((n, s) => n + s.ayas, 0), TOTAL_VERSES);
  assert.equal(SURAHS[1].nameFr, 'Al-Baqara');
  assert.equal(SURAHS[92].nameFr, 'Ad-Duhâ');
  assert.equal(SURAHS[92].ayas, 11);
  for (let i = 0; i < TOTAL_VERSES; i += 37) {
    const [s, a] = fromGlobalIndex(i);
    assert.equal(globalIndex(s, a), i);
  }
});

test('texte arabe et traduction complets, sans ligne vide', () => {
  for (const t of [arabic, french]) {
    assert.equal(t.length, 114);
    t.forEach((v, i) => assert.equal(v.length, SURAHS[i].ayas));
    assert.ok(t.every((v) => v.every((x) => x.trim().length > 0)));
  }
  assert.match(french[0][1], /Louange à Allah/);
});

test('basmala séparée du verset 1 (sauf Al-Fâtiha et At-Tawba)', () => {
  assert.equal(splitBasmala(1, 1, arabic[0][0]).basmala, null);
  assert.equal(splitBasmala(9, 1, arabic[8][0]).basmala, null);
  for (let s = 2; s <= 114; s++) {
    if (s === 9) continue;
    const r = splitBasmala(s, 1, arabic[s - 1][0]);
    assert.ok(r.basmala, `sourate ${s}`);
    assert.ok(r.text.length > 0 && !r.text.startsWith(BASMALA));
  }
  assert.equal(splitBasmala(112, 1, arabic[111][0]).text.normalize('NFC'), 'قُلْ هُوَ ٱللَّهُ أَحَدٌ'.normalize('NFC'));
});

test('découpage en mots : les signes de pause restent collés au mot', () => {
  assert.deepEqual(tokenizeVerse('قُلْ هُوَ ٱللَّهُ أَحَدٌ'), ['قُلْ', 'هُوَ', 'ٱللَّهُ', 'أَحَدٌ']);
  const w = tokenizeVerse('ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى');
  assert.deepEqual(w, ['ذَٰلِكَ', 'ٱلْكِتَٰبُ', 'لَا', 'رَيْبَ ۛ', 'فِيهِ ۛ', 'هُدًى']);
  for (const v of arabic.flat()) for (const t of tokenizeVerse(v)) assert.ok(!/^[ۖ-ۭ ]+$/u.test(t), t);
});

test('juz, hizb, quarts et pages', () => {
  assert.equal(juzOf(1, 1), 1);
  assert.equal(juzOf(2, 141), 1);
  assert.equal(juzOf(2, 142), 2);
  assert.equal(juzOf(78, 1), 30);
  assert.equal(juzOf(114, 6), 30);
  assert.equal(hizbOf(1, 1), 1);
  assert.equal(hizbOf(114, 6), 60);
  assert.equal(quarterOf(2, 26), 2);
  assert.equal(pageOf(1, 1), 1);
  assert.equal(pageOf(114, 6), 604);
  assert.deepEqual(juzRange(30), [globalIndex(78, 1), TOTAL_VERSES - 1]);
  assert.equal(hizbRange(1)[0], 0);
  assert.equal(hizbRange(60)[1], TOTAL_VERSES - 1);
  assert.ok(isSajda(96, 19));
});

test('portions : couvrent chaque verset une fois, coupées aux quarts de hizb', () => {
  const seen = new Set<string>();
  for (const p of PORTIONS) for (let a = p.from; a <= p.to; a++) {
    const k = `${p.sura}:${a}`;
    assert.ok(!seen.has(k));
    seen.add(k);
  }
  assert.equal(seen.size, TOTAL_VERSES);
  assert.equal(portionOf(93, 5).id, '93:1-11');
  assert.equal(portionOf(2, 30).id, '2:26-43');
  assert.equal(portionOf(1, 1).id, '1:1-7');
});

test('nom de fichier audio EveryAyah', () => {
  assert.equal(audioFileName(1, 1), '001001.mp3');
  assert.equal(audioFileName(93, 11), '093011.mp3');
  assert.equal(audioFileName(2, 255), '002255.mp3');
});
