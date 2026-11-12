/**
 * Séance de révision du jour : quelles cartes sont dues, dans quel ordre, et enregistrement d'une réponse.
 * Ordre : cartes en apprentissage dont l'heure est passée, puis révisions dues (les plus en retard
 * d'abord), puis nouvelles cartes dans la limite quotidienne de chaque paquet, puis cartes en
 * apprentissage dues dans les 20 prochaines minutes (pour finir la séance sans attendre).
 */
import { answer, dayStart, nextDayStart } from "./fsrs";
import { DAY, MINUTE, type Card, type Db, type Grade, type ReviewLog } from "./model";

export const LEARN_AHEAD_MS = 20 * MINUTE;

export interface DueCounts {
  learning: number;
  review: number;
  new: number;
  total: number;
}

function inScope(c: Card, deckId?: string | null): boolean {
  return !c.suspended && (!deckId || c.deckId === deckId);
}

/** Nouvelles cartes déjà présentées aujourd'hui, par paquet. */
export function newSeenToday(db: Db, now: number): Map<string, number> {
  const start = dayStart(now, db.settings.dayStartHour);
  const m = new Map<string, number>();
  for (const r of db.reviews) if (r.ts >= start && r.stateBefore === "new") m.set(r.deckId, (m.get(r.deckId) ?? 0) + 1);
  return m;
}

/** Révisions (cartes en état « révision ») déjà faites aujourd'hui, tous paquets confondus. */
export function reviewsDoneToday(db: Db, now: number): number {
  const start = dayStart(now, db.settings.dayStartHour);
  return db.reviews.filter((r) => r.ts >= start && r.stateBefore === "review").length;
}

interface Pools {
  learningNow: Card[];
  learningSoon: Card[];
  review: Card[];
  fresh: Card[];
}

function pools(db: Db, now: number, deckId?: string | null): Pools {
  const end = nextDayStart(now, db.settings.dayStartHour);
  const learningNow: Card[] = [];
  const learningSoon: Card[] = [];
  const review: Card[] = [];
  const freshByDeck = new Map<string, Card[]>();
  for (const c of db.cards) {
    if (!inScope(c, deckId)) continue;
    const s = c.sched;
    if (s.state === "learning" || s.state === "relearning") {
      if (s.due <= now) learningNow.push(c);
      else if (s.due <= now + LEARN_AHEAD_MS) learningSoon.push(c);
    } else if (s.state === "review") {
      if (s.due < end) review.push(c);
    } else {
      const list = freshByDeck.get(c.deckId) ?? [];
      list.push(c);
      freshByDeck.set(c.deckId, list);
    }
  }
  const byDue = (a: Card, b: Card) => a.sched.due - b.sched.due || a.created - b.created;
  learningNow.sort(byDue);
  learningSoon.sort(byDue);
  review.sort(byDue);
  const reviewLeft = Math.max(0, db.settings.maxReviewsPerDay - reviewsDoneToday(db, now));
  review.splice(reviewLeft);

  const seen = newSeenToday(db, now);
  const fresh: Card[] = [];
  for (const deck of db.decks) {
    const list = freshByDeck.get(deck.id);
    if (!list) continue;
    const left = Math.max(0, deck.newPerDay - (seen.get(deck.id) ?? 0));
    list.sort((a, b) => a.created - b.created);
    fresh.push(...list.slice(0, left));
  }
  return { learningNow, learningSoon, review, fresh };
}

export function dueCounts(db: Db, now: number, deckId?: string | null): DueCounts {
  const p = pools(db, now, deckId);
  const learning = p.learningNow.length + p.learningSoon.length;
  return { learning, review: p.review.length, new: p.fresh.length, total: learning + p.review.length + p.fresh.length };
}

/** Prochaine carte de la séance, ou null si la séance est finie. `skip` : cartes à ne pas proposer. */
export function nextCard(db: Db, now: number, deckId?: string | null, skip: string[] = []): Card | null {
  const p = pools(db, now, deckId);
  const ok = (c: Card) => !skip.includes(c.id);
  return p.learningNow.find(ok) ?? p.review.find(ok) ?? p.fresh.find(ok) ?? p.learningSoon.find(ok) ?? null;
}

/** Enregistre une réponse : nouvel état de la carte et entrée du journal. Ne modifie pas `db`. */
export function recordAnswer(db: Db, cardId: string, g: Grade, now: number, durationMs = 0): Db {
  const card = db.cards.find((c) => c.id === cardId);
  if (!card) return db;
  const before = card.sched;
  const out = answer(before, g, now, db.settings);
  const log: ReviewLog = {
    cardId,
    deckId: card.deckId,
    ts: now,
    grade: g,
    stateBefore: before.state,
    elapsedDays: before.lastReview === null ? 0 : Math.max(0, (now - before.lastReview) / DAY),
    interval: out.interval,
    durationMs: Math.max(0, Math.round(durationMs)),
  };
  return {
    ...db,
    cards: db.cards.map((c) => (c.id === cardId ? { ...c, sched: out.sched } : c)),
    reviews: [...db.reviews, log],
  };
}

/** Annule la dernière réponse : remet l'état précédent de la carte et retire l'entrée du journal. */
export function undoAnswer(db: Db, previous: Card): Db {
  const idx = db.reviews.map((r) => r.cardId).lastIndexOf(previous.id);
  return {
    ...db,
    cards: db.cards.map((c) => (c.id === previous.id ? { ...c, sched: previous.sched } : c)),
    reviews: idx < 0 ? db.reviews : [...db.reviews.slice(0, idx), ...db.reviews.slice(idx + 1)],
  };
}

/** Remet une carte à zéro (redevient nouvelle). */
export function resetCard(card: Card, now: number): Card {
  return { ...card, sched: { state: "new", due: now, stability: 0, difficulty: 0, step: 0, interval: 0, reps: 0, lapses: 0, lastReview: null } };
}
