/** Statistiques : série de jours, rétention, révisions par jour, prévisions. Fonctions pures. */
import { dayKey, dayStart, dayStartPlus, nextDayStart, retrievability } from "./fsrs";
import { DAY, type Db } from "./model";

export interface Streak {
  current: number;
  best: number;
  reviewedToday: boolean;
}

/**
 * Série : nombre de journées consécutives avec au moins une révision, jusqu'à aujourd'hui, ou jusqu'à hier
 * si on n'a pas encore révisé aujourd'hui (la série n'est pas perdue avant la fin de la journée).
 */
export function streak(db: Db, now: number): Streak {
  const h = db.settings.dayStartHour;
  const days = new Set(db.reviews.map((r) => dayKey(r.ts, h)));
  const reviewedToday = days.has(dayKey(now, h));
  let current = 0;
  for (let i = reviewedToday ? 0 : 1; days.has(dayKey(dayStartPlus(now, -i, h), h)); i++) current++;

  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    if (prev !== null) {
      const [y, m, d] = prev.split("-").map(Number);
      const next = new Date(y, m - 1, d + 1, 12);
      const nk = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      run = nk === k ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current, best: Math.max(best, current), reviewedToday };
}

/**
 * Rétention réelle sur les `days` derniers jours : part des révisions de cartes déjà apprises
 * (état « révision ») où l'on ne s'est pas trompé. null s'il n'y en a aucune.
 */
export function retention(db: Db, now: number, days = 30): { rate: number | null; count: number } {
  const from = dayStartPlus(now, -(days - 1), db.settings.dayStartHour);
  const list = db.reviews.filter((r) => r.ts >= from && r.stateBefore === "review");
  if (list.length === 0) return { rate: null, count: 0 };
  return { rate: list.filter((r) => r.grade > 1).length / list.length, count: list.length };
}

/** Révisions par jour sur les `days` derniers jours (le dernier élément est aujourd'hui). */
export function reviewsPerDay(db: Db, now: number, days = 30): { key: string; count: number; correct: number }[] {
  const h = db.settings.dayStartHour;
  const out = Array.from({ length: days }, (_, i) => ({ key: dayKey(dayStartPlus(now, i - days + 1, h), h), count: 0, correct: 0 }));
  const index = new Map(out.map((d, i) => [d.key, i]));
  const from = dayStart(dayStartPlus(now, -(days - 1), h), h);
  for (const r of db.reviews) {
    if (r.ts < from) continue;
    const i = index.get(dayKey(r.ts, h));
    if (i === undefined) continue;
    out[i].count++;
    if (r.grade > 1) out[i].correct++;
  }
  return out;
}

/** Cartes dues dans les `days` prochains jours (le retard est compté aujourd'hui). */
export function forecast(db: Db, now: number, days = 7): { key: string; count: number }[] {
  const h = db.settings.dayStartHour;
  const out = Array.from({ length: days }, (_, i) => ({ key: dayKey(dayStartPlus(now, i, h), h), count: 0 }));
  const tomorrow = nextDayStart(now, h);
  for (const c of db.cards) {
    if (c.suspended || c.sched.state === "new") continue;
    const due = c.sched.due;
    const i = due < tomorrow ? 0 : Math.floor((dayStart(due, h) - dayStart(now, h)) / DAY + 0.5);
    if (i >= 0 && i < days) out[i].count++;
  }
  return out;
}

export interface CardBreakdown {
  total: number;
  new: number;
  learning: number;
  review: number;
  /** Cartes en révision dont la stabilité dépasse 21 jours. */
  mastered: number;
  suspended: number;
  /** Probabilité moyenne de se souvenir, maintenant, des cartes en révision. */
  avgRecall: number | null;
}

export function breakdown(db: Db, now: number, deckId?: string | null): CardBreakdown {
  const out: CardBreakdown = { total: 0, new: 0, learning: 0, review: 0, mastered: 0, suspended: 0, avgRecall: null };
  let sumR = 0;
  for (const c of db.cards) {
    if (deckId && c.deckId !== deckId) continue;
    out.total++;
    if (c.suspended) { out.suspended++; continue; }
    const s = c.sched;
    if (s.state === "new") out.new++;
    else if (s.state === "review") {
      out.review++;
      if (s.stability >= 21) out.mastered++;
      sumR += retrievability(s.lastReview === null ? 0 : (now - s.lastReview) / DAY, s.stability);
    } else out.learning++;
  }
  if (out.review > 0) out.avgRecall = sumR / out.review;
  return out;
}

/** Temps passé à réviser aujourd'hui, en millisecondes. */
export function timeToday(db: Db, now: number): number {
  const start = dayStart(now, db.settings.dayStartHour);
  return db.reviews.filter((r) => r.ts >= start).reduce((s, r) => s + r.durationMs, 0);
}
