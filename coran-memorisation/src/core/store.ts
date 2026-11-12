// Données de l'utilisateur (stockées localement en JSON) et opérations pures dessus.
import { addDays, daysBetween } from './dates.ts';
import {
  PORTIONS, SURAHS, TOTAL_VERSES, juzRange, hizbRange, fromGlobalIndex, portionById, portionOf, verseKey, type Portion,
} from './quran.ts';
import { newCard, schedule, type Card, type Grade } from './srs.ts';

/** en cours d'apprentissage / mémorisé / mémorisé mais à revoir (fragile). */
export type VerseStatus = 'learning' | 'memorized' | 'weak';

export const STATUS_LABELS: Record<VerseStatus | 'none', string> = {
  none: 'Non commencé',
  learning: 'En cours',
  memorized: 'Mémorisé',
  weak: 'À revoir',
};

export interface DayActivity {
  reviews: number;
  memorized: number;
}

export interface Settings {
  translation: boolean;
  arabicSize: number;
  dailyLimit: number;
  repeat: number;
  theme: 'auto' | 'light' | 'dark';
}

export interface HifzData {
  version: 1;
  verses: Record<string, VerseStatus>;
  cards: Record<string, Card>;
  activity: Record<string, DayActivity>;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { translation: true, arabicSize: 34, dailyLimit: 10, repeat: 1, theme: 'auto' };

export function emptyData(): HifzData {
  return { version: 1, verses: {}, cards: {}, activity: {}, settings: { ...DEFAULT_SETTINGS } };
}

const STATUSES = new Set<VerseStatus>(['learning', 'memorized', 'weak']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Vérifie et complète des données lues sur le disque ou importées ; ignore ce qui est invalide. */
export function normalizeData(raw: unknown): HifzData {
  const data = emptyData();
  if (!raw || typeof raw !== 'object') return data;
  const r = raw as Partial<Record<keyof HifzData, unknown>>;
  if (r.verses && typeof r.verses === 'object') {
    for (const [k, v] of Object.entries(r.verses as Record<string, unknown>)) {
      const m = /^(\d+):(\d+)$/.exec(k);
      if (!m || !STATUSES.has(v as VerseStatus)) continue;
      const s = Number(m[1]);
      const a = Number(m[2]);
      if (s >= 1 && s <= 114 && a >= 1 && a <= SURAHS[s - 1].ayas) data.verses[k] = v as VerseStatus;
    }
  }
  if (r.cards && typeof r.cards === 'object') {
    for (const [k, v] of Object.entries(r.cards as Record<string, Card>)) {
      if (!portionById(k) || !v || !DATE_RE.test(v.due) || !(v.interval >= 0) || !(v.ease >= 1)) continue;
      data.cards[k] = { interval: v.interval, ease: v.ease, reps: v.reps | 0, lapses: v.lapses | 0, due: v.due, ...(v.last ? { last: v.last } : {}) };
    }
  }
  if (r.activity && typeof r.activity === 'object') {
    for (const [k, v] of Object.entries(r.activity as Record<string, DayActivity>)) {
      if (DATE_RE.test(k) && v) data.activity[k] = { reviews: Math.max(0, v.reviews | 0), memorized: Math.max(0, v.memorized | 0) };
    }
  }
  if (r.settings && typeof r.settings === 'object') {
    const s = r.settings as Partial<Settings>;
    const d = data.settings;
    if (typeof s.translation === 'boolean') d.translation = s.translation;
    if (typeof s.arabicSize === 'number') d.arabicSize = Math.min(64, Math.max(20, s.arabicSize));
    if (typeof s.dailyLimit === 'number') d.dailyLimit = Math.min(100, Math.max(1, Math.round(s.dailyLimit)));
    if (typeof s.repeat === 'number') d.repeat = Math.min(20, Math.max(1, Math.round(s.repeat)));
    if (s.theme === 'light' || s.theme === 'dark' || s.theme === 'auto') d.theme = s.theme;
  }
  // Une portion ne garde sa fiche de révision que si elle contient au moins un verset su.
  for (const id of Object.keys(data.cards)) if (!hasKnownVerse(data, portionById(id)!)) delete data.cards[id];
  return data;
}

export const isKnown = (s: VerseStatus | undefined): boolean => s === 'memorized' || s === 'weak';

function hasKnownVerse(data: HifzData, p: Portion): boolean {
  for (let a = p.from; a <= p.to; a++) if (isKnown(data.verses[verseKey(p.sura, a)])) return true;
  return false;
}

function bump(activity: Record<string, DayActivity>, day: string, field: keyof DayActivity, n: number): Record<string, DayActivity> {
  if (n <= 0) return activity;
  const cur = activity[day] ?? { reviews: 0, memorized: 0 };
  return { ...activity, [day]: { ...cur, [field]: cur[field] + n } };
}

/** Change le statut d'un ensemble de versets (null = non commencé) et tient les fiches de révision à jour. */
export function setVerseStatus(data: HifzData, keys: string[], status: VerseStatus | null, today: string): HifzData {
  const verses = { ...data.verses };
  let newlyKnown = 0;
  const touched = new Set<Portion>();
  for (const k of keys) {
    const before = verses[k];
    if (status === null) delete verses[k];
    else verses[k] = status;
    if (!isKnown(before) && isKnown(status ?? undefined)) newlyKnown++;
    const [s, a] = k.split(':').map(Number);
    touched.add(portionOf(s, a));
  }
  const cards = { ...data.cards };
  const next = { ...data, verses };
  for (const p of touched) {
    const known = hasKnownVerse(next, p);
    if (known && !cards[p.id]) cards[p.id] = newCard(today);
    if (!known) delete cards[p.id];
  }
  return { ...next, cards, activity: bump(data.activity, today, 'memorized', newlyKnown) };
}

export function portionVerseKeys(p: Portion): string[] {
  const out: string[] = [];
  for (let a = p.from; a <= p.to; a++) out.push(verseKey(p.sura, a));
  return out;
}

export function hasWeakVerse(data: HifzData, p: Portion): boolean {
  return portionVerseKeys(p).some((k) => data.verses[k] === 'weak');
}

export interface QueueItem {
  portion: Portion;
  card: Card;
  weak: boolean;
  overdue: number;
}

/** Portions à réviser aujourd'hui : échues ou contenant un verset « à revoir », les plus urgentes d'abord. */
export function dueQueue(data: HifzData, today: string): QueueItem[] {
  const items: QueueItem[] = [];
  for (const p of PORTIONS) {
    const card = data.cards[p.id];
    if (!card) continue;
    const weak = hasWeakVerse(data, p);
    const overdue = daysBetween(card.due, today);
    if (overdue >= 0 || weak) items.push({ portion: p, card, weak, overdue });
  }
  items.sort((x, y) => Number(y.weak) - Number(x.weak) || y.overdue - x.overdue || x.card.ease - y.card.ease);
  return items;
}

/** Note une portion révisée : nouvelle échéance, et ses versets « à revoir » redeviennent « mémorisés » si c'est réussi. */
export function gradePortion(data: HifzData, portionId: string, grade: Grade, today: string): HifzData {
  const p = portionById(portionId);
  const card = data.cards[portionId];
  if (!p || !card) return data;
  const cards = { ...data.cards, [portionId]: schedule(card, grade, today) };
  let verses = data.verses;
  if (grade >= 2) {
    verses = { ...verses };
    for (const k of portionVerseKeys(p)) if (verses[k] === 'weak') verses[k] = 'memorized';
  }
  return { ...data, cards, verses, activity: bump(data.activity, today, 'reviews', 1) };
}

/** Nombre de portions qui arrivent à échéance chacun des prochains jours (index 0 = aujourd'hui, retards compris). */
export function forecast(data: HifzData, today: string, days: number): number[] {
  const out = new Array<number>(days).fill(0);
  for (const card of Object.values(data.cards)) {
    const n = Math.max(0, daysBetween(today, card.due));
    if (n < days) out[n]++;
  }
  return out;
}

/** Série : jours consécutifs avec au moins une révision ou un verset appris, jusqu'à aujourd'hui (ou hier). */
export function streak(data: HifzData, today: string): { current: number; best: number } {
  const active = (d: string) => {
    const a = data.activity[d];
    return !!a && a.reviews + a.memorized > 0;
  };
  let current = 0;
  let day = active(today) ? today : addDays(today, -1);
  while (active(day)) {
    current++;
    day = addDays(day, -1);
  }
  const days = Object.keys(data.activity).filter(active).sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current) };
}

