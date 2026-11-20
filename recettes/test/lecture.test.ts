// Lecture de recettes.md et des fiches de Rayan's Favoris (exemples inventés pour les tests).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { correspond, etiquettes, fusionner, lienDepuisId, lireFiche, lireRecettesMd, remarques } from "../src/core/lecture.ts";
import { dossierFavoris, lireFavoris } from "../src/main/source.ts";

const MD = `# Recettes de Rayan's Favoris

## Omelette poulet épinards
<!-- tiktok-111 -->
Source : https://www.tiktok.com/@_/video/111 · 1 personne

**Ingrédients**
- 3 œufs
- 100 g de blanc de poulet

**Étapes**
1. Battre les œufs
2. Cuire 5 min

## Mug cake
<!-- instagram-AbC_d-1 -->
Source : C:\\videos\\mug.mp4

**Ingrédients**
- 1 œuf
- 30 g de whey

**Étapes**
1. Mélanger
2. Micro-ondes 1 min

## Titre sans contenu

## Omelette poulet épinards
Source : https://www.instagram.com/reel/XyZ/

**Ingredients**
* 2 œufs
`;

test("recettes.md : titres, identifiants, liens, portions, ingrédients et étapes", () => {
  const r = lireRecettesMd(MD.replace(/\n/g, "\r\n"));
  assert.equal(r.length, 3, "le titre sans contenu est ignoré");
  assert.deepEqual(r[0], {
    id: "tiktok-111", titre: "Omelette poulet épinards", portions: "1 personne", lien: "https://www.tiktok.com/@_/video/111",
    ingredients: ["3 œufs", "100 g de blanc de poulet"], etapes: ["Battre les œufs", "Cuire 5 min"], origine: "favoris",
  });
  assert.equal(r[1].id, "instagram-AbC_d-1");
  assert.equal(r[1].lien, "https://www.instagram.com/reel/AbC_d-1/", "un chemin de fichier n'est pas un lien : déduit de l'identifiant");
  assert.equal(r[2].id, "md-omelette-poulet-epinards", "sans commentaire d'identifiant, un id tiré du titre");
  assert.deepEqual(r[2].ingredients, ["2 œufs"]);
  assert.equal(r[2].lien, "https://www.instagram.com/reel/XyZ/");
});

test("recettes.md : deux blocs sans identifiant de même titre ne se confondent pas", () => {
  const r = lireRecettesMd("## Salade\n**Ingrédients**\n- tomate\n## Salade\n**Ingrédients**\n- concombre\n");
  assert.deepEqual(r.map((x) => x.id), ["md-salade", "md-salade-2"]);
});

test("recettes.md vide ou sans recette", () => {
  assert.deepEqual(lireRecettesMd(""), []);
  assert.deepEqual(lireRecettesMd("# Recettes\n\nRien pour l'instant.\n"), []);
});

const fiche = {
  id: "tiktok-111", categorie: "recette", resume: "Omelette rapide.",
  pour_rayan: "Parfait pour ta sèche : 35 g de protéines. Prends du poulet halal. Évite d'ajouter du fromage.",
  recette: { titre: "Omelette protéinée", portions: "", ingredients: ["3 œufs", " ", "100 g de blanc de poulet"], etapes: ["Battre", "Cuire"] },
};

test("fiche : recette lue, remarques gardées, lien déduit de l'id", () => {
  const r = lireFiche(fiche)!;
  assert.equal(r.titre, "Omelette protéinée");
  assert.deepEqual(r.ingredients, ["3 œufs", "100 g de blanc de poulet"]);
  assert.equal(r.portions, undefined);
  assert.equal(r.pourRayan, fiche.pour_rayan);
  assert.equal(r.lien, "https://www.tiktok.com/@_/video/111");
  assert.equal(lireFiche(fiche, "https://www.tiktok.com/@chef/video/111")!.lien, "https://www.tiktok.com/@chef/video/111");
});

test("fiche : autre catégorie, recette absente ou sans ingrédients → ignorée", () => {
  assert.equal(lireFiche({ ...fiche, categorie: "utile" }), null);
  assert.equal(lireFiche({ id: "x", categorie: "recette" }), null);
  assert.equal(lireFiche({ ...fiche, recette: { titre: "Vide", ingredients: [] } }), null);
  assert.equal(lireFiche(null), null);
  assert.equal(lireFiche("texte"), null);
});

test("fusion : la fiche complète la recette de même id, les fiches seules sont ajoutées, les perso d'abord", () => {
  const md = lireRecettesMd(MD);
  const seule = lireFiche({ ...fiche, id: "instagram-Zz", recette: { titre: "Pancakes", ingredients: ["2 œufs"] } })!;
  const perso = { id: "perso-1", titre: "Riz", ingredients: ["riz"], etapes: [], origine: "perso" as const };
  const tout = fusionner(md, [lireFiche(fiche)!, seule], [perso]);
  assert.deepEqual(tout.map((r) => r.id), ["perso-1", "tiktok-111", "instagram-AbC_d-1", "md-omelette-poulet-epinards", "instagram-Zz"]);
  assert.equal(tout[1].titre, "Omelette protéinée");
  assert.equal(tout[1].portions, "1 personne", "les portions de recettes.md restent si la fiche n'en donne pas");
  assert.equal(tout[1].pourRayan, fiche.pour_rayan);
});

