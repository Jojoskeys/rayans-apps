// Texte et structure du Coran : lecture des fichiers Tanzil (sans les modifier), découpage en mots,
// juz / hizb / quarts de hizb, et « portions » de révision (une sourate coupée aux quarts de hizb).
import meta from './quran-meta.json' with { type: 'json' };
import { SURAH_NAMES_FR } from './surahNames.ts';

export const TOTAL_VERSES = 6236;
export const SURAH_COUNT = 114;
// Basmala telle qu'écrite dans le texte Tanzil (Al-Fâtiha 1).
export const BASMALA =
  'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

export interface Surah {
  number: number;
  ayas: number;
  /** Indice global (0 à 6235) du verset 1. */
  start: number;
  nameAr: string;
  nameFr: string;
  meaningFr: string;
  revelation: 'Mecquoise' | 'Médinoise';
}

export const SURAHS: Surah[] = meta.suras.map((s, i) => ({
  number: i + 1,
  ayas: s.ayas,
  start: s.start,
  nameAr: s.name,
  nameFr: SURAH_NAMES_FR[i][0],
  meaningFr: SURAH_NAMES_FR[i][1],
  revelation: s.type === 'Meccan' ? 'Mecquoise' : 'Médinoise',
}));

export const verseKey = (sura: number, aya: number): string => `${sura}:${aya}`;

export function parseKey(key: string): [number, number] {
  const [s, a] = key.split(':').map(Number);
  return [s, a];
}

export const globalIndex = (sura: number, aya: number): number => SURAHS[sura - 1].start + aya - 1;

export function fromGlobalIndex(index: number): [number, number] {
  let lo = 0;
  let hi = SURAH_COUNT - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (SURAHS[mid].start <= index) lo = mid;
    else hi = mid - 1;
  }
  return [lo + 1, index - SURAHS[lo].start + 1];
}

const toStarts = (list: number[][]): number[] => list.map(([s, a]) => globalIndex(s, a));
/** Indice global du premier verset de chaque juz (30), de chaque quart de hizb (240). */
export const JUZ_STARTS = toStarts(meta.juz);
export const QUARTER_STARTS = toStarts(meta.hizbQuarters);
const PAGE_STARTS = toStarts(meta.pages);
const SAJDAS = new Set(meta.sajdas.map(([s, a]) => verseKey(s, a)));

function bucket(starts: number[], index: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

export const juzOf = (sura: number, aya: number): number => bucket(JUZ_STARTS, globalIndex(sura, aya));
/** Quart de hizb (1 à 240). Le hizb est (quart - 1) / 4 + 1. */
export const quarterOf = (sura: number, aya: number): number => bucket(QUARTER_STARTS, globalIndex(sura, aya));
export const hizbOf = (sura: number, aya: number): number => Math.floor((quarterOf(sura, aya) - 1) / 4) + 1;
export const pageOf = (sura: number, aya: number): number => bucket(PAGE_STARTS, globalIndex(sura, aya));
export const isSajda = (sura: number, aya: number): boolean => SAJDAS.has(verseKey(sura, aya));

/** Plage globale [début, fin] (incluse) d'un juz, d'un hizb. */
export function juzRange(juz: number): [number, number] {
  return [JUZ_STARTS[juz - 1], juz < 30 ? JUZ_STARTS[juz] - 1 : TOTAL_VERSES - 1];
}
export function hizbRange(hizb: number): [number, number] {
  const q = (hizb - 1) * 4;
  return [QUARTER_STARTS[q], hizb < 60 ? QUARTER_STARTS[q + 4] - 1 : TOTAL_VERSES - 1];
}

/**
 * Lit un fichier Tanzil au format « sourate|verset|texte » (lignes « # » de licence ignorées).
 * Renvoie un tableau par sourate (indice 0 = sourate 1) de versets (indice 0 = verset 1).
 */
export function parseTanzil(text: string): string[][] {
  const out: string[][] = SURAHS.map((s) => new Array<string>(s.ayas).fill(''));
  let count = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw || raw.startsWith('#')) continue;
    const first = raw.indexOf('|');
    const second = raw.indexOf('|', first + 1);
    if (first < 0 || second < 0) continue;
    const s = Number(raw.slice(0, first));
    const a = Number(raw.slice(first + 1, second));
    if (!(s >= 1 && s <= SURAH_COUNT) || !(a >= 1 && a <= SURAHS[s - 1].ayas)) throw new Error(`Ligne invalide : ${raw.slice(0, 40)}`);
    out[s - 1][a - 1] = raw.slice(second + 1);
    count++;
  }
  if (count !== TOTAL_VERSES) throw new Error(`Texte incomplet : ${count} versets au lieu de ${TOTAL_VERSES}`);
  return out;
}

