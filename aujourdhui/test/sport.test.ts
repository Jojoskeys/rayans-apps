import { test } from "node:test";
import assert from "node:assert/strict";
import { allure, allures, creneau, enregistrer, estimation5k, ligneSport, nettoyerSport, planCourse, prescriptions, riegel, seanceDuJour, SPORT_DEPART, type SeanceFaite, type SportData } from "../src/core/sport.ts";
import { EXERCICES } from "../src/core/exercices.ts";
import { SEANCES, ALIAS, ajuster, importerProfil, regler, reglerSemaine, resumeSport } from "../src/core/sport.ts";
import { sportView } from "../src/core/sportvue.ts";

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
// Coureur fictif : un 10 km en 1 h pile.
const COUREUR: SportData = { ...SPORT_DEPART, perfs: [{ id: "p-10k", jour: "2026-11-15", distanceKm: 10, dureeS: 3600, titre: "10 km test" }] };
const seance = (jour: string, type: SeanceFaite["type"], exercices: SeanceFaite["exercices"], t: number): SeanceFaite => ({ id: `${jour}-${type}`, jour, type, exercices, at: t });

test("chaque exercice du programme a sa fiche (muscles, explication, consignes)", () => {
  for (const b of Object.values(SEANCES).flat()) {
    const e = EXERCICES[ALIAS[b.ex] ?? b.ex];
    assert.ok(e && e.muscles && e.explication && e.consignes.length, b.ex);
  }
});

test("semaine : 3 séances de muscu, 3 courses, 1 repos ; jamais de course dure à côté des jambes", () => {
  const lundi = seanceDuJour(SPORT_DEPART, "2026-11-16", at(16, 8));
  assert.equal(lundi.type, "upper");
  const dc = lundi.blocs.find((b) => b.ex === "developpe-couche")!;
  assert.deepEqual([dc.series, dc.reps, dc.prescription.charge], [4, 5, 40]);
  assert.equal(lundi.blocs.find((b) => b.ex === "tractions-lestees")!.prescription.charge, 0);
  assert.equal(lundi.blocs[0].ex, "echauffement-epaule", "échauffement d'épaule en premier");
  const types = [16, 17, 18, 19, 20, 21, 22].map((j) => seanceDuJour(SPORT_DEPART, `2026-11-${j}`, at(j, 8)).type);
  assert.deepEqual(types, ["upper", "fractionne", "pull", "leg", "repos", "seuil", "longue"]);
  const iJambes = types.indexOf("leg");
  for (const k of [iJambes - 1, iJambes + 1]) assert.ok(!["fractionne", "seuil"].includes(types[(k + 7) % 7]));
  // L'échauffement d'épaule reste avant la calisthénie.
  assert.equal(seanceDuJour(SPORT_DEPART, "2026-11-18", at(18, 8)).blocs[0].ex, "echauffement-epaule");
});

test("reprise progressive : dips dès la semaine 2, élastique semaine 3, pompes en poirier et pistol semaine 5", () => {
  const ids = (jour: string) => seanceDuJour(SPORT_DEPART, jour, 0).blocs.map((b) => b.ex);
  assert.ok(!ids("2026-11-16").includes("dips"));
  assert.ok(ids("2026-11-23").includes("dips"));
  assert.ok(ids("2026-11-16").includes("curl-marteau") && ids("2026-11-16").includes("rowing-pronation"));
  assert.ok(!ids("2026-11-25").includes("handstand-elastique"));
  assert.ok(ids("2026-12-02").includes("handstand-elastique"));
  assert.ok(ids("2026-12-09").includes("hspu-assiste") && !ids("2026-12-09").includes("hspu-mur"));
  assert.ok(ids("2026-12-16").includes("hspu-mur") && !ids("2026-12-16").includes("hspu-assiste"));
  assert.ok(ids("2026-12-10").includes("pistol-prep") && !ids("2026-12-10").includes("pistol-squat"));
  assert.ok(ids("2026-12-17").includes("pistol-squat") && !ids("2026-12-17").includes("pistol-prep"));
  assert.ok(ids("2026-11-19").includes("squat-profond"));
});

