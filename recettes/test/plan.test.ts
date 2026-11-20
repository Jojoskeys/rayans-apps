// Plan de repas, listes de courses jour / semaine, magasins conseillés (recettes inventées pour les tests).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleIngredient, detailArticle, listeCourses } from "../src/core/courses.ts";
import { appliquer, donneesVides, normaliser } from "../src/core/donnees.ts";
import { lireFiche } from "../src/core/lecture.ts";
import { a, conseil, magasinDe, parMagasin, texteParMagasin } from "../src/core/magasins.ts";
import {
  candidats, changerCase, genererPlan, lundiDe, preparationsDuJour, recettesDeLaSemaine, recettesDuJour, totalDuJour,
} from "../src/core/plan.ts";
import { REPAS, type Plan, type Recette } from "../src/core/types.ts";

const rec = (id: string, titre: string, ingredients: string[], etapes: string[] = ["Cuire 10 min"], plus: Partial<Recette> = {}): Recette =>
  ({ id, titre, ingredients, etapes, origine: "favoris", ...plus });

const RECETTES: Recette[] = [
  rec("pd1", "Overnight oats protéinés", ["50 g de flocons d'avoine", "1 skyr", "whey"], ["Mélanger", "Laisser au frigo toute la nuit"]),
  rec("pd2", "Pancakes à la whey", ["2 œufs", "1 banane", "whey"]),
  rec("pd3", "Omelette aux épinards", ["3 œufs", "épinards"]),
  rec("c1", "Cookies protéinés", ["1 banane", "pépites de chocolat"]),
  rec("c2", "Mug cake au chocolat", ["1 œuf", "cacao"]),
  rec("c3", "Smoothie banane", ["1 banane", "lait"]),
  rec("r1", "Bowl poulet riz", ["150 g de poulet halal", "80 g de riz"]),
  rec("r2", "Patate douce et bœuf haché", ["patate douce", "bœuf haché halal"], ["Cuire au four 35 min", "Cuire la viande"]),
  rec("r3", "Salade de pâtes au thon", ["pâtes", "thon", "tomates"]),
  rec("r4", "Wrap de dinde", ["tortilla", "dinde", "salade"]),
  rec("r5", "Curry de pois chiches", ["pois chiches", "curry", "riz"], ["Cuire 20 min"]),
  rec("r6", "Poulet mariné au four", ["poulet", "yaourt", "épices"], ["Faire mariner 2 h au frigo", "Cuire au four"]),
  rec("r7", "Gratin de courgettes", ["courgettes", "fromage râpé"]),
];
const parId = new Map(RECETTES.map((r) => [r.id, r]));
const DEBUT = "2026-11-16";

test("lundi de la semaine", () => {
  assert.equal(lundiDe(new Date(2026, 10, 20)), "2026-11-16");
  assert.equal(lundiDe(new Date(2026, 10, 22)), "2026-11-16", "dimanche : lundi d'avant");
  assert.equal(lundiDe(new Date(2026, 10, 23)), "2026-11-23");
});

test("candidats : collations, petit-déjeuner, repas", () => {
  assert.deepEqual(candidats(RECETTES, "collation").map((r) => r.id).sort(), ["c1", "c2", "c3", "pd1", "pd2"].sort());
  assert.ok(candidats(RECETTES, "petitDej").map((r) => r.id).includes("pd1"));
  const repas = candidats(RECETTES, "diner").map((r) => r.id);
  assert.ok(repas.includes("r1") && !repas.includes("c1"));
  assert.ok(!repas.includes("pd1"), "« Overnight oats » n'est pas un dîner");
  const burger = rec("b", "Bol burger au poulet", ["poulet"], ["Cuire"], { pourRayan: "Remplace la sauce par du yaourt." });
  assert.deepEqual(candidats([burger], "petitDej"), [], "un mot dans les remarques ne fait pas un petit-déjeuner");
  assert.deepEqual(candidats([burger], "diner"), [burger]);
});

test("plan : 7 jours, 4 cases, toujours le même avec la même graine", () => {
  const p = genererPlan(RECETTES, { debut: DEBUT, graine: 7 });
  assert.equal(p.debut, DEBUT);
  assert.equal(p.jours.length, 7);
  for (const j of p.jours) {
    assert.deepEqual(Object.keys(j).sort(), [...REPAS].sort());
    for (const r of REPAS) assert.ok(j[r].id && parId.has(j[r].id!), "chaque case est remplie");
  }
  assert.deepEqual(genererPlan(RECETTES, { debut: DEBUT, graine: 7 }), p);
});

