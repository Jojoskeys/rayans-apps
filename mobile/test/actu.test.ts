import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTU_VIDE, ajouterEdition, JOURS_GARDES, nettoyerActu, type EditionActu } from "../src/shared/actu.ts";

const ed = (jour: string, titre = "Sujet"): EditionActu => ({ jour, genere: 1, mode: "claude", sujets: [{ titre, resume: "Deux phrases.", sources: [{ media: "Le Monde", lien: "https://www.lemonde.fr/a", titre: "A" }], uneSource: true }] });

test("actu : fichier abîmé → vide ; liens non http et sujets sans source écartés", () => {
  assert.deepEqual(nettoyerActu(null), ACTU_VIDE);
  assert.deepEqual(nettoyerActu({ editions: "x" }), ACTU_VIDE);
  const d = nettoyerActu({ editions: [{ jour: "2026-11-20", mode: "bizarre", sujets: [
    { titre: "Bon", resume: "R", sources: [{ media: "BBC News", lien: "https://bbc.co.uk/1" }, { media: "Le Monde", lien: "javascript:alert(1)" }] },
    { titre: "Sans source", sources: [] },
  ] }, { jour: "pas une date", sujets: [] }] });
  assert.equal(d.editions.length, 1);
  assert.equal(d.editions[0].mode, "simple");
  assert.deepEqual(d.editions[0].sujets, [{ titre: "Bon", resume: "R", sources: [{ media: "BBC News", lien: "https://bbc.co.uk/1", titre: "" }], uneSource: true }]);
});

test("actu : l'édition du jour remplace celle du même jour, les plus récentes d'abord, 7 jours gardés", () => {
  let d = ACTU_VIDE;
  for (let j = 10; j <= 20; j++) d = ajouterEdition(d, ed(`2026-11-${j}`));
  d = ajouterEdition(d, ed("2026-11-20", "Nouveau"));
  assert.equal(d.editions.length, JOURS_GARDES);
  assert.equal(d.editions[0].jour, "2026-11-20");
  assert.equal(d.editions[0].sujets[0].titre, "Nouveau");
  assert.equal(d.editions.at(-1)!.jour, "2026-11-14");
});
