import { test } from "node:test";
import assert from "node:assert/strict";
import { allure, allures, creneau, enregistrer, estimation5k, ligneSport, nettoyerSport, planCourse, prescriptions, riegel, seanceDuJour, SPORT_DEPART, type SeanceFaite, type SportData } from "../src/core/sport.ts";
import { EXERCICES } from "../src/core/exercices.ts";
import { SEANCES, ALIAS } from "../src/core/sport.ts";

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const seance = (jour: string, type: SeanceFaite["type"], exercices: SeanceFaite["exercices"], t: number): SeanceFaite => ({ id: `${jour}-${type}`, jour, type, exercices, at: t });

test("chaque exercice du programme a sa fiche (muscles, explication, consignes)", () => {
  for (const b of Object.values(SEANCES).flat()) {
    const e = EXERCICES[ALIAS[b.ex] ?? b.ex];
    assert.ok(e && e.muscles && e.explication && e.consignes.length, b.ex);
  }
});

test("semaine : lundi Upper, mardi Leg, mercredi fractionné… avec les charges de départ", () => {
  const lundi = seanceDuJour(SPORT_DEPART, "2026-11-16", at(16, 8));
  assert.equal(lundi.type, "upper");
  const dc = lundi.blocs.find((b) => b.ex === "developpe-couche")!;
  assert.deepEqual([dc.series, dc.reps, dc.prescription.charge], [4, 5, 85]);
  assert.equal(lundi.blocs.find((b) => b.ex === "tractions-lestees")!.prescription.charge, 15);
  assert.equal(lundi.blocs[0].ex, "echauffement-epaule", "échauffement d'épaule en premier");
  assert.equal(seanceDuJour(SPORT_DEPART, "2026-11-17", at(17, 8)).type, "leg");
  assert.equal(seanceDuJour(SPORT_DEPART, "2026-11-18", at(18, 8)).type, "fractionne");
});

test("progression : réussi → +2,5 kg ; pas assez → même charge ; deux échecs → −5 %", () => {
  let d: SportData = SPORT_DEPART;
  // Développé couché 85 × 5 × 4 réussi.
  d = enregistrer(d, seance("2026-11-16", "upper", [{ bloc: "developpe-couche", series: Array(4).fill({ charge: 85, reps: 5 }) }], at(16, 19)));
  assert.equal(prescriptions(d)["developpe-couche"].charge, 87.5);
  // 87,5 : 5, 5, 4, 4 → tenu (même charge).
  d = enregistrer(d, seance("2026-11-23", "upper", [{ bloc: "developpe-couche", series: [5, 5, 4, 4].map((r) => ({ charge: 87.5, reps: r })) }], at(23, 19)));
  assert.equal(prescriptions(d)["developpe-couche"].charge, 87.5);
  // Deux séances très en dessous → 83 kg (−5 %, arrondi à 2,5).
  d = enregistrer(d, seance("2026-11-30", "upper", [{ bloc: "developpe-couche", series: [3, 3, 2, 2].map((r) => ({ charge: 87.5, reps: r })) }], at(30, 19)));
  d = enregistrer(d, seance("2026-12-07", "upper", [{ bloc: "developpe-couche", series: [3, 3, 2, 2].map((r) => ({ charge: 87.5, reps: r })) }], new Date(2026, 11, 7, 19).getTime()));
  assert.equal(prescriptions(d)["developpe-couche"].charge, 82.5);
  // Plage : rowing 80 × [8-10] → 10 partout → 82,5 et retour à 8.
  d = enregistrer(d, seance("2026-11-16b", "upper", [{ bloc: "rowing-barre", series: Array(4).fill({ charge: 80, reps: 10 }) }], at(16, 20)));
  assert.deepEqual([prescriptions(d)["rowing-barre"].charge, prescriptions(d)["rowing-barre"].reps], [82.5, 8]);
  // Volume : tractions strictes 5 × 7 faites → 5 × 8. Maintien : planche 3 × 60 s → 65 s.
  d = enregistrer(d, seance("2026-11-20", "pull", [{ bloc: "tractions-strictes", series: Array(5).fill({ charge: 0, reps: 7 }) }], at(20, 19)));
  assert.equal(prescriptions(d)["tractions-strictes"].reps, 8);
  d = enregistrer(d, seance("2026-11-16c", "upper", [{ bloc: "planche", series: Array(3).fill({ charge: 0, reps: 60 }) }], at(16, 21)));
  assert.equal(prescriptions(d).planche.reps, 65);
  // Séance déjà faite : on voit ce qui était prévu ce jour-là, pas la charge suivante.
  const lundi = seanceDuJour(d, "2026-11-16", at(16, 22));
  assert.ok(lundi.faite);
  // Relecture du fichier.
  assert.deepEqual(nettoyerSport(JSON.parse(JSON.stringify(d))), d);
});