test("plan : variété, bonnes cases, protéines d'abord aux repas", () => {
  for (const graine of [1, 2, 3, 42, 99]) {
    const p = genererPlan(RECETTES, { debut: DEBUT, graine });
    for (let n = 0; n < 7; n++) {
      const ids = REPAS.map((r) => p.jours[n][r].id);
      assert.equal(new Set(ids).size, 4, "pas deux fois la même recette le même jour");
      for (const r of REPAS) {
        if (n < 6) assert.notEqual(p.jours[n][r].id, p.jours[n + 1][r].id, "pas la même recette deux jours de suite");
        assert.ok(candidats(RECETTES, r).some((x) => x.id === p.jours[n][r].id), `${r} : une recette qui convient`);
      }
      for (const r of ["dejeuner", "diner"] as const) assert.notEqual(p.jours[n][r].id, "r7", "le gratin (sans protéines) passe après");
    }
  }
});

test("plan : cases modifiées gardées quand on régénère, cases libres comprises", () => {
  let p = genererPlan(RECETTES, { debut: DEBUT, graine: 5 });
  p = changerCase(p, 2, "diner", "r7");
  p = changerCase(p, 4, "collation", null);
  assert.deepEqual(p.jours[2].diner, { id: "r7", fixe: true });
  for (const graine of [6, 7, 8]) {
    const q = genererPlan(RECETTES, { debut: DEBUT, graine, precedent: p });
    assert.deepEqual(q.jours[2].diner, { id: "r7", fixe: true });
    assert.deepEqual(q.jours[4].collation, { id: null, fixe: true });
    assert.notEqual(q.jours[1].diner.id, "r7", "la veille évite la recette choisie");
    assert.notEqual(q.jours[3].diner.id, "r7");
  }
  const sansR7 = genererPlan(RECETTES.filter((r) => r.id !== "r7"), { debut: DEBUT, graine: 6, precedent: p });
  assert.equal(sansR7.jours[2].diner.fixe, false, "une recette supprimée n'est pas gardée");
});

test("plan : peu de recettes → cases libres plutôt qu'une mauvaise recette", () => {
  const p = genererPlan([rec("r1", "Bowl poulet riz", ["poulet", "riz"])], { debut: DEBUT, graine: 1 });
  assert.equal(p.jours[0].dejeuner.id, "r1");
  assert.equal(p.jours[0].collation.id, null);
  assert.equal(p.jours[0].diner.id, null, "jamais deux fois la même recette le même jour");
  assert.deepEqual(genererPlan([], { debut: DEBUT }).jours[3].diner, { id: null, fixe: false });
});

const PLAN: Plan = {
  debut: DEBUT,
  jours: Array.from({ length: 7 }, (_, n) => ({
    petitDej: { id: n === 1 ? "pd1" : "pd3", fixe: false },
    dejeuner: { id: "r1", fixe: false },
    collation: { id: n === 0 ? "c1" : null, fixe: false },
    diner: { id: n === 0 ? "r6" : "r3", fixe: false },
  })),
};

test("ce que tu prépares : repas du jour, et ce soir ce qui doit reposer pour demain", () => {
  const lundi = preparationsDuJour(PLAN, parId, 0);
  assert.deepEqual(lundi.map((p) => [p.recette.id, p.quand]), [["pd3", "aujourdhui"], ["r1", "aujourdhui"], ["c1", "aujourdhui"], ["r6", "des-que-possible"], ["pd1", "ce-soir"]]);
  const mardi = preparationsDuJour(PLAN, parId, 1);
  assert.ok(!mardi.some((p) => p.recette.id === "pd1"), "les overnight oats ont été préparés la veille");
  assert.ok(!preparationsDuJour(PLAN, parId, 6).some((p) => p.quand === "ce-soir"), "dimanche : la semaine suivante n'est pas connue");
});

test("total du jour : seulement avec les chiffres des fiches, jamais inventés", () => {
  assert.equal(totalDuJour(PLAN, parId, 0), null);
  const avec = new Map(parId);
  avec.set("r1", { ...parId.get("r1")!, kcal: 520, proteines: 42 });
  avec.set("pd3", { ...parId.get("pd3")!, proteines: 20 });
  assert.deepEqual(totalDuJour(PLAN, avec, 2), { kcal: 520, proteines: 62, renseignees: 2, recettes: 3 });
  const f = lireFiche({ id: "x", categorie: "recette", recette: { titre: "T", ingredients: ["a"], kcal: "450 kcal" }, nutrition: { proteines: 30 } })!;
  assert.deepEqual([f.kcal, f.proteines], [450, 30]);
  assert.deepEqual([lireFiche({ id: "y", categorie: "recette", recette: { titre: "T", ingredients: ["a"], kcal: "beaucoup" } })!.kcal], [undefined]);
});

test("listes de courses du jour et de la semaine", () => {
  const lundi = recettesDuJour(PLAN, parId, 0).map((x) => x.recette.id);
  assert.deepEqual(lundi, ["pd3", "r1", "c1", "r6"]);
  const semaine = recettesDeLaSemaine(PLAN, parId);
  assert.equal(semaine.length, 7 * 3 + 1, "une recette prévue plusieurs fois compte plusieurs fois");
  const g = listeCourses(semaine);
  const poulet = g.flatMap((x) => x.articles).find((x) => x.cle === cleIngredient("poulet halal"))!;
  assert.equal(detailArticle(poulet), "150 g de poulet halal (Bowl poulet riz) ×7");
  const libre = { ...PLAN, jours: PLAN.jours.map((j) => ({ ...j, collation: { id: null, fixe: true } })) };
  assert.equal(recettesDuJour(libre, parId, 0).length, 3, "une case libre n'ajoute rien");
});

