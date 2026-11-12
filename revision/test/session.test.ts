import { describe, expect, it } from "vitest";
import { dayStartPlus } from "../src/core/fsrs";
import { DAY, MINUTE, emptyDb, makeCard, makeDeck, type Db, type Grade } from "../src/core/model";
import { sampleDb } from "../src/core/sample";
import { dueCounts, nextCard, recordAnswer, resetCard, undoAnswer } from "../src/core/session";
import { breakdown, forecast, retention, reviewsPerDay, streak } from "../src/core/stats";

const T0 = new Date(2026, 0, 10, 9, 0, 0).getTime();

function dbWith(nNew: number, newPerDay = 20): Db {
  const db = emptyDb();
  const deck = makeDeck("Test", T0, { newPerDay });
  db.decks.push(deck);
  for (let i = 0; i < nNew; i++) db.cards.push(makeCard(deck.id, { kind: "basic", question: `Q${i}`, answer: `R${i}` }, T0 + i));
  return db;
}

/** Fait toute la séance en répondant `g` à chaque carte ; renvoie la base et le nombre de réponses. */
function runSession(db: Db, now: number, g: Grade = 3): { db: Db; answers: number; now: number } {
  let answers = 0;
  for (let c = nextCard(db, now); c; c = nextCard(db, now)) {
    if (c.sched.due > now) now = c.sched.due; // attendre une étape d'apprentissage
    db = recordAnswer(db, c.id, g, now, 4000);
    answers++;
    now += 5000;
    if (answers > 1000) throw new Error("séance infinie");
  }
  return { db, answers, now };
}

describe("séance du jour", () => {
  it("limite les nouvelles cartes par paquet et par jour", () => {
    const db = dbWith(30, 10);
    expect(dueCounts(db, T0)).toMatchObject({ new: 10, review: 0, learning: 0 });
    const r = runSession(db, T0);
    // 10 nouvelles cartes, chacune vue 2 fois (étapes 1 → 10 min puis fin de l'apprentissage).
    expect(r.answers).toBe(20);
    expect(dueCounts(r.db, r.now).total).toBe(0);
    expect(breakdown(r.db, r.now)).toMatchObject({ new: 20, review: 10, learning: 0 });
    // Le lendemain, 10 nouvelles de plus, et les révisions prévues dans 4 jours ne sont pas encore dues.
    expect(dueCounts(r.db, T0 + DAY)).toMatchObject({ new: 10, review: 0 });
    expect(dueCounts(r.db, T0 + 4 * DAY)).toMatchObject({ review: 10 });
  });

  it("ordre : apprentissage en retard, puis révisions, puis nouvelles", () => {
    let db = dbWith(3);
    const [a, b] = db.cards;
    db = recordAnswer(db, a.id, 1, T0); // a : apprentissage, due dans 1 min
    db = { ...db, cards: db.cards.map((c) => (c.id === b.id ? { ...c, sched: { ...c.sched, state: "review", stability: 5, difficulty: 5, lastReview: T0 - 6 * DAY, due: T0 - DAY, interval: 5 } } : c)) };
    expect(nextCard(db, T0)?.id).toBe(b.id); // a n'est pas encore due : la révision passe avant
    expect(nextCard(db, T0 + 2 * MINUTE)?.id).toBe(a.id);
    expect(nextCard(db, T0 + 2 * MINUTE, null, [a.id])?.id).toBe(b.id);
  });

  it("une carte en apprentissage due dans moins de 20 min termine la séance sans attendre", () => {
    let db = dbWith(1);
    db = recordAnswer(db, db.cards[0].id, 3, T0); // due dans 10 min
    expect(nextCard(db, T0)?.id).toBe(db.cards[0].id);
    expect(dueCounts(db, T0).learning).toBe(1);
  });

  it("filtre par paquet et ignore les cartes suspendues", () => {
    const db = dbWith(2);
    const other = makeDeck("Autre", T0);
    db.decks.push(other);
    db.cards.push(makeCard(other.id, { kind: "basic", question: "x", answer: "y" }, T0));
    db.cards[0].suspended = true;
    expect(dueCounts(db, T0).new).toBe(2);
    expect(dueCounts(db, T0, other.id).new).toBe(1);
    expect(dueCounts(db, T0, db.decks[0].id).new).toBe(1);
  });

  it("respecte le maximum de révisions par jour", () => {
    let db = dbWith(5);
    db = { ...db, settings: { ...db.settings, maxReviewsPerDay: 2 }, cards: db.cards.map((c) => ({ ...c, sched: { ...c.sched, state: "review", stability: 3, difficulty: 5, lastReview: T0 - 4 * DAY, due: T0 - DAY, interval: 3 } })) };
    expect(dueCounts(db, T0).review).toBe(2);
    db = recordAnswer(db, db.cards[0].id, 3, T0);
    expect(dueCounts(db, T0).review).toBe(1);
  });

  it("annuler la dernière réponse remet la carte et le journal comme avant", () => {
    const db = dbWith(1);
    const before = db.cards[0];
    const after = recordAnswer(db, before.id, 4, T0);
    expect(after.reviews).toHaveLength(1);
    expect(after.cards[0].sched.state).toBe("review");
    const undone = undoAnswer(after, before);
    expect(undone.reviews).toHaveLength(0);
    expect(undone.cards[0].sched).toEqual(before.sched);
  });

  it("le journal enregistre l'état d'avant, la note et la durée", () => {
    const db = recordAnswer(dbWith(1), dbWith(1).cards[0].id, 3, T0, 1234);
    expect(db.reviews).toHaveLength(0); // identifiant d'une autre base : rien ne change
    const base = dbWith(1);
    const r = recordAnswer(base, base.cards[0].id, 3, T0, 1234).reviews[0];
    expect(r).toMatchObject({ grade: 3, stateBefore: "new", durationMs: 1234, deckId: base.decks[0].id });
  });

  it("remettre une carte à zéro la rend nouvelle", () => {
    const base = dbWith(1);
    const db = recordAnswer(base, base.cards[0].id, 4, T0);
    const reset = resetCard(db.cards[0], T0);
    expect(reset.sched).toMatchObject({ state: "new", reps: 0, lastReview: null });
  });

  it("paquet d'exemple : 5 cartes, toutes nouvelles et proposées aujourd'hui", () => {
    const db = sampleDb(T0);
    expect(db.cards).toHaveLength(5);
    expect(dueCounts(db, T0).new).toBe(5);
  });
});