test("remarques : phrases halal à part, ingrédients à vérifier", () => {
  const r = remarques(lireFiche(fiche)!);
  assert.deepEqual(r.halal, ["Prends du poulet halal."]);
  assert.deepEqual(r.seche, ["Parfait pour ta sèche : 35 g de protéines.", "Évite d'ajouter du fromage."]);
  assert.deepEqual(r.aVerifier, []);
  const tiramisu = remarques({ id: "a", titre: "Tiramisu", ingredients: ["2 c. à soupe de rhum", "gélatine", "lardons de dinde halal", "vinaigre de vin"], etapes: [], origine: "favoris" });
  assert.deepEqual(tiramisu.aVerifier, ["2 c. à soupe de rhum", "gélatine"]);
});

test("étiquettes : protéines, rapide, collation, repas", () => {
  const omelette = etiquettes(lireFiche(fiche)!);
  assert.equal(omelette.proteines, true);
  assert.equal(omelette.rapide, true);
  const cookies = etiquettes({ id: "c", titre: "Cookies à la banane", ingredients: ["banane", "pépites de chocolat"], etapes: ["Écraser", "Former", "Cuire 12 min", "Laisser refroidir 1 h"], origine: "favoris" });
  assert.deepEqual(cookies, { proteines: false, rapide: false, collation: true, repas: false });
  const plat = etiquettes({ id: "p", titre: "Patate douce et bœuf haché", ingredients: ["patate douce", "bœuf haché"], etapes: ["Cuire au four 35 min", "Cuire la viande", "Servir"], origine: "favoris" });
  assert.deepEqual(plat, { proteines: true, rapide: false, collation: false, repas: true });
});

test("recherche sans accents, tous les mots", () => {
  const r = lireFiche(fiche)!;
  assert.ok(correspond(r, "OEUFS poulet"));
  assert.ok(correspond(r, "proteinee"));
  assert.ok(!correspond(r, "chocolat"));
  assert.ok(correspond(r, "  "));
});

test("lien déduit de l'identifiant", () => {
  assert.equal(lienDepuisId("tiktok-42"), "https://www.tiktok.com/@_/video/42");
  assert.equal(lienDepuisId("perso-1"), undefined);
});

test("dossier de Rayan's Favoris : variable FAVORIS_DOSSIER, sinon Documents", () => {
  assert.equal(dossierFavoris(path.join("D", "Docs"), {}), path.join("D", "Docs", "Rayan's Favoris"));
  assert.equal(dossierFavoris(path.join("D", "Docs"), { FAVORIS_DOSSIER: "E:\\Favoris" }), "E:\\Favoris");
});

test("lecture du dossier : recettes.md + fiches + liens de favoris.json, fichiers illisibles sautés", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "recettes-test-"));
  try {
    assert.equal(lireFavoris(path.join(dir, "absent")).trouve, false);
    fs.mkdirSync(path.join(dir, "fiches"));
    fs.writeFileSync(path.join(dir, "recettes.md"), "\uFEFF" + MD);
    fs.writeFileSync(path.join(dir, "fiches", "tiktok-111.json"), JSON.stringify(fiche));
    fs.writeFileSync(path.join(dir, "fiches", "tiktok-222.json"), JSON.stringify({ ...fiche, id: "tiktok-222", recette: { titre: "Wrap", ingredients: ["tortilla"] } }));
    fs.writeFileSync(path.join(dir, "fiches", "tiktok-333.json"), JSON.stringify({ id: "tiktok-333", categorie: "drole" }));
    fs.writeFileSync(path.join(dir, "fiches", "casse.json"), "{ pas du json");
    fs.writeFileSync(path.join(dir, "favoris.json"), JSON.stringify([{ id: "tiktok-222", lien: "https://www.tiktok.com/@chef/video/222" }, { id: "instagram-AbC_d-1", lien: "https://www.instagram.com/p/AbC_d-1/" }]));
    const l = lireFavoris(dir);
    assert.equal(l.trouve, true);
    assert.deepEqual(l.illisibles, ["casse.json"]);
    assert.deepEqual(l.recettes.map((r) => r.id), ["tiktok-111", "instagram-AbC_d-1", "md-omelette-poulet-epinards", "tiktok-222"]);
    assert.equal(l.recettes[1].lien, "https://www.instagram.com/p/AbC_d-1/");
    assert.equal(l.recettes[3].lien, "https://www.tiktok.com/@chef/video/222");
    fs.writeFileSync(path.join(dir, "favoris.json"), "[{ en cours d'écriture");
    assert.equal(lireFavoris(dir).recettes.length, 4, "favoris.json illisible n'empêche pas la lecture");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
