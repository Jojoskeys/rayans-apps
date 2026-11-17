process.env.TZ = "Europe/Paris";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREFS, EMPTY_STATE, plan } from "../src/plan.ts";
import { addItem, EMPTY_ROUTINE, toggleDone } from "../../aujourdhui/src/core/routine.ts";
import { EMPTY_FAC } from "../../aujourdhui/src/core/fac.ts";

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const routine = addItem(EMPTY_ROUTINE, "Réviser SYRE", "20:00", [0, 1, 2, 3, 4, 5, 6], at(16, 8));
const fac = { ...EMPTY_FAC, courses: [{ uid: "c1", start: at(17, 10, 15), end: at(17, 12, 15), title: "TD Analyse", room: "Salle 004", details: "" }], deadlines: [{ id: "d1", title: "À rendre : Projet PRA", at: at(18, 23, 59), kind: "devoir" as const, mailId: "m" }] };

test("rappel de tâche : une fois, à l'heure (passages toutes les 20 min), pas si cochée", () => {
  let st = { ...EMPTY_STATE, lastRun: at(17, 19, 50) };
  const a = plan({ now: at(17, 19, 55), prefs: DEFAULT_PREFS, state: st, routine, newChanges: [] });
  assert.equal(a.messages.length, 0); // pas encore l'heure
  st = a.state;
  const b = plan({ now: at(17, 20, 12), prefs: DEFAULT_PREFS, state: st, routine, newChanges: [] });
  assert.deepEqual(b.messages.map((m) => m.title), ["Rappel : Réviser SYRE"]);
  const c = plan({ now: at(17, 20, 32), prefs: DEFAULT_PREFS, state: b.state, routine, newChanges: [] });
  assert.equal(c.messages.length, 0); // déjà envoyé
  const done = toggleDone(routine, routine.items[0].id, at(17, 19));
  assert.equal(plan({ now: at(17, 20, 12), prefs: DEFAULT_PREFS, state: st, routine: done, newChanges: [] }).messages.length, 0);
  assert.equal(plan({ now: at(17, 20, 12), prefs: { ...DEFAULT_PREFS, rappels: false }, state: st, routine, newChanges: [] }).messages.length, 0);
});

test("changement de salle notifié une fois ; cours passé ou lointain ignoré", () => {
  const change = { uid: "c1", kind: "salle" as const, title: "TD Analyse", start: at(17, 10, 15), before: "B12", after: "Salle 004", detectedAt: at(17, 8) };
  const a = plan({ now: at(17, 8), prefs: DEFAULT_PREFS, state: { ...EMPTY_STATE, lastRun: at(17, 7, 40) }, newChanges: [change] });
  assert.equal(a.messages[0].title, "Changement de cours");
  assert.match(a.messages[0].body, /B12 → Salle 004/);
  assert.equal(plan({ now: at(17, 8, 20), prefs: DEFAULT_PREFS, state: a.state, newChanges: [change] }).messages.length, 0);
  const far = { ...change, uid: "c9", start: at(30, 10) };
  assert.equal(plan({ now: at(17, 8), prefs: DEFAULT_PREFS, state: EMPTY_STATE, newChanges: [far] }).messages.length, 0);
});

test("résumé du matin une fois après 7 h, avec cours et échéances", () => {
  const a = plan({ now: at(17, 7, 10), prefs: DEFAULT_PREFS, state: { ...EMPTY_STATE, lastRun: at(17, 6, 50) }, routine, fac, newChanges: [] });
  assert.equal(a.messages[0].title, "Ta journée");
  assert.match(a.messages[0].body, /1 cours : 10:15 TD Analyse/);
  assert.match(a.messages[0].body, /Projet PRA/);
  assert.match(a.messages[0].body, /1 tâche/);
  assert.equal(plan({ now: at(17, 7, 30), prefs: DEFAULT_PREFS, state: a.state, routine, fac, newChanges: [] }).messages.length, 0);
  assert.equal(plan({ now: at(17, 6, 30), prefs: DEFAULT_PREFS, state: EMPTY_STATE, routine, fac, newChanges: [] }).messages.length, 0);
});

test("rappel du soir seulement s'il reste des révisions", () => {
  const revision = { decks: [{ id: "d", newPerDay: 5 }], cards: [{ id: "a", deckId: "d", suspended: false, created: 0, sched: { state: "new", due: 0 } }], reviews: [], settings: { maxReviewsPerDay: 200, dayStartHour: 4 } };
  const a = plan({ now: at(17, 19, 5), prefs: DEFAULT_PREFS, state: EMPTY_STATE, revision, newChanges: [] });
  assert.deepEqual(a.messages.map((m) => [m.title, m.body]), [["Il reste des révisions", "Révision 1"]]);
  assert.equal(plan({ now: at(17, 19, 5), prefs: DEFAULT_PREFS, state: EMPTY_STATE, newChanges: [] }).messages.length, 0);
});
