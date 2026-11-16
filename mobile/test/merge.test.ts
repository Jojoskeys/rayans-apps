import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeById, mergeHifz, mergeRevision, mergeRoutine, mergeSettings, mergeText } from "../src/shared/merge.ts";

const card = (id: string, lastReview: number | null, updated = 1, extra = {}) => ({ id, deckId: "d", updated, question: id, sched: { lastReview, due: 0 }, ...extra });
const db = (cards: unknown[], reviews: unknown[] = [], settings = { retention: 0.9 }) => ({ format: "rayans-revision", version: 1, decks: [{ id: "d", name: "D", created: 1 }], cards, reviews, settings });

test("collection : ajouts des deux côtés gardés, suppression propagée", () => {
  const base = [{ id: "a" }, { id: "b" }];
  const local = [{ id: "a" }, { id: "b" }, { id: "c" }]; // c ajouté sur le PC
  const remote = [{ id: "a" }, { id: "d" }]; // b supprimé sur l'iPhone, d ajouté
  const r = mergeById(base, local, remote, (x) => x.id, () => false).map((x) => x.id).sort();
  assert.deepEqual(r, ["a", "c", "d"]);
  // Sans base (premier envoi) : tout est gardé.
  assert.deepEqual(mergeById(undefined, local, remote, (x) => x.id, () => false).map((x) => x.id).sort(), ["a", "b", "c", "d"]);
});

test("Révision : la carte révisée le plus tard l'emporte, journaux réunis", () => {
  const base = db([card("c1", 100), card("c2", 100)]);
  const pc = db([card("c1", 500, 1, { sched: { lastReview: 500, due: 9 } }), card("c2", 100)], [{ cardId: "c1", ts: 500 }]);
  const phone = db([card("c1", 100), card("c2", 700, 1, { sched: { lastReview: 700, due: 7 } }), card("c3", null, 800)], [{ cardId: "c2", ts: 700 }]);
  const m = mergeRevision(base, pc, phone);
  const by = Object.fromEntries(m.cards.map((c: any) => [c.id, c]));
  assert.equal(by.c1.sched.lastReview, 500); // révisée sur le PC
  assert.equal(by.c2.sched.lastReview, 700); // révisée sur l'iPhone
  assert.ok(by.c3); // créée sur l'iPhone
  assert.deepEqual(m.reviews.map((r: any) => r.ts), [500, 700]);
});

test("réglages : chaque côté garde ce qu'il a changé", () => {
  assert.deepEqual(mergeSettings({ a: 1, b: 1 }, { a: 2, b: 1 }, { a: 1, b: 3 }), { a: 2, b: 3 });
});

test("Hifz : cartes par date de dernière révision, activité au maximum", () => {
  const m = mergeHifz(undefined,
    { verses: { "1:1": "memorized" }, cards: { p1: { last: "2026-11-10", reps: 3 } }, activity: { "2026-11-16": { reviews: 2, memorized: 0 } }, settings: {} },
    { verses: { "1:2": "weak" }, cards: { p1: { last: "2026-11-15", reps: 4 } }, activity: { "2026-11-16": { reviews: 5, memorized: 1 } }, settings: {} });
  assert.equal(m.cards.p1.reps, 4);
  assert.deepEqual(Object.keys(m.verses).sort(), ["1:1", "1:2"]);
  assert.deepEqual(m.activity["2026-11-16"], { reviews: 5, memorized: 1 });
});

test("routine : cases cochées des deux appareils, décochage propagé", () => {
  const base = { items: [{ id: "r1" }], done: { "2026-11-17": ["r1"] }, sent: [] };
  const pc = { items: [{ id: "r1" }, { id: "r2" }], done: { "2026-11-17": ["r1", "r2"] }, sent: [] };
  const phone = { items: [{ id: "r1" }], done: { "2026-11-17": [] }, sent: [] }; // décoché sur l'iPhone
  const m = mergeRoutine(base, pc, phone);
  assert.deepEqual(m.items.map((i: any) => i.id), ["r1", "r2"]);
  assert.deepEqual(m.done["2026-11-17"], ["r2"]);
});

test("texte : vide d'un côté, identique, ou fusion", () => {
  assert.equal(mergeText("revision", null, null, "x"), "x");
  assert.equal(mergeText("revision", null, "y", null), "y");
  assert.equal(mergeText("revision", null, "z", "z"), "z");
  const t = mergeText("revision", null, JSON.stringify(db([card("a", 1)])), JSON.stringify(db([card("b", 2)])));
  assert.equal(JSON.parse(t!).cards.length, 2);
});

test("fac : emploi du temps du dernier téléchargement, mails et échéances des deux côtés", async () => {
  const { mergeFac } = await import("../src/shared/merge.ts");
  const pc = { icsUrl: "u", groups: ["G4"], allowedSenders: [], courses: [{ uid: "c2" }], lastFetch: 200, mails: [], overrides: [], deadlines: [{ id: "d1", at: 5 }] };
  const phone = { icsUrl: "u", groups: ["G4"], allowedSenders: [], courses: [{ uid: "c1" }], lastFetch: 100, mails: [{ id: "m1", addedAt: 9, proposals: [] }], overrides: [], deadlines: [{ id: "d2", at: 3 }] };
  const m = mergeFac(undefined, pc, phone);
  assert.deepEqual(m.courses, [{ uid: "c2" }]);
  assert.deepEqual(m.mails.map((x: any) => x.id), ["m1"]);
  assert.deepEqual(m.deadlines.map((x: any) => x.id), ["d2", "d1"]);
});
