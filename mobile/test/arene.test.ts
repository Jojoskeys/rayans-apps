import { test } from "node:test";
import assert from "node:assert/strict";
import { achat, nettoyerPrix, planMensuel, tauxLivret } from "../src/shared/arene.ts";

const jours = (n: number, debut = "2020-01-01") => Array.from({ length: n }, (_, i) => new Date(Date.parse(`${debut}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));

test("Arène : achat en parts entières, frais 1 € minimum, l'argent attend si une part est trop chère", () => {
  assert.deepEqual(achat(100, 60), { parts: 1, cout: 61 });
  assert.deepEqual(achat(100, 99.5), { parts: 0, cout: 0 });
});

test("Arène : plan mensuel à prix fixe (mêmes chiffres que arene/mensuel.py)", () => {
  const d = jours(365);
  const p = planMensuel(d, d.map(() => 10), 100);
  assert.equal(p.verse, 1200);
  assert.equal(p.achats, 12);
  assert.equal(p.frais, 12);
  assert.equal(Math.round(p.valeur), 1188);
  assert.equal(p.chute, 0);
});

test("Arène : pire chute, remontée et pire moment", () => {
  const d = jours(400);
  const prix = d.map((_, i) => (i < 100 ? 100 : i < 200 ? 70 : 100));
  const p = planMensuel(d, prix, 1000);
  assert.ok(Math.abs(p.chute + 0.3) < 1e-9);
  assert.equal(p.chuteRetour, d[200]);
  assert.ok(p.pireValeur < p.pireVerse);
});

test("Arène : Livret A et prix venus du réseau", () => {
  assert.equal(tauxLivret("2023-06-01"), 0.03);
  assert.equal(nettoyerPrix({ dates: ["2020-01-01"], prix: [1] }), null);
  assert.equal(nettoyerPrix(null), null);
  const d = jours(40);
  assert.equal(nettoyerPrix({ actif: "X", nom: "X", devise: "€", dates: d, prix: d.map(() => 5) })?.dates.length, 40);
  assert.equal(nettoyerPrix({ dates: d, prix: d.map(() => -1) }), null);
});
