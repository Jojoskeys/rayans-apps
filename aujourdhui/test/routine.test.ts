import { test } from "node:test";
import assert from "node:assert/strict";
import { addItem, dueReminders, EMPTY_ROUTINE, itemsForDay, removeItem, sanitizeRoutine, streak, toggleDone, updateItem } from "../src/core/routine.ts";

// Mardi 17 novembre 2026.
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const WEEK = [1, 2, 3, 4, 5];

function base() {
  let r = addItem(EMPTY_ROUTINE, "Sport", "08:30", [1, 2, 3, 4, 5, 6, 0], at(16, 7));
  r = addItem(r, "Lire 20 pages", "", [1, 2, 3, 4, 5, 6, 0], at(16, 7));
  r = addItem(r, "Réviser l'anglais", "21:00", WEEK, at(16, 7));
  r = addItem(r, "Courses", "10:00", [6], at(16, 7));
  return r;
}

test("tâches du jour, triées par heure", () => {
  assert.deepEqual(itemsForDay(base(), at(17, 9)).map((i) => i.title), ["Sport", "Réviser l'anglais", "Lire 20 pages"]);
  assert.deepEqual(itemsForDay(base(), at(21, 9)).map((i) => i.title), ["Sport", "Courses", "Lire 20 pages"]); // samedi
  assert.throws(() => addItem(EMPTY_ROUTINE, "  ", "", WEEK, 0));
  assert.throws(() => addItem(EMPTY_ROUTINE, "x", "25:00", WEEK, 0));
  assert.throws(() => addItem(EMPTY_ROUTINE, "x", "", [], 0));
});

test("rappel à l'heure, une seule fois, pas si c'est fait", () => {
  let r = base();
  assert.deepEqual(dueReminders(r, at(17, 8, 29)).items, []);
  const a = dueReminders(r, at(17, 8, 30));
  assert.deepEqual(a.items.map((i) => i.title), ["Sport"]);
  r = a.data;
  assert.deepEqual(dueReminders(r, at(17, 8, 45)).items, []); // déjà rappelé
  // Ordinateur allumé à 10 h : rappel encore envoyé (moins de 2 h de retard) ; à 11 h, trop tard.
  assert.equal(dueReminders(base(), at(17, 10, 0)).items.length, 1);
  assert.equal(dueReminders(base(), at(17, 11, 0)).items.length, 0);
  // Fait avant l'heure : pas de rappel.
  const b = base();
  const fait = toggleDone(b, b.items[0].id, at(17, 7));
  assert.equal(dueReminders(fait, at(17, 8, 30)).items.length, 0);
  // Le lendemain, nouveau rappel.
  assert.equal(dueReminders(r, at(18, 8, 31)).items.length, 1);
});

test("cocher, décocher, modifier, supprimer", () => {
  let r = base();
  const id = r.items[0].id;
  r = toggleDone(r, id, at(17, 9));
  assert.deepEqual(r.done["2026-11-17"], [id]);
  r = toggleDone(r, id, at(17, 10));
  assert.deepEqual(r.done["2026-11-17"], undefined);
  r = updateItem(r, id, { time: "07:15", title: " Footing " });
  assert.equal(r.items[0].time, "07:15");
  assert.equal(r.items[0].title, "Footing");
  r = removeItem(r, id);
  assert.equal(r.items.length, 3);
  assert.deepEqual(sanitizeRoutine({ items: [{ id: "a", title: "x", time: "99:99", days: [9, 1] }], done: { bad: [], "2026-11-17": ["a"] } }), {
    items: [{ id: "a", title: "x", time: "", days: [1], created: 0 }], done: { "2026-11-17": ["a"] }, sent: [],
  });
});

test("série de jours où tout est fait", () => {
  let r = addItem(EMPTY_ROUTINE, "Sport", "08:30", [1, 2, 3, 4, 5, 6, 0], at(10, 7));
  const id = r.items[0].id;
  for (const d of [14, 15, 16]) r = toggleDone(r, id, at(d, 9));
  assert.equal(streak(r, at(17, 9)), 3); // pas encore fait aujourd'hui : la série tient jusqu'à hier
  assert.equal(streak(toggleDone(r, id, at(17, 9)), at(17, 10)), 4);
  assert.equal(streak(r, at(19, 9)), 0); // le 17 et le 18 manqués
});
