// Liste de courses et données locales (favoris, « je l'ai faite », recettes perso, panier).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleIngredient, detailArticle, listeCourses, nomIngredient, rayon, texteCourses } from "../src/core/courses.ts";
import { appliquer, donneesVides, normaliser } from "../src/core/donnees.ts";
import type { Recette } from "../src/core/types.ts";

const rec = (id: string, titre: string, ingredients: string[]): Recette => ({ id, titre, ingredients, etapes: [], origine: "favoris" });

test("nom du produit sans quantité ni précision", () => {
  assert.equal(nomIngredient("200 g de flocons d'avoine (fins)"), "flocons d'avoine");
  assert.equal(nomIngredient("3 Œufs"), "œufs");
  assert.equal(nomIngredient("2 c. à soupe de miel"), "miel");
  assert.equal(nomIngredient("1 cuillère à café de cannelle"), "cannelle");
  assert.equal(nomIngredient("une pincée de sel"), "sel");
  assert.equal(nomIngredient("1/2 avocat, coupé en dés"), "avocat");
  assert.equal(nomIngredient("100 à 150 g de poulet halal"), "poulet halal");
  assert.equal(nomIngredient("du beurre de cacahuète"), "beurre de cacahuète");
  assert.equal(nomIngredient("lait"), "lait");
  assert.equal(nomIngredient("un peu de mayonnaise"), "mayonnaise");
  assert.equal(nomIngredient("200g de riz"), "riz");
  assert.equal(nomIngredient("3e ingrédient non montré"), "3e ingrédient non montré");
  assert.equal(nomIngredient("(au goût)"), "(au goût)", "rien ne reste : la ligne d'origine");
});

test("même produit, même clé : pluriel, accents, majuscules", () => {
  assert.equal(cleIngredient("2 Œufs"), cleIngredient("1 oeuf"));
  assert.equal(cleIngredient("3 bananes bien mûres"), "banane bien mure");
  assert.equal(cleIngredient("2 tomates"), cleIngredient("tomate"));
});

test("rayons : le motif le plus précis gagne", () => {
  assert.equal(rayon(cleIngredient("beurre de cacahuète")), "Épicerie");
  assert.equal(rayon(cleIngredient("beurre doux")), "Frais et laitiers");
  assert.equal(rayon(cleIngredient("2 patates douces")), "Fruits et légumes");
  assert.equal(rayon(cleIngredient("blancs d'œufs")), "Viandes, poissons, œufs");
  assert.equal(rayon(cleIngredient("papier cuisson")), "Autres");
});

test("liste de courses : ingrédients regroupés par produit puis par rayon", () => {
  const omelette = rec("a", "Omelette", ["3 œufs", "100 g de poulet", "sel"]);
  const pancakes = rec("b", "Pancakes", ["2 oeufs", "40 g de flocons d'avoine", "1 banane", "sel"]);
  const g = listeCourses([omelette, pancakes]);
  assert.deepEqual(g.map((x) => x.rayon), ["Fruits et légumes", "Viandes, poissons, œufs", "Épicerie"]);
  const viandes = g[1].articles;
  assert.deepEqual(viandes.map((a) => a.nom), ["œufs", "poulet"]);
  assert.deepEqual(viandes[0].lignes, [{ texte: "3 œufs", recette: "Omelette" }, { texte: "2 oeufs", recette: "Pancakes" }]);
  assert.equal(detailArticle(viandes[0]), "3 œufs (Omelette) ; 2 oeufs (Pancakes)");
  const sel = g[2].articles.find((a) => a.nom === "sel")!;
  assert.equal(detailArticle(sel), "2 recettes", "même texte partout : juste le nombre de recettes");
  assert.deepEqual(listeCourses([]), []);
});

test("texte copiable de la liste", () => {
  const recettes = [rec("a", "Omelette", ["3 œufs", "sel"]), rec("b", "Riz", ["riz"])];
  assert.equal(texteCourses(listeCourses(recettes), recettes),
    "Liste de courses — Omelette, Riz\n\nViandes, poissons, œufs\n- œufs : 3 œufs (Omelette)\n\nÉpicerie\n- riz\n- sel\n");
});

test("données : favori, je l'ai faite avec date, panier, recettes perso", () => {
  let d = donneesVides();
  d = appliquer(d, { type: "favori", id: "a" });
  assert.deepEqual(d.favoris, ["a"]);
  d = appliquer(d, { type: "faite", id: "a", at: 2000 });
  d = appliquer(d, { type: "faite", id: "a", at: 1000 });
  assert.deepEqual(d.faites.a, [1000, 2000]);
  d = appliquer(d, { type: "annulerFaite", id: "a", at: 1000 });
  d = appliquer(d, { type: "annulerFaite", id: "a", at: 2000 });
  assert.equal(d.faites.a, undefined);
  d = appliquer(d, { type: "panier", id: "a", dedans: true });
  d = appliquer(d, { type: "panier", id: "a", dedans: true });
  assert.deepEqual(d.panier, ["a"]);
  const perso: Recette = { id: "perso-1", titre: " Bowl ", ingredients: ["riz", " "], etapes: ["Cuire"], lien: "javascript:alert(1)", origine: "perso" };
  d = appliquer(d, { type: "ajouterPerso", recette: perso });
  assert.equal(d.perso[0].titre, "Bowl");
  assert.deepEqual(d.perso[0].ingredients, ["riz"]);
  assert.equal(d.perso[0].lien, undefined, "seuls les liens web sont gardés");
  assert.equal(appliquer(d, { type: "ajouterPerso", recette: { ...perso, id: "x" } }), d, "id non perso refusé");
  d = appliquer(d, { type: "favori", id: "perso-1" });
  d = appliquer(d, { type: "panier", id: "perso-1", dedans: true });
  d = appliquer(d, { type: "supprimerPerso", id: "perso-1" });
  assert.deepEqual([d.perso, d.favoris, d.panier], [[], ["a"], ["a"]]);
  assert.deepEqual(appliquer(d, { type: "viderPanier" }).panier, []);
});

test("données : fichier abîmé réparé", () => {
  assert.deepEqual(normaliser(null), donneesVides());
  const d = normaliser({ favoris: ["a", "a", 3], faites: { a: [3, "x", 1], b: [] }, perso: [{ id: "perso-2", titre: "T", ingredients: ["x"] }, { titre: "sans id" }], panier: "b" });
  assert.deepEqual(d.favoris, ["a"]);
  assert.deepEqual(d.faites, { a: [1, 3] });
  assert.equal(d.perso.length, 1);
  assert.deepEqual(d.panier, []);
});
