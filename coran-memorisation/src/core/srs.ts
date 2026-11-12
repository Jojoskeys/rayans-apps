// Répétition espacée (variante simple de SM-2) appliquée aux portions mémorisées.
import { addDays } from './dates.ts';

export type Grade = 0 | 1 | 2 | 3; // 0 oublié, 1 difficile, 2 bien, 3 facile

export const GRADE_LABELS: Record<Grade, string> = { 0: 'Oublié', 1: 'Difficile', 2: 'Bien', 3: 'Facile' };

export interface Card {
  /** Intervalle actuel en jours (0 = jamais révisée). */
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  /** Prochaine révision (AAAA-MM-JJ). */
  due: string;
  last?: string;
}

export const MIN_EASE = 1.3;
export const MAX_INTERVAL = 120;

export function newCard(today: string): Card {
  return { interval: 0, ease: 2.5, reps: 0, lapses: 0, due: addDays(today, 1) };
}

/** Intervalle qu'on obtiendrait avec chaque note (pour l'afficher sur les boutons). */
export function nextInterval(card: Card, grade: Grade): number {
  return schedule(card, grade, '2000-01-01').interval;
}

export function schedule(card: Card, grade: Grade, today: string): Card {
  let { interval, ease, reps, lapses } = card;
  if (grade === 0) {
    lapses += 1;
    reps = 0;
    interval = 1;
    ease = Math.max(MIN_EASE, ease - 0.2);
  } else if (grade === 1) {
    reps += 1;
    interval = Math.max(1, Math.round(interval * 1.2));
    ease = Math.max(MIN_EASE, ease - 0.15);
  } else {
    reps += 1;
    if (reps === 1) interval = grade === 3 ? 3 : 1;
    else if (reps === 2) interval = grade === 3 ? 6 : 3;
    else interval = Math.round(Math.max(interval + 1, interval * ease * (grade === 3 ? 1.3 : 1)));
    if (grade === 3) ease += 0.15;
  }
  interval = Math.min(MAX_INTERVAL, interval);
  return { interval, ease: Math.round(ease * 100) / 100, reps, lapses, due: addDays(today, interval), last: today };
}