export interface Counts {
  memorized: number;
  weak: number;
  learning: number;
}

function countRange(data: HifzData, from: number, to: number): Counts {
  const c: Counts = { memorized: 0, weak: 0, learning: 0 };
  for (let i = from; i <= to; i++) {
    const [s, a] = fromGlobalIndex(i);
    const st = data.verses[verseKey(s, a)];
    if (st) c[st]++;
  }
  return c;
}

export function surahCounts(data: HifzData, sura: number): Counts {
  const s = SURAHS[sura - 1];
  return countRange(data, s.start, s.start + s.ayas - 1);
}

export interface Overview {
  total: Counts;
  surahsComplete: number;
  juz: Array<Counts & { size: number }>;
  hizb: Array<Counts & { size: number }>;
}

export function overview(data: HifzData): Overview {
  const total: Counts = { memorized: 0, weak: 0, learning: 0 };
  for (const st of Object.values(data.verses)) total[st]++;
  let surahsComplete = 0;
  for (const s of SURAHS) {
    const c = surahCounts(data, s.number);
    if (c.memorized + c.weak === s.ayas) surahsComplete++;
  }
  const juz = Array.from({ length: 30 }, (_, i) => {
    const [a, b] = juzRange(i + 1);
    return { ...countRange(data, a, b), size: b - a + 1 };
  });
  const hizb = Array.from({ length: 60 }, (_, i) => {
    const [a, b] = hizbRange(i + 1);
    return { ...countRange(data, a, b), size: b - a + 1 };
  });
  return { total, surahsComplete, juz, hizb };
}

export const knownShare = (c: Counts, size: number = TOTAL_VERSES): number => (c.memorized + c.weak) / size;