test("progression : réussi → +2,5 kg ; pas assez → même charge ; deux échecs → −5 %", () => {
  let d: SportData = SPORT_DEPART;
  // Départ réglé à 100 kg ; 100 × 5 × 4 réussi.
  d = regler(d, "developpe-couche", { depart: 100 });
  d = enregistrer(d, seance("2026-11-16", "upper", [{ bloc: "developpe-couche", series: Array(4).fill({ charge: 100, reps: 5 }) }], at(16, 19)));
  assert.equal(prescriptions(d)["developpe-couche"].charge, 102.5);
  // 102,5 : 5, 5, 4, 4 → tenu (même charge).
  d = enregistrer(d, seance("2026-11-23", "upper", [{ bloc: "developpe-couche", series: [5, 5, 4, 4].map((r) => ({ charge: 102.5, reps: r })) }], at(23, 19)));
  assert.equal(prescriptions(d)["developpe-couche"].charge, 102.5);
  // Deux séances très en dessous → 97,5 kg (−5 %, arrondi à 2,5).
  d = enregistrer(d, seance("2026-11-30", "upper", [{ bloc: "developpe-couche", series: [3, 3, 2, 2].map((r) => ({ charge: 102.5, reps: r })) }], at(30, 19)));
  d = enregistrer(d, seance("2026-12-07", "upper", [{ bloc: "developpe-couche", series: [3, 3, 2, 2].map((r) => ({ charge: 102.5, reps: r })) }], new Date(2026, 11, 7, 19).getTime()));
  assert.equal(prescriptions(d)["developpe-couche"].charge, 97.5);
  // Plage : rowing 40 × [8-10] → 10 partout → 42,5 et retour à 8.
  d = enregistrer(d, seance("2026-11-16b", "upper", [{ bloc: "rowing-barre", series: Array(4).fill({ charge: 40, reps: 10 }) }], at(16, 20)));
  assert.deepEqual([prescriptions(d)["rowing-barre"].charge, prescriptions(d)["rowing-barre"].reps], [42.5, 8]);
  // Volume : tractions strictes 5 × 4 faites → 5 × 5. Maintien : planche 3 × 30 s → 35 s.
  d = enregistrer(d, seance("2026-11-20", "pull", [{ bloc: "tractions-strictes", series: Array(5).fill({ charge: 0, reps: 4 }) }], at(20, 19)));
  assert.equal(prescriptions(d)["tractions-strictes"].reps, 5);
  d = enregistrer(d, seance("2026-11-16c", "upper", [{ bloc: "planche", series: Array(3).fill({ charge: 0, reps: 30 }) }], at(16, 21)));
  assert.equal(prescriptions(d).planche.reps, 35);
  // Séance déjà faite : on voit ce qui était prévu ce jour-là, pas la charge suivante.
  const lundi = seanceDuJour(d, "2026-11-16", at(16, 22));
  assert.ok(lundi.faite);
  // Relecture du fichier.
  assert.deepEqual(nettoyerSport(JSON.parse(JSON.stringify(d))), d);
});

test("course : 5 km estimé d'après la meilleure perf, allures et plan sur 4 semaines", () => {
  assert.equal(estimation5k(SPORT_DEPART, at(17, 8)).source, "valeur de départ");
  const e = estimation5k(COUREUR, at(17, 8));
  assert.equal(e.source, "10 km test");
  assert.ok(Math.abs(e.secondes - riegel(3600, 10)) < 1);
  assert.equal(allure(e.secondes / 5), "5:45");
  const a = allures(COUREUR, at(17, 8));
  assert.equal(allure(a.facile[0]), "6:45");
  assert.equal(allure(a.seuil), "6:00");
  assert.equal(allure(a.intervalle), "5:35");
  const f = planCourse("fractionne", SPORT_DEPART, "2026-11-17", at(17, 8));
  assert.match(f.titre, /4 × 4 min/);
  assert.equal(f.dureeMin, 12 + 4 * 7 + 10);
  assert.match(f.etapes.join(" "), /3 min de trot/);
  assert.match(planCourse("fractionne", SPORT_DEPART, "2026-12-01", at(17, 8)).titre, /5 × 4 min/);
  assert.match(planCourse("fractionne", SPORT_DEPART, "2026-12-08", at(17, 8)).titre, /3 × 4 min/, "semaine 4 allégée");
  assert.match(planCourse("seuil", SPORT_DEPART, "2026-11-21", at(17, 8)).titre, /3 × 8 min/);
  assert.ok(planCourse("seuil", SPORT_DEPART, "2026-12-12", at(17, 8)).test, "semaine 4 : test 5 km");
  assert.match(planCourse("longue", SPORT_DEPART, "2026-11-22", at(22, 8)).titre, /40 min/);
  // Un test 5 km plus rapide recale les allures.
  const d = enregistrer(COUREUR, { id: "t", jour: "2026-12-12", type: "seuil", exercices: [], course: { distanceKm: 5, dureeS: 27 * 60, ressenti: "dur" }, at: new Date(2026, 11, 12, 10).getTime() });
  assert.equal(allure(estimation5k(d, new Date(2026, 11, 13).getTime()).secondes / 5), "5:24");
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
  const jeudi = cours.map((c) => ({ start: c.start + 2 * 86_400_000, end: c.end + 2 * 86_400_000 }));
  assert.match(ligneSport(SPORT_DEPART, "2026-11-19", jeudi, at(19, 7))!, /Jambes et mobilité à 18 h 20/);
});