test("magasins conseillés par type de produit", () => {
  assert.deepEqual(conseil(cleIngredient("80 g de riz")).magasins, ["Lidl", "Aldi", "Leclerc"]);
  assert.equal(conseil(cleIngredient("150 g de poulet halal")).magasins[0], "Boucherie halal");
  assert.ok(conseil(cleIngredient("bœuf haché")).magasins.includes("Rayon halal (Leclerc, Carrefour, Auchan)"));
  assert.deepEqual(conseil(cleIngredient("2 tomates")).magasins, ["Marché", "Grand Frais", "Lidl"]);
  assert.equal(conseil(cleIngredient("ras el hanout")).magasins[0], "Épicerie orientale");
  assert.ok(conseil(cleIngredient("1 dose de whey")).magasins.includes("Decathlon"));
  assert.equal(conseil(cleIngredient("beurre de cacahuète")).type, "Épicerie sucrée", "le motif le plus précis gagne");
  assert.equal(conseil(cleIngredient("beurre")).type, "Produits laitiers");
  assert.equal(conseil(cleIngredient("papier cuisson")).type, "Autres produits");
  for (const c of [conseil("riz"), conseil("poulet"), conseil("tomate"), conseil("xyz")]) {
    assert.ok(c.magasins.length >= 2 && c.magasins.length <= 3);
    assert.ok(!/\d+\s*(€|euros?)/.test(c.note), "pas de prix");
  }
});

test("magasin choisi par Rayan gardé dans les données, liste regroupée par magasin", () => {
  let d = donneesVides();
  d = appliquer(d, { type: "magasin", cle: "riz", magasin: "Grand Frais" });
  assert.equal(magasinDe("riz", d.magasins), "Grand Frais");
  assert.equal(magasinDe("pate", d.magasins), "Lidl");
  assert.deepEqual(normaliser(JSON.parse(JSON.stringify(d))).magasins, { riz: "Grand Frais" });
  const g = parMagasin(listeCourses([rec("a", "Bowl", ["riz", "pâtes", "poulet", "tomates"])]), d.magasins);
  assert.deepEqual(g.map((x) => [x.magasin, x.articles.map((y) => y.nom)]), [
    ["Lidl", ["pâtes"]], ["Marché", ["tomates"]], ["Grand Frais", ["riz"]], ["Boucherie halal", ["poulet"]],
  ]);
  const t = texteParMagasin("Courses", g);
  assert.ok(t.includes("À Lidl :\n- pâtes") && t.includes("Au marché :") && t.includes("À la boucherie halal :"));
  assert.ok(t.trim().endsWith("Les prix varient selon les magasins et les semaines."));
  assert.equal(a("Site de nutrition sportive (en promo)"), "Sur un site de nutrition sportive (en promo)");
  d = appliquer(d, { type: "magasin", cle: "riz", magasin: null });
  assert.deepEqual(d.magasins, {});
  // Articles pris pendant les courses (cochés sur le PC ou l'iPhone), gardés dans les données.
  d = appliquer(d, { type: "achete", cle: "riz", oui: true, at: 7 });
  assert.deepEqual(normaliser(JSON.parse(JSON.stringify(d))).achetes, { riz: 7 });
  assert.deepEqual(appliquer(d, { type: "achete", cle: "riz", oui: false, at: 8 }).achetes, {});
  assert.deepEqual(appliquer(d, { type: "viderAchetes" }).achetes, {});
  assert.deepEqual(normaliser({ achetes: { a: "x", b: 3 } }).achetes, { b: 3 });
});

test("plan gardé dans les données : case changée, fichier abîmé réparé", () => {
  let d = donneesVides();
  assert.equal(appliquer(d, { type: "casePlan", jour: 0, repas: "diner", id: "r1" }), d, "sans plan, rien à changer");
  d = appliquer(d, { type: "plan", plan: genererPlan(RECETTES, { debut: DEBUT, graine: 3 }) });
  d = appliquer(d, { type: "casePlan", jour: 3, repas: "dejeuner", id: null });
  const relu = normaliser(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(relu.plan, d.plan);
  assert.deepEqual(relu.plan!.jours[3].dejeuner, { id: null, fixe: true });
  assert.equal(normaliser({ plan: { debut: "hier", jours: [] } }).plan, null);
  const abime = normaliser({ plan: { debut: DEBUT, jours: [{ diner: { id: "r1", fixe: "oui" } }] } }).plan!;
  assert.equal(abime.jours.length, 7);
  assert.deepEqual(abime.jours[0].diner, { id: "r1", fixe: false });
  assert.deepEqual(abime.jours[6].diner, { id: null, fixe: false });
});