/**
 * Le texte Tanzil place la basmala au début du verset 1 de chaque sourate (sauf Al-Fâtiha, où elle est
 * le verset 1, et At-Tawba, qui n'en a pas). Pour l'affichage on la sépare, sans toucher au fichier.
 */
export function splitBasmala(sura: number, aya: number, text: string): { basmala: string | null; text: string } {
  if (aya === 1 && sura !== 1 && sura !== 9) {
    // Les signes varient légèrement (ex. « بِّسْمِ » en 95 et 97) : on compare les lettres seules.
    const words = text.split(' ');
    if (words.length > 4 && stripMarks(words.slice(0, 4).join(' ')) === stripMarks(BASMALA)) {
      return { basmala: words.slice(0, 4).join(' '), text: words.slice(4).join(' ') };
    }
  }
  return { basmala: null, text };
}

const stripMarks = (s: string): string => s.replace(/[ً-ٰٟۖ-ۭ]/gu, '');

// Signes de pause et marques coraniques (U+06D6 à U+06ED) : écrits comme des « mots » séparés dans le texte,
// on les rattache au mot qui précède pour la révélation mot par mot.
const MARK_ONLY = /^[ۖ-ࣰۭ-ࣿ]+$/u;

export function tokenizeVerse(text: string): string[] {
  const words: string[] = [];
  let prefix = ''; // ex. « ۞ » (début de quart de hizb) en tête de verset : rattaché au mot suivant
  for (const part of text.split(/\s+/u)) {
    if (!part) continue;
    if (MARK_ONLY.test(part)) {
      if (words.length > 0) words[words.length - 1] += ' ' + part;
      else prefix += part + ' ';
    } else {
      words.push(prefix + part);
      prefix = '';
    }
  }
  if (prefix) words.push(prefix.trim());
  return words;
}

export interface Portion {
  id: string;
  sura: number;
  from: number;
  to: number;
}

/** Portions de révision : chaque sourate, coupée au début de chaque quart de hizb. */
export const PORTIONS: Portion[] = (() => {
  const cuts = new Set(meta.hizbQuarters.map(([s, a]) => verseKey(s, a)));
  const list: Portion[] = [];
  for (const s of SURAHS) {
    let from = 1;
    for (let a = 2; a <= s.ayas; a++) {
      if (cuts.has(verseKey(s.number, a))) {
        list.push({ id: `${s.number}:${from}-${a - 1}`, sura: s.number, from, to: a - 1 });
        from = a;
      }
    }
    list.push({ id: `${s.number}:${from}-${s.ayas}`, sura: s.number, from, to: s.ayas });
  }
  return list;
})();

const PORTION_BY_VERSE: Map<string, Portion> = new Map();
for (const p of PORTIONS) for (let a = p.from; a <= p.to; a++) PORTION_BY_VERSE.set(verseKey(p.sura, a), p);
const PORTION_BY_ID = new Map(PORTIONS.map((p) => [p.id, p]));

export const portionOf = (sura: number, aya: number): Portion => PORTION_BY_VERSE.get(verseKey(sura, aya))!;
export const portionById = (id: string): Portion | undefined => PORTION_BY_ID.get(id);

export function portionLabel(p: Portion): string {
  const s = SURAHS[p.sura - 1];
  return p.from === 1 && p.to === s.ayas ? `${s.nameFr} (entière)` : `${s.nameFr} ${p.from}–${p.to}`;
}

/** Nom de fichier audio « SSSAAA.mp3 » (format EveryAyah). */
export const audioFileName = (sura: number, aya: number): string =>
  `${String(sura).padStart(3, '0')}${String(aya).padStart(3, '0')}.mp3`;
