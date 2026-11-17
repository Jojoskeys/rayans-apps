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

test("Objectifs du jour : case cochée d'un côté, objectif remplacé de l'autre", async () => {
  const { mergeObjectifs } = await import("../src/shared/merge.ts");
  const o = (id: string, fait = false) => ({ id, domaine: "sante", titre: id, detail: "", mesure: null, facile: false, fait });
  const reglages = { domaines: ["foi", "etudes", "ecran", "sante"], nombre: 3 };
  const base = { jours: { "2026-11-17": [o("eau"), o("marche"), o("fajr")] }, envoyes: [], reglages };
  // PC : « eau » cochée. iPhone : rien changé ce jour-là, mais le lendemain préparé.
  const pc = { ...base, jours: { "2026-11-17": [o("eau", true), o("marche"), o("fajr")] } };
  const tel = { ...base, jours: { ...base.jours, "2026-11-18": [o("lit")] } };
  const m = mergeObjectifs(base, pc, tel);
  assert.equal(m.jours["2026-11-17"][0].fait, true);
  assert.deepEqual(m.jours["2026-11-18"].map((x: { id: string }) => x.id), ["lit"]);
  // Les deux ont changé la même journée : la liste locale est gardée, les cases cochées des deux côtés aussi.
  const a = { ...base, jours: { "2026-11-17": [o("eau", true), o("marche"), o("fajr")] } };
  const b = { ...base, jours: { "2026-11-17": [o("eau"), o("marche"), o("fajr", true)] } };
  const ab = mergeObjectifs(base, a, b);
  assert.deepEqual(ab.jours["2026-11-17"].map((x: { fait: boolean }) => x.fait), [true, false, true]);
});

test("Bilan : matin et soir les plus récents, liste prévue cochée des deux côtés, adhkar", async () => {
  const { mergeBilan } = await import("../src/shared/merge.ts");
  const reglages = {};
  const prevu = [{ id: "p1", texte: "Réviser", fait: false }, { id: "p2", texte: "Appeler maman", fait: false }];
  const base = { jours: { "2026-11-18": { prevu } }, envoyes: [], reglages };
  // PC : bilan du matin et p1 coché ; iPhone : p2 coché et adhkar as-sabâh.
  const pc = { ...base, jours: { "2026-11-18": { prevu: [{ ...prevu[0], fait: true }, prevu[1]], matin: { humeur: 4, ressenti: "Bien", at: 2 } } } };
  const tel = { ...base, jours: { "2026-11-18": { prevu: [prevu[0], { ...prevu[1], fait: true }], adhkar: { sabah: 5 } } } };
  const m = mergeBilan(base, pc, tel).jours["2026-11-18"];
  assert.deepEqual(m.prevu.map((p: { fait: boolean }) => p.fait), [true, true]);
  assert.equal(m.matin.ressenti, "Bien");
  assert.equal(m.adhkar.sabah, 5);
  // Adhkar décoché sur un appareil après synchro : décoché partout.
  const coche = { jours: { "2026-11-18": { adhkar: { masa: 9 } } }, envoyes: [], reglages };
  const decoche = { jours: { "2026-11-18": {} }, envoyes: [], reglages };
  assert.equal(mergeBilan(coche, decoche, coche).jours["2026-11-18"].adhkar, undefined);
  // Deux bilans du soir : le plus récent l'emporte.
  const s1 = { jours: { "2026-11-17": { soir: { humeur: 3, journee: "PC", ressenti: "", at: 10 } } }, envoyes: [], reglages };
  const s2 = { jours: { "2026-11-17": { soir: { humeur: 5, journee: "iPhone", ressenti: "", at: 20 } } }, envoyes: [], reglages };
  assert.equal(mergeBilan(undefined, s1, s2).jours["2026-11-17"].soir.journee, "iPhone");
});

test("Objectifs : deux listes différentes pour le même jour → les deux appareils gardent la même", async () => {
  const { mergeObjectifs } = await import("../src/shared/merge.ts");
  const o = (id: string, fait = false) => ({ id, domaine: "sante", titre: id, detail: "", mesure: null, facile: false, fait });
  const pc = { jours: { "2026-11-17": [o("eau", true), o("marche")] }, envoyes: [], reglages: {} };
  const tel = { jours: { "2026-11-17": [o("lit"), o("fruit")] }, envoyes: [], reglages: {} };
  const surPc = mergeObjectifs(undefined, pc, tel);
  const surTel = mergeObjectifs(undefined, tel, pc);
  assert.deepEqual(surPc.jours, surTel.jours);
});

test("Sport : journaux réunis ; même séance saisie sur les deux appareils → la plus récente", async () => {
  const { mergeSport } = await import("../src/shared/merge.ts");
  const s = (jour: string, type: string, at: number, reps: number) => ({ id: `${jour}-${type}`, jour, type, exercices: [{ bloc: "squat", series: [{ charge: 80, reps }] }], at });
  const base = { debut: "2026-11-16", journal: [], perfs: [], ajustements: [] };
  const pc = { ...base, journal: [s("2026-11-16", "upper", 10, 5)] };
  const tel = { ...base, journal: [s("2026-11-17", "leg", 20, 8), s("2026-11-16", "upper", 30, 6)] };
  const m = mergeSport(base, pc, tel);
  assert.deepEqual(m.journal.map((x: { jour: string }) => x.jour), ["2026-11-17", "2026-11-16"]);
  assert.equal(m.journal.find((x: { type: string }) => x.type === "upper").exercices[0].series[0].reps, 6);
  assert.deepEqual(mergeSport(base, tel, pc).journal, m.journal, "même résultat sur les deux appareils");
});

test("objectifs : compteur modifié des deux côtés → la plus grande valeur ; sport : réglages et semaine gardés", async () => {
  const { mergeObjectifs, mergeSport } = await import("../src/shared/merge.ts");
  const o = (id: string, extra = {}) => ({ id, domaine: "sante", titre: id, detail: "", mesure: null, facile: false, fait: false, ...extra });
  const base = { jours: { "2026-11-17": [o("pas", { valeur: 1000 }), o("fruit")] }, envoyes: [], reglages: {} };
  const pc = { ...base, jours: { "2026-11-17": [o("pas", { valeur: 3000 }), o("fruit", { fait: true })] } };
  const tel = { ...base, jours: { "2026-11-17": [o("pas", { valeur: 8000 }), o("fruit")] } };
  const m = mergeObjectifs(base, pc, tel);
  assert.equal(m.jours["2026-11-17"].find((x: { id: string }) => x.id === "pas").valeur, 8000);
  assert.ok(m.jours["2026-11-17"].find((x: { id: string }) => x.id === "fruit").fait);

  const sb = { debut: "2026-11-16", journal: [], perfs: [], ajustements: [], reglages: {}, semaine: null };
  const spc = { ...sb, reglages: { "developpe-couche": { depart: 85, max: 100, increment: 2 } } };
  const stel = { ...sb, semaine: ["upper", "leg", "fractionne", "push", "pull", "seuil", "repos"] };
  const s = mergeSport(sb, spc, stel);
  assert.deepEqual(s.reglages, spc.reglages);
  assert.deepEqual(s.semaine, stel.semaine);
});