test("tout se règle : départ, maximum, incrément, séries, reps, repos, + / −, semaine", () => {
  const dc = (d: SportData) => prescriptions(d)["developpe-couche"].charge;
  const reussi = (d: SportData, jour: string, t: number, kg: number, series = 4) => enregistrer(d, seance(jour, "upper", [{ bloc: "developpe-couche", series: Array(series).fill({ charge: kg, reps: 5 }) }], t));
  // Départ 85, max 90, +2 kg par séance réussie.
  let d = regler(SPORT_DEPART, "developpe-couche", { depart: 85, max: 90, increment: 2 });
  d = reussi(d, "2026-11-16", at(16, 19), 85);
  assert.equal(dc(d), 87);
  d = reussi(d, "2026-11-23", at(23, 19), 87);
  assert.equal(dc(d), 89);
  d = reussi(d, "2026-11-30", at(30, 19), 89);
  assert.equal(dc(d), 90, "bloqué au maximum");
  d = reussi(d, "2026-12-07", new Date(2026, 11, 7, 19).getTime(), 90);
  assert.equal(dc(d), 90);
  // Bouton + : 92 à la main (au-dessus du max, gardé).
  d = ajuster(d, { id: "a1", bloc: "developpe-couche", charge: 92, at: new Date(2026, 11, 8).getTime() });
  assert.equal(dc(d), 92);
  assert.throws(() => ajuster(d, { id: "a2", bloc: "developpe-couche", charge: -1, at: 1 }));
  // Séries, reps, repos : 5 × 3, 4 min.
  d = regler(d, "developpe-couche", { depart: 85, max: 100, increment: 2, series: 5, reps: 3, repos: 240 });
  const lundi = seanceDuJour(d, "2026-12-14", new Date(2026, 11, 14, 8).getTime()).blocs.find((b) => b.ex === "developpe-couche")!;
  assert.deepEqual([lundi.series, lundi.prescription.reps, lundi.repos], [5, 3, 240]);
  // Plage modifiée, max de reps au poids du corps.
  d = regler(d, "rowing-pronation", { plage: [6, 8] });
  assert.deepEqual(seanceDuJour(d, "2026-12-14", 0).blocs.find((b) => b.ex === "rowing-pronation")!.plage, [6, 8]);
  d = regler(d, "tractions-strictes", { depart: 8, max: 12 });
  assert.equal(prescriptions(d)["tractions-strictes"].reps, 8);
  const v = sportView(d, [], at(17, 8));
  const t = v.charges.find((c) => c.bloc === "tractions-strictes")!;
  assert.deepEqual([t.depart, t.max, t.enCharge, t.pas], [8, 12, false, 1]);
  const banc = v.charges.find((c) => c.bloc === "developpe-couche")!;
  assert.deepEqual([banc.depart, banc.max, banc.enCharge, banc.pas], [85, 100, true, 2]);
  assert.throws(() => regler(d, "developpe-couche", { depart: 100, max: 90 }));
  assert.throws(() => regler(d, "rowing-barre", { plage: [10, 6] }));
  assert.throws(() => regler(d, "inconnu", { max: 1 }));
  // Retour aux réglages de départ.
  assert.ok(!regler(d, "rowing-barre", null).reglages["rowing-barre"]);
  // Semaine : dimanche repos.
  d = reglerSemaine(d, ["upper", "leg", "fractionne", "push", "pull", "seuil", "repos"]);
  assert.equal(seanceDuJour(d, "2026-11-22", at(22, 8)).type, "repos");
  assert.ok(resumeSport(d).repos("2026-11-22"));
  assert.throws(() => reglerSemaine(d, ["upper"] as never));
  assert.deepEqual(nettoyerSport(JSON.parse(JSON.stringify(d))), d);
});

test("pour les objectifs : séance faite et reps de pompes / tractions par jour", () => {
  const d = enregistrer(SPORT_DEPART, seance("2026-11-18", "pull", [{ bloc: "tractions-strictes", series: [7, 7, 6, 6, 5].map((r) => ({ charge: 0, reps: r })) }], at(18, 19)));
  const r = resumeSport(d);
  assert.ok(r.seanceFaite["2026-11-18"]);
  assert.equal(r.sportReps["2026-11-18"]["tractions-strictes"], 31);
  assert.ok(!r.repos("2026-11-18"));
  assert.ok(r.repos("2026-11-20"), "vendredi : repos");
});

test("profil privé : charges de départ et perfs importées sans écraser ce qui est déjà réglé", () => {
  const d = regler(SPORT_DEPART, "squat", { depart: 70 });
  const p = { reglages: { "developpe-couche": { depart: 60 }, squat: { depart: 999 } }, perfs: COUREUR.perfs };
  const x = importerProfil(d, p);
  assert.equal(prescriptions(x)["developpe-couche"].charge, 60);
  assert.equal(prescriptions(x).squat.charge, 70);
  assert.equal(x.perfs.length, 1);
  assert.deepEqual(importerProfil(x, p), x);
});
