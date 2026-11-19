import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeText } from "../src/shared/merge.ts";
import {
  ajouterArticle, ajouterMemo, ajouterPlusieurs, chercherMemos, cocherArticle, COURSES_VIDES, MEMOS_VIDES, minuit,
  parRayon, planDemain, rayonDe, REGLAGES_DEMAIN, retirerFaits, tagsDe, tagsFrequents,
} from "../src/shared/petites.ts";

let n = 0;
const id = () => `id${++n}`;

test("Courses : rayon deviné, doublon remis à acheter, tri par rayon", () => {
  assert.equal(rayonDe("Pommes de terre"), "Fruits et légumes");
  assert.equal(rayonDe("2 avocats"), "Fruits et légumes");
  assert.equal(rayonDe("lait demi-écrémé"), "Frais");
  assert.equal(rayonDe("Gel douche"), "Hygiène");
  assert.equal(rayonDe("cadeau maman"), "Autre");
  let d = ajouterPlusieurs(COURSES_VIDES, "savon, Lait\nbananes ; ", 1, id);
  assert.deepEqual(d.articles.map((a) => a.nom), ["savon", "Lait", "bananes"]);
  d = cocherArticle(d, d.articles[1].id, 2);
  d = ajouterArticle(d, "lait", 3, id()); // déjà là : remis à acheter, pas de doublon
  assert.equal(d.articles.length, 3);
  assert.equal(d.articles[1].fait, false);
  assert.deepEqual(parRayon(d).aAcheter.map((g) => g.rayon), ["Fruits et légumes", "Frais", "Hygiène"]);
  d = cocherArticle(d, d.articles[0].id, 4);
  assert.equal(parRayon(d).faits.length, 1);
  assert.equal(retirerFaits(d).articles.length, 2);
});

test("Courses : la fusion garde les ajouts des deux appareils et le dernier coché", () => {
  const base = ajouterArticle(COURSES_VIDES, "riz", 1, "r");
  const pc = cocherArticle(ajouterArticle(base, "thon", 5, "t"), "r", 6);
  const tel = ajouterArticle(base, "pain", 4, "p");
  const m = JSON.parse(mergeText("courses", JSON.stringify(base), JSON.stringify(pc), JSON.stringify(tel))!);
  assert.deepEqual(m.articles.map((a: { id: string }) => a.id).sort(), ["p", "r", "t"]);
  assert.equal(m.articles.find((a: { id: string }) => a.id === "r").fait, true);
});

test("Mémo : mots-dièse, recherche sans accents, épinglés d'abord, fusion", () => {
  assert.deepEqual(tagsDe("Revoir #Fac et #fac puis #Idée"), ["fac", "idee"]);
  let d = ajouterMemo(MEMOS_VIDES, "Rendre le TD de stats #fac", 1, "a");
  d = ajouterMemo(d, "Vidéo sur la mémoire #idée", 2, "b");
  d = ajouterMemo(d, "   ", 3, "vide");
  assert.equal(d.memos.length, 2);
  assert.deepEqual(chercherMemos(d, "memoire").map((m) => m.id), ["b"]);
  assert.deepEqual(chercherMemos(d, "#fac").map((m) => m.id), ["a"]);
  assert.deepEqual(chercherMemos({ memos: d.memos.map((m) => (m.id === "a" ? { ...m, epingle: true } : m)) }, "").map((m) => m.id), ["a", "b"]);
  assert.deepEqual(tagsFrequents(d), ["fac", "idee"]);
  const m = JSON.parse(mergeText("memos", JSON.stringify(MEMOS_VIDES), JSON.stringify(d), JSON.stringify(ajouterMemo(MEMOS_VIDES, "Depuis le PC", 5, "c")))!);
  assert.deepEqual(m.memos.map((x: { id: string }) => x.id), ["c", "b", "a"]);
});

test("Demain : lever = premier cours − préparation − trajet, Fajr du bon jour", () => {
  const soir = new Date(2026, 10, 19, 21, 0).getTime();
  const demain = minuit(soir, 1);
  const h = (x: number) => demain + x * 3_600_000;
  const cours = [
    { start: h(10), end: h(12), title: "Stats", room: "B12" },
    { start: h(8), end: h(10), title: "Psycho cognitive", room: "Amphi A" },
    { start: h(-14), end: h(-12), title: "Hier", room: "" },
  ];
  const fajrs: number[] = [];
  const p = planDemain(cours, (t) => { fajrs.push(t); return minuit(t) + 6.5 * 3_600_000; }, soir, REGLAGES_DEMAIN);
  assert.equal(p.aujourdhui, false);
  assert.equal(p.premier?.title, "Psycho cognitive");
  assert.equal(p.nbCours, 2);
  assert.equal(p.dernier?.title, "Stats");
  assert.equal(p.reveilCours, h(8) - 75 * 60_000);
  assert.equal(p.fajr, h(6.5));
  assert.equal(p.reveilFajr, h(6.5) - 10 * 60_000);
  assert.equal(minuit(fajrs[0]), demain);
  // À 1 h du matin, « demain » est la journée qui commence.
  const nuit = planDemain(cours, () => null, demain + 3_600_000, REGLAGES_DEMAIN);
  assert.equal(nuit.aujourdhui, true);
  assert.equal(nuit.premier?.title, "Psycho cognitive");
  assert.equal(nuit.fajr, null);
  assert.equal(planDemain([], () => null, soir, REGLAGES_DEMAIN).reveilCours, null);
});
