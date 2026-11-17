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

test("iPhone : adhkar après Fajr et avant Maghrib, bilan du soir, citations, aux heures de Rennes", async () => {
  const { BILAN_VIDE } = await import("../../aujourdhui/src/core/bilan.ts");
  const priere = { version: 1, settings: { place: { name: "Rennes", lat: 48.1173, lng: -1.6778, tz: "Europe/Paris" }, method: "uoif", asr: "shafii", highLat: "angle" } };
  const objectifs = { jours: { "2026-11-17": [{ id: "eau", domaine: "sante", titre: "Boire 1,5 L d'eau", detail: "", mesure: null, facile: false, fait: false }] }, envoyes: [], reglages: { domaines: ["sante"], nombre: 1 } };
  const { heuresDePriere } = await import("../../aujourdhui/src/core/prieres.ts");
  const base = { prefs: DEFAULT_PREFS, newChanges: [], bilan: BILAN_VIDE, objectifs, prieres: heuresDePriere(priere, at(17, 12)) };
  let st = { ...EMPTY_STATE, lastRun: at(17, 6, 50) };
  // Fajr à Rennes le 17/11 : 07:04 → rappel à 07:14 ; passage de 07:20.
  const matin = plan({ ...base, now: at(17, 7, 20), state: st });
  const bonjour = matin.messages.find((m) => m.title === "Bonjour : début de journée")!;
  assert.match(bonjour.body, /Adhkar as-sabâh \(avant le lever du soleil, 08 h 16\)/);
  assert.match(bonjour.body, /Objectifs : Boire 1,5 L d'eau/);
  st = matin.state;
  assert.equal(plan({ ...base, now: at(17, 7, 40), state: st }).messages.filter((m) => m.title.startsWith("Bonjour")).length, 0);
  // Citation de 8 h au passage de 8 h 00 ; adhkar al-masâ' (Maghrib 17:26 → 16:46) au passage de 17 h 00 ; bilan à 17 h 40.
  assert.ok(plan({ ...base, now: at(17, 8, 0), state: st }).messages.some((m) => m.title === "Citation du jour ☀️"));
  const soir = plan({ ...base, now: at(17, 17, 0), state: st });
  assert.ok(soir.messages.some((m) => m.title === "Adhkar al-masâ'"));
  assert.ok(plan({ ...base, now: at(17, 17, 40), state: soir.state }).messages.some((m) => m.title === "Bilan du soir"));
  // Désactivé dans les préférences du téléphone : rien.
  const off = plan({ ...base, prefs: { ...DEFAULT_PREFS, adhkar: false, bilan: false, citations: false }, now: at(17, 7, 20), state: { ...EMPTY_STATE, lastRun: at(17, 7) } });
  assert.equal(off.messages.length, 0);
});

test("iPhone : séance de sport dans le message du matin et rappel 30 min avant le créneau", async () => {
  const { SPORT_DEPART } = await import("../../aujourdhui/src/core/sport.ts");
  const { BILAN_VIDE } = await import("../../aujourdhui/src/core/bilan.ts");
  // Mardi 17 : cours jusqu'à 12 h 15 (fac de test), séance Jambes de 75 min → premier créneau libre après.
  const base = { prefs: DEFAULT_PREFS, newChanges: [], fac, sport: SPORT_DEPART, bilan: BILAN_VIDE };
  const matin = plan({ ...base, now: at(17, 7, 20), state: { ...EMPTY_STATE, lastRun: at(17, 7) } });
  assert.match(matin.messages.find((m) => m.title.startsWith("Bonjour"))!.body, /Sport : Jambes \(Leg\) à 07 h 00|Sport : Jambes \(Leg\) à/);
  // Créneau du jour : premier moment libre ≥ 75 min autour du TD de 10 h 15 – 12 h 15 → 7 h 00 (avant 9 h 55).
  const r = plan({ ...base, now: at(17, 6, 30), state: { ...EMPTY_STATE, lastRun: at(17, 6, 10) } });
  assert.ok(r.messages.some((m) => m.title === "Séance à 07:00 : Jambes (Leg)"), JSON.stringify(r.messages.map((m) => m.title)));
  assert.equal(plan({ ...base, now: at(17, 6, 50), state: r.state }).messages.filter((m) => m.tag === "sport").length, 0, "une seule fois");
});

test("iPhone : heures de prière, une fois chacune, prières décochées et pause respectées", async () => {
  const { messagesPriere } = await import("../src/plan.ts");
  const priere = { version: 1, settings: { place: { name: "Rennes", lat: 48.1173, lng: -1.6778, tz: "Europe/Paris" }, method: "uoif", asr: "shafii", highLat: "angle", atTime: { fajr: true, dhuhr: true, asr: false, maghrib: true, isha: true } } };
  const base = { prefs: DEFAULT_PREFS, newChanges: [], priere };
  // Maghrib à Rennes le 17/11 vers 17 h 26 : passage de 17 h 10 → « Maghrib à 17:26, dans 16 min ».
  const a = plan({ ...base, now: at(17, 17, 10), state: EMPTY_STATE });
  const maghrib = a.messages.filter((m) => m.tag === "priere");
  assert.equal(maghrib.length, 1);
  assert.match(maghrib[0].title, /^Maghrib à 17:2\d$/);
  assert.match(maghrib[0].body, /^Dans 1\d min \(Rennes\)\.$/);
  // Passage suivant (17 h 30) : déjà annoncée.
  assert.equal(plan({ ...base, now: at(17, 17, 30), state: a.state }).messages.filter((m) => m.tag === "priere").length, 0);
  // Passage juste après l'heure, sans annonce avant : « C'est l'heure ».
  assert.match(plan({ ...base, now: at(17, 17, 30), state: EMPTY_STATE }).messages.find((m) => m.tag === "priere")!.title, /^C'est l'heure de Maghrib$/);
  // 40 minutes après (et Isha encore loin) : plus rien.
  assert.equal(plan({ ...base, now: at(17, 18, 5), state: EMPTY_STATE }).messages.filter((m) => m.tag === "priere").length, 0);
  // Asr décochée dans Rayan's Prière (vers 14 h 50) : pas de notification.
  assert.equal(messagesPriere(priere, at(17, 14, 40)).length, 0);
  // Pause, ou réglage coupé dans les notifications de l'iPhone.
  assert.equal(messagesPriere({ ...priere, settings: { ...priere.settings, pausedUntil: at(17, 20) } }, at(17, 17, 10)).length, 0);
  assert.equal(plan({ ...base, prefs: { ...DEFAULT_PREFS, prieres: false }, now: at(17, 17, 10), state: EMPTY_STATE }).messages.filter((m) => m.tag === "priere").length, 0);
});
