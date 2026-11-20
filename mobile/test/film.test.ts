import { test } from "node:test";
import assert from "node:assert/strict";
import { enTete, hasard, meilleur, naissances, nettoyerFilm, placeChampion, position, rangs, type Agent } from "../src/shared/film.ts";

const gens: Agent[][] = [
  [[0, -1, 0, 0.2, true], [1, -1, 1, -0.1, false], [2, -1, 2, 0.5, true], [3, -1, 3, 0.0, false]],
  [[2, -1, 2, 0.5, true], [0, -1, 0, 0.2, true], [4, 2, 2, 0.6, false], [5, 0, 0, 0.1, false]],
];
const film = { nom: "x", entrainement: "2021–2023", test: "2024", types: ["a", "b", "c", "d"], generations: gens,
  champion: { regle: "r", entrainement: 0.5, ordres: 3, id: 4, parent: 2, type: 2 }, examen: { dates: ["2024-01-02", "2024-01-03"], champion: [0, 0.01], ag: [0, 0.02] } };

test("Film : lecture prudente du fichier", () => {
  assert.equal(nettoyerFilm(film)?.generations.length, 2);
  assert.equal(nettoyerFilm(null), null);
  assert.equal(nettoyerFilm({ ...film, generations: [] }), null);
  assert.equal(nettoyerFilm({ ...film, examen: { ...film.examen, ag: [0] } }), null);
  assert.equal(nettoyerFilm({ ...film, generations: [[[0, -1, 9, 0.1, true]]] }), null);   // type inconnu
});

test("Film : naissances, rangs, meilleur", () => {
  assert.deepEqual(naissances(gens, 0), [{ id: 4, parent: 2, type: 2 }, { id: 5, parent: 0, type: 0 }]);
  assert.deepEqual(naissances(gens, 1), []);
  const r = rangs(gens[0]);
  assert.equal(r.get(2), 1); assert.equal(r.get(1), 0);
  assert.equal(meilleur(gens[1])[0], 4);
});

test("Film : chaque robot reste dans l'arène et garde la même allure", () => {
  assert.equal(hasard(7, 1), hasard(7, 1));
  for (let id = 0; id < 200; id++) for (const t of [0, 3.3, 47]) {
    const p = position(id, t, 360, 380, 18, 58);
    assert.ok(p.x >= 18 && p.x <= 342 && p.y >= 58 && p.y <= 362, `${id} ${t}`);
  }
});

test("Film : la championne est placée sur elle-même ou sur son parent", () => {
  const f = nettoyerFilm(film)!;
  assert.deepEqual(placeChampion(f), { id: 4, ne: false });
  assert.deepEqual(placeChampion({ ...f, champion: { ...f.champion, id: 9, parent: 0 } }), { id: 0, ne: true });
  assert.equal(enTete(gens[0])[0], 0);
});
