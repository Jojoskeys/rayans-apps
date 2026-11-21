import { test } from "node:test";
import assert from "node:assert/strict";
import { bornesExamen, DUREES, dureeTotale, enTete, hasard, meilleur, message, moment, naissances, nettoyerFilm, placeChampion, position, rangs, surPiste, type Agent } from "../src/shared/film.ts";

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

test("Film : le scénario (moments et textes) est le même pour la 2D et la 3D", () => {
  const f = nettoyerFilm(film)!, { GEN, SACRE, EXAMEN, FIN } = DUREES;
  assert.equal(dureeTotale(f), 2 * GEN + SACRE + EXAMEN + FIN);
  assert.deepEqual(moment(f, 0), { phase: "generation", g: 0, ph: 0 });
  assert.equal((moment(f, GEN + 0.5) as { g: number }).g, 1);
  assert.equal(moment(f, 2 * GEN + 0.1).phase, "sacre");
  assert.deepEqual(moment(f, 2 * GEN + SACRE + EXAMEN + 1), { phase: "examen", te: 1, i: 1 });
  assert.match(message(f, 0.1), /grossit/);
  assert.match(message(f, DUREES.MORTS + 0.1), /meurt/);
  assert.match(message(f, DUREES.NAISSANCES + 0.1), /enfants/);
  assert.match(message(f, 2 * GEN + 1), /^Sa règle : r/);
  // l'examen : 1 % pour la championne contre 2 % sans rien faire → texte honnête
  assert.match(message(f, dureeTotale(f)), /À l'examen : \+1,0 %, contre \+2,0 % sans rien faire/);
  assert.match(message({ ...f, examen: { ...f.examen, champion: [0, 0.05] } }, dureeTotale(f)), /Elle gagne cette fois/);
});

test("Film : la course 3D, le gain cumulé donne la place sur la piste", () => {
  const b = bornesExamen({ dates: ["a", "b", "c"], champion: [0, -0.1, 0.1], ag: [0, 0.2, 0.3] });
  assert.deepEqual(b, { lo: -0.1, hi: 0.3 });
  assert.equal(surPiste(0, b.lo, b.hi, 40), 10);        // le départ, un quart de la piste
  assert.equal(surPiste(-0.1, b.lo, b.hi, 40), 0);      // qui perd recule
  assert.equal(surPiste(0.3, b.lo, b.hi, 40), 40);      // le meilleur gain : au bout
  assert.ok(surPiste(0.1, b.lo, b.hi, 40) < surPiste(0.2, b.lo, b.hi, 40));
  assert.equal(surPiste(9, b.lo, b.hi, 40), 40);        // jamais hors de la piste
  assert.deepEqual(bornesExamen({ dates: ["a"], champion: [0], ag: [0] }), { lo: -0.01, hi: 0.01 });
});
