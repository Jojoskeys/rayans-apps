import { test } from "node:test";
import assert from "node:assert/strict";
import { dayStart, hifzCount, hifzDetail, ouverturesCount, reminderDue, reminderText, revisionCount, revisionDetail, todayISO, totalLeft } from "../src/core/counts.ts";

const H = 3_600_000;
const NOW = new Date(2026, 10, 13, 15, 0).getTime();
const card = (id: string, state: string, due: number, deckId = "d1", suspended = false) => ({ id, deckId, suspended, created: 0, sched: { state, due } });
const db = (cards: unknown[], reviews: unknown[] = [], extra = {}) => ({
  decks: [{ id: "d1", newPerDay: 2 }, { id: "d2", newPerDay: 10 }], cards, reviews, settings: { maxReviewsPerDay: 200, dayStartHour: 4, ...extra },
});

test("Révision : mêmes règles que l'application", () => {
  const c = revisionCount(db([
    card("a", "review", NOW - 48 * H), card("b", "review", NOW + 10 * H), // échue avant la fin de la journée (4 h demain)
    card("c", "review", NOW + 14 * H), // demain après 4 h : pas aujourd'hui
    card("d", "learning", NOW + 10 * 60_000), card("e", "relearning", NOW + 2 * H),
    card("f", "new", 0), card("g", "new", 0), card("h", "new", 0), card("i", "new", 0, "d2"),
    card("j", "review", NOW - H, "d1", true), // suspendue
    card("k", "new", 0, "paquet-supprime"),
  ]), NOW);
  assert.deepEqual(c, { total: 6, learning: 1, review: 2, fresh: 3 });
  assert.equal(revisionDetail(c), "2 révisions · 1 en apprentissage · 3 nouvelles cartes");
  // Nouvelles cartes déjà vues aujourd'hui et limite de révisions.
  const seen = [{ ts: NOW - H, deckId: "d1", stateBefore: "new" }, { ts: NOW - 30 * H, deckId: "d1", stateBefore: "new" }];
  assert.equal(revisionCount(db([card("f", "new", 0), card("g", "new", 0)], seen), NOW).fresh, 1);
  const done = [{ ts: NOW - H, deckId: "d1", stateBefore: "review" }];
  assert.equal(revisionCount(db([card("a", "review", 0), card("b", "review", 0)], done, { maxReviewsPerDay: 2 }), NOW).review, 1);
  assert.equal(revisionDetail(revisionCount(db([]), NOW)), "Rien à réviser");
  assert.throws(() => revisionCount({ bonjour: 1 }, NOW));
});

test("jour de révision commençant à 4 h", () => {
  assert.equal(dayStart(new Date(2026, 10, 13, 3, 0).getTime()), new Date(2026, 10, 12, 4).getTime());
  assert.equal(dayStart(new Date(2026, 10, 13, 5, 0).getTime()), new Date(2026, 10, 13, 4).getTime());
});

test("Hifz : portions échues ou avec un verset à revoir", () => {
  const data = {
    verses: { "1:3": "weak", "2:5": "memorized" },
    cards: { "1:1-7": { due: "2026-12-01" }, "2:1-5": { due: "2026-11-13" }, "2:6-10": { due: "2026-11-01" }, "3:1-9": { due: "2026-11-14" } },
  };
  const c = hifzCount(data, NOW);
  assert.deepEqual(c, { total: 3, weak: 1 });
  assert.equal(hifzDetail(c), "3 portions à réciter · dont 1 avec un verset à revoir");
  assert.equal(todayISO(NOW), "2026-11-13");
  assert.throws(() => hifzCount(null, NOW));
});

test("Ouvertures : positions dont l'échéance est passée", () => {
  assert.deepEqual(ouverturesCount([{ a: { due: NOW - 1 }, b: { due: NOW + 1 }, c: {} }, { d: { due: NOW } }, null], NOW), { total: 2, players: 2 });
  assert.deepEqual(ouverturesCount([], NOW), { total: 0, players: 0 });
});

test("rappel du soir", () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 13, h, m).getTime();
  assert.equal(reminderDue(at(18, 59), 19, 0, null), false);
  assert.equal(reminderDue(at(19, 0), 19, 0, null), true);
  assert.equal(reminderDue(at(21, 30), 19, 0, null), true, "ordinateur allumé plus tard");
  assert.equal(reminderDue(at(22, 30), 19, 0, null), false, "trop tard");
  assert.equal(reminderDue(at(19, 30), 19, 0, "2026-11-13"), false, "déjà envoyé");
  assert.equal(reminderDue(at(19, 30), 19, 0, "2026-11-12"), true);
  const counts = [
    { id: "revision" as const, total: 4, detail: "", missing: false, error: null },
    { id: "hifz" as const, total: 0, detail: "", missing: false, error: null },
    { id: "ouvertures" as const, total: null, detail: "", missing: false, error: "illisible" },
  ];
  assert.equal(reminderText(counts), "Révision : 4");
  assert.equal(totalLeft(counts), 4);
  assert.equal(reminderText([counts[1]]), null);
});
