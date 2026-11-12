// Progression fictive utilisée seulement pour les captures d'écran du test de lancement.
import { SURAHS, verseKey } from '../core/quran.ts';
import { addDays } from '../core/dates.ts';
import { emptyData, setVerseStatus, type HifzData } from '../core/store.ts';

export function demoData(today: string): HifzData {
  const all = (s: number) => Array.from({ length: SURAHS[s - 1].ayas }, (_, i) => verseKey(s, i + 1));
  let d = emptyData();
  const start = addDays(today, -40);
  d = setVerseStatus(d, all(1), 'memorized', start);
  for (let s = 93; s <= 114; s++) d = setVerseStatus(d, all(s), 'memorized', addDays(start, s - 93));
  d = setVerseStatus(d, all(78).slice(0, 20), 'memorized', addDays(today, -3));
  d = setVerseStatus(d, all(78).slice(20, 30), 'learning', today);
  d = setVerseStatus(d, ['93:7', '112:3'], 'weak', addDays(today, -1));
  d = setVerseStatus(d, all(2).slice(0, 5), 'learning', today);
  for (let i = 0; i < 60; i++) {
    if (i % 9 === 4) continue;
    const day = addDays(today, -i);
    d.activity[day] = { reviews: (i * 7) % 6, memorized: d.activity[day]?.memorized ?? (i % 3) };
  }
  return d;
}