describe("statistiques", () => {
  function reviewOn(db: Db, daysAgo: number, grade: Grade, state: "new" | "review" = "review"): Db {
    const ts = dayStartPlus(T0, -daysAgo) + 6 * 3600_000;
    return { ...db, reviews: [...db.reviews, { cardId: "x", deckId: "d", ts, grade, stateBefore: state, elapsedDays: 3, interval: 3, durationMs: 1000 }] };
  }

  it("série : jours consécutifs jusqu'à aujourd'hui, ou jusqu'à hier tant qu'on n'a pas révisé", () => {
    let db = emptyDb();
    expect(streak(db, T0)).toEqual({ current: 0, best: 0, reviewedToday: false });
    for (const d of [1, 2, 3, 5, 6]) db = reviewOn(db, d, 3);
    expect(streak(db, T0)).toEqual({ current: 3, best: 3, reviewedToday: false });
    db = reviewOn(db, 0, 3);
    expect(streak(db, T0)).toEqual({ current: 4, best: 4, reviewedToday: true });
    // Deux jours sans réviser : la série est perdue.
    expect(streak(db, T0 + 2 * DAY).current).toBe(0);
  });

  it("série sur un changement de mois et d'heure", () => {
    let db = emptyDb();
    const end = new Date(2026, 2, 31, 12).getTime(); // 31 mars, après le passage à l'heure d'été
    for (let i = 0; i < 40; i++) db = { ...db, reviews: [...db.reviews, { cardId: "x", deckId: "d", ts: dayStartPlus(end, -i) + 3600_000, grade: 3, stateBefore: "review", elapsedDays: 1, interval: 1, durationMs: 0 }] };
    expect(streak(db, end)).toMatchObject({ current: 40, best: 40 });
  });

  it("rétention : part des révisions réussies, sans compter l'apprentissage", () => {
    let db = emptyDb();
    expect(retention(db, T0).rate).toBeNull();
    db = reviewOn(db, 1, 3);
    db = reviewOn(db, 2, 2);
    db = reviewOn(db, 3, 1);
    db = reviewOn(db, 4, 4);
    db = reviewOn(db, 0, 1, "new");
    db = reviewOn(db, 40, 1); // hors des 30 jours
    expect(retention(db, T0)).toEqual({ rate: 0.75, count: 4 });
  });

  it("révisions par jour et prévisions", () => {
    let db = reviewOn(emptyDb(), 0, 3);
    db = reviewOn(db, 0, 1);
    db = reviewOn(db, 2, 3);
    const days = reviewsPerDay(db, T0, 7);
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ count: 2, correct: 1 });
    expect(days[4].count).toBe(1);

    const base = dbWith(3);
    const due = [T0 - 3 * DAY, dayStartPlus(T0, 1), dayStartPlus(T0, 3)];
    const withDue = { ...base, cards: base.cards.map((c, i) => ({ ...c, sched: { ...c.sched, state: "review" as const, stability: 5, difficulty: 5, lastReview: T0 - 5 * DAY, due: due[i], interval: 5 } })) };
    expect(forecast(withDue, T0, 7).map((d) => d.count)).toEqual([1, 1, 0, 1, 0, 0, 0]);
  });

  it("répartition des cartes et probabilité moyenne de se souvenir", () => {
    const base = dbWith(3);
    const db = { ...base, cards: base.cards.map((c, i) => (i === 0 ? { ...c, sched: { ...c.sched, state: "review" as const, stability: 30, difficulty: 5, lastReview: T0 - 30 * DAY, due: T0, interval: 30 } } : c)) };
    const b = breakdown(db, T0);
    expect(b).toMatchObject({ total: 3, new: 2, review: 1, mastered: 1 });
    expect(b.avgRecall).toBeCloseTo(0.9, 10);
  });
});
