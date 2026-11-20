import { test } from "node:test";
import assert from "node:assert/strict";
import { barres, dernierEnvoi, distance, humeur, initiale, nombre, type JourMontre } from "../src/shared/montre.ts";

const j = (date: string, x: Partial<JourMontre> = {}): JourMontre => ({ date, eau: 0, seances: 0, humeurs: [], humeur: null, pas: null, distance: null, calories: null, coeur: null, ...x });

test("Montre : valeurs affichées, inconnu laissé vide", () => {
  assert.equal(nombre(8421), "8 421");
  assert.equal(nombre(null), "—");
  assert.equal(distance(850), "850 m");
  assert.equal(distance(6150), "6,2 km");
  assert.equal(distance(null), "—");
  assert.equal(humeur(4), "🙂 4/5");
  assert.equal(humeur(null), "—");
  assert.equal(initiale("2026-11-20"), "V");
  assert.equal(initiale("2026-11-16"), "L");
});

test("Montre : barres de la semaine, jour sans résumé à part", () => {
  const jours = [j("2026-11-18", { pas: 5000 }), j("2026-11-19"), j("2026-11-20", { pas: 10000, eau: 3 })];
  assert.deepEqual(barres(jours, (x) => x.pas), [0.5, null, 1]);
  assert.deepEqual(barres(jours, (x) => x.eau), [0, 0, 1]);
  assert.deepEqual(barres([j("2026-11-20")], (x) => x.eau), [0]);
});

test("Montre : dernier envoi", () => {
  const t = 1_800_000_000_000;
  assert.match(dernierEnvoi(null, t), /Tester la connexion/);
  assert.equal(dernierEnvoi(t - 20_000, t), "Dernier envoi de la montre : à l'instant");
  assert.equal(dernierEnvoi(t - 5 * 60_000, t), "Dernier envoi de la montre : il y a 5 min");
  assert.equal(dernierEnvoi(t - 3 * 3600_000, t), "Dernier envoi de la montre : il y a 3 h");
});