test("course : 5 km estimé d'après le 10 km de Paris, allures et plan sur 4 semaines", () => {
  const e = estimation5k(SPORT_DEPART, at(17, 8));
  assert.equal(e.source, "10 km de Paris");
  assert.ok(Math.abs(e.secondes - riegel(3949, 10.3)) < 1);
  assert.equal(allure(e.secondes / 5), "6:07");
  const a = allures(SPORT_DEPART, at(17, 8));
  assert.equal(allure(a.facile[0]), "7:07");
  assert.equal(allure(a.seuil), "6:22");
  assert.equal(allure(a.intervalle), "5:57");
  assert.match(planCourse("fractionne", SPORT_DEPART, "2026-11-18", at(18, 8)).titre, /6 × 400 m/);
  assert.match(planCourse("fractionne", SPORT_DEPART, "2026-11-25", at(25, 8)).titre, /8 × 400 m/);
  assert.ok(planCourse("seuil", SPORT_DEPART, "2026-12-12", at(17, 8)).test, "semaine 4 : test 5 km");
  assert.match(planCourse("longue", SPORT_DEPART, "2026-11-22", at(22, 8)).titre, /40 min/);
  // Un test 5 km plus rapide recale les allures.
  const d = enregistrer(SPORT_DEPART, { id: "t", jour: "2026-12-12", type: "seuil", exercices: [], course: { distanceKm: 5, dureeS: 29 * 60, ressenti: "dur" }, at: new Date(2026, 11, 12, 10).getTime() });
  assert.equal(allure(estimation5k(d, new Date(2026, 11, 13).getTime()).secondes / 5), "5:48");
});

test("créneau : premier moment libre assez long selon les cours", () => {
  const cours = [{ start: at(17, 8), end: at(17, 12) }, { start: at(17, 13, 30), end: at(17, 18) }];
  // 75 min : ni avant 8 h (marges), ni le midi (1 h 30 − 40 min) → 18 h 20.
  const c = creneau("2026-11-17", 75, cours)!;
  assert.equal(new Date(c.debut).toTimeString().slice(0, 5), "18:20");
  // 45 min de course : le midi ne suffit pas (50 min libres, mais 45 + marges) → ok à 12 h 20 ? 12:20 → 13:05, avant 13:10.
  assert.equal(new Date(creneau("2026-11-17", 45, cours)!.debut).toTimeString().slice(0, 5), "12:20");
  // Week-end sans cours : 9 h 30.
  assert.equal(new Date(creneau("2026-11-21", 50, [])!.debut).toTimeString().slice(0, 5), "09:30");
  // Journée pleine jusqu'à 21 h : rien.
  assert.equal(creneau("2026-11-17", 75, [{ start: at(17, 7), end: at(17, 21) }]), null);
  assert.match(ligneSport(SPORT_DEPART, "2026-11-17", cours, at(17, 7))!, /Jambes \(Leg\) à 18 h 20/);
});
