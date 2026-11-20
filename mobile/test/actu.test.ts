import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTU_VIDE, ajouterEdition, JOURS_GARDES, nettoyerActu, parRubrique, tempsLecture, titresEssentiel, type EditionActu } from "../src/shared/actu.ts";

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

test("actu v2 : rubrique, « pourquoi », image (https seulement) et intro gardés ; valeurs inconnues écartées", () => {
  const d = nettoyerActu({ editions: [{ jour: "2026-11-20", genere: 1, mode: "claude", intro: "  Deux phrases d'intro.  ", sujets: [
    { titre: "A", resume: "R", rubrique: "essentiel", pourquoi: "Parce que.", image: "https://img/a.jpg", sources: [{ media: "Next", lien: "https://next.ink/a" }] },
    { titre: "B", resume: "", rubrique: "inconnue", image: "http://img/b.jpg", sources: [{ media: "BBC News", lien: "https://bbc.co.uk/b" }] },
    { titre: "C", resume: "", rubrique: "bref", image: "javascript:alert(1)", sources: [{ media: "Zataz", lien: "https://zataz.com/c" }] },
  ] }] });
  const e = d.editions[0];
  assert.equal(e.intro, "Deux phrases d'intro.");
  assert.deepEqual(e.sujets[0], { titre: "A", resume: "R", sources: [{ media: "Next", lien: "https://next.ink/a", titre: "" }], uneSource: true, rubrique: "essentiel", pourquoi: "Parce que.", image: "https://img/a.jpg" });
  assert.deepEqual(Object.keys(e.sujets[1]), ["titre", "resume", "sources", "uneSource"]);
  assert.equal(e.sujets[2].image, undefined);
});

test("actu : sommaire par rubrique dans l'ordre ; une ancienne édition sans rubrique s'affiche en une seule liste", () => {
  const s = (titre: string, rubrique?: "essentiel" | "tech" | "geo" | "bref") => ({ titre, resume: "Une phrase de dix mots pour compter le temps de lecture.", sources: [{ media: "Le Monde", lien: "https://lm.fr", titre }], uneSource: true, ...(rubrique ? { rubrique } : {}) });
  const v2: EditionActu = { jour: "2026-11-20", genere: 1, mode: "simple", sujets: [s("G", "geo"), s("E1", "essentiel"), s("T", "tech"), s("E2", "essentiel"), s("B", "bref")] };
  assert.deepEqual(parRubrique(v2).map((r) => [r.id, r.sujets.map((x) => x.titre)]), [["essentiel", ["E1", "E2"]], ["tech", ["T"]], ["geo", ["G"]], ["bref", ["B"]]]);
  assert.deepEqual(titresEssentiel(v2), ["E1", "E2"]);
  const v1 = ed("2026-11-19");
  assert.deepEqual(parRubrique(v1).map((r) => [r.id, r.nom, r.sujets.length]), [["une", "À la une", 1]]);
  assert.deepEqual(titresEssentiel(v1), ["Sujet"]);
  assert.equal(tempsLecture(v1), 1);
  assert.equal(tempsLecture({ ...v2, sujets: Array.from({ length: 40 }, (_, i) => s(`Sujet ${i}`, "tech")) }), 2);
});
