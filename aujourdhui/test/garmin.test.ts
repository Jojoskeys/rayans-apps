import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { EPOQUE_FIT, lireFit } from "../src/core/fit.ts";
import { activiteDepuisFit, importerMontre, type ActiviteMontre } from "../src/core/garmin.ts";
import { SPORT_DEPART, prescriptions, type SportData } from "../src/core/sport.ts";

// Petit fichier FIT fabriqué : une session (start_time, sport, timer, distance), little-endian.
function fitCourse(debut: Date, distanceM: number, timerS: number, sport = 1): Uint8Array {
  const def = [0x40, 0, 0, 18, 0, 4, 2, 4, 0x86, 5, 1, 0x00, 8, 4, 0x86, 9, 4, 0x86];
  const data = new DataView(new ArrayBuffer(1 + 4 + 1 + 4 + 4));
  data.setUint8(0, 0x00);
  data.setUint32(1, Math.round(debut.getTime() / 1000) - EPOQUE_FIT, true);
  data.setUint8(5, sport);
  data.setUint32(6, timerS * 1000, true);
  data.setUint32(10, distanceM * 100, true);
  const corps = new Uint8Array([...def, ...new Uint8Array(data.buffer)]);
  const tete = new Uint8Array(14);
  const v = new DataView(tete.buffer);
  v.setUint8(0, 14); v.setUint8(1, 0x20); v.setUint16(2, 2100, true); v.setUint32(4, corps.length, true);
  tete.set([0x2e, 0x46, 0x49, 0x54], 8);
  return new Uint8Array([...tete, ...corps, 0, 0]);
}

test("FIT de Rayan's Muscu (simulateur) : pompes, répétitions de chaque série avec la correction faite au repos", () => {
  const msgs = lireFit(fs.readFileSync(new URL("./fixtures/pompes-simulateur.fit", import.meta.url)));
  const a = activiteDepuisFit("pompes.fit", msgs);
  assert.deepEqual(a && { ...a, debut: new Date(a.debut).toISOString() }, {
    kind: "muscu", fichier: "pompes.fit", debut: "2026-11-17T16:24:09.000Z", exercice: "pompes", series: [4, 2],
  });
});

test("FIT de course : distance au centième de km, temps de chrono ; trop court ou autre sport ignoré", () => {
  const d = new Date(2026, 10, 21, 9, 30);
  assert.deepEqual(activiteDepuisFit("c.fit", lireFit(fitCourse(d, 5021, 1784))), { kind: "course", fichier: "c.fit", debut: d.getTime(), distanceKm: 5.02, dureeS: 1784 });
  assert.equal(activiteDepuisFit("c.fit", lireFit(fitCourse(d, 398, 112))), null);
  assert.equal(activiteDepuisFit("v.fit", lireFit(fitCourse(d, 25000, 3600, 2))), null);
  assert.throws(() => lireFit(new Uint8Array(20)), /pas un fichier FIT/);
});

const muscu = (jour: number, h: number, exercice: "tractions" | "pompes", series: number[]): ActiviteMontre =>
  ({ kind: "muscu", fichier: `${jour}-${exercice}.fit`, debut: new Date(2026, 10, jour, h).getTime(), exercice, series });

test("tractions le vendredi (tirage) : nouvelle séance, et la progression en tient compte", () => {
  const { data, ajouts } = importerMontre(SPORT_DEPART, [muscu(20, 18, "tractions", [7, 7, 7, 7, 7])]);
  assert.equal(data.journal.length, 1);
  assert.equal(data.journal[0].type, "pull");
  assert.deepEqual(data.journal[0].exercices, [{ bloc: "tractions-strictes", series: Array(5).fill({ charge: 0, reps: 7 }) }]);
  assert.deepEqual(ajouts, ["Tractions : 7 · 7 · 7 · 7 · 7"]);
  // Toutes les séries à 7 alors que la cible de départ est 4 : +1 rep.
  assert.equal(prescriptions(data)["tractions-strictes"].reps, 5);
});

test("pompes : en volume le jeudi (poussée), « pompes » le lundi (haut du corps), un autre jour dans la poussée", () => {
  const d = importerMontre(SPORT_DEPART, [muscu(19, 18, "pompes", [15]), muscu(16, 18, "pompes", [20, 18]), muscu(18, 18, "pompes", [10])]).data;
  const par = (jour: string) => d.journal.filter((s) => s.jour === jour).map((s) => [s.type, s.exercices.map((e) => e.bloc).join()]);
  assert.deepEqual(par("2026-11-19"), [["pull", "pompes-volume"]]);
  assert.deepEqual(par("2026-11-16"), [["upper", "pompes"]]);
  assert.deepEqual(par("2026-11-18"), [["pull", "pompes-volume"]]);
});

test("séance déjà saisie : l'exercice de la montre s'ajoute, sans toucher au reste ; une saisie existante l'emporte", () => {
  const saisie: SportData = { ...SPORT_DEPART, journal: [{ id: "s1", jour: "2026-11-20", type: "pull", at: new Date(2026, 10, 20, 19).getTime(),
    exercices: [{ bloc: "rowing-appuye", series: [{ charge: 12, reps: 10 }] }] }] };
  const a = importerMontre(saisie, [muscu(20, 18, "tractions", [6, 6])]).data;
  assert.equal(a.journal.length, 1);
  assert.deepEqual(a.journal[0].exercices.map((e) => e.bloc), ["rowing-appuye", "tractions-strictes"]);
  assert.equal(a.journal[0].id, "s1");
  const b = importerMontre(a, [muscu(20, 20, "tractions", [9, 9])]);
  assert.deepEqual(b.ajouts, []);
  assert.deepEqual(b.data.journal[0].exercices[1].series.map((s) => s.reps), [6, 6]);
});

test("course : dans la course prévue (samedi seuil), sinon sortie longue ; avant le début du plan ignorée", () => {
  const course = (jour: number, km: number, s: number): ActiviteMontre => ({ kind: "course", fichier: `${jour}.fit`, debut: new Date(2026, 10, jour, 10).getTime(), distanceKm: km, dureeS: s });
  const { data, ajouts } = importerMontre(SPORT_DEPART, [course(21, 5.02, 1784), course(19, 6, 2400), course(15, 10, 3600)]);
  assert.deepEqual(data.journal.map((s) => [s.jour, s.type, s.course?.distanceKm]), [["2026-11-19", "longue", 6], ["2026-11-21", "seuil", 5.02]]);
  assert.deepEqual(ajouts, ["Course : 6 km en 40:00", "Course : 5,02 km en 29:44"]);
});
