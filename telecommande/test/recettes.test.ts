// Tuile Recettes : lecture des recettes et de recettes.json, écritures prudentes (recettes inventées pour le test).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { demande, ErreurRecettes, fichierRecettes, lireDonnees, modifier, vue } from "../src/core/recettes.ts";

function dossiers() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "recettes-tc-"));
  const fav = path.join(d, "Rayan's Favoris");
  fs.mkdirSync(path.join(fav, "fiches"), { recursive: true });
  fs.writeFileSync(path.join(fav, "fiches", "tiktok-1.json"), JSON.stringify({
    id: "tiktok-1", categorie: "recette", pour_rayan: "Bon pour ta sèche. Prends du poulet halal.",
    recette: { titre: "Bowl poulet riz", ingredients: ["150 g de poulet", "80 g de riz"], etapes: ["Cuire"] },
  }));
  fs.writeFileSync(path.join(fav, "fiches", "tiktok-2.json"), JSON.stringify({
    id: "tiktok-2", categorie: "recette", pour_rayan: "Bonne collation.",
    recette: { titre: "Overnight oats", ingredients: ["50 g de flocons d'avoine", "1 skyr"], etapes: ["Mélanger", "Au frigo toute la nuit"] },
  }));
  return { d, fav, fichier: path.join(d, "donnees", "recettes.json") };
}

const plan = (debut: string) => ({
  debut,
  jours: Array.from({ length: 7 }, (_, n) => ({
    petitDej: { id: n === 1 ? "tiktok-2" : null, fixe: false },
    dejeuner: { id: "tiktok-1", fixe: false },
    collation: { id: null, fixe: false },
    diner: { id: null, fixe: true },
  })),
});

test("emplacement de recettes.json : variable, dossier du launcher, sinon %APPDATA%, le plus récent s'il y en a deux", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "recettes-ou-"));
  const env = { LOCALAPPDATA: path.join(d, "Local"), APPDATA: path.join(d, "Roaming") };
  const launcher = path.join(d, "Local", "fr.rayan.launcher", "data", "rayans-recettes", "recettes.json");
  const seul = path.join(d, "Roaming", "Rayans Recettes", "recettes.json");
  assert.equal(fichierRecettes({ RECETTES_DONNEES: "X:\\r.json" }), "X:\\r.json");
  assert.equal(fichierRecettes(env), seul, "rien d'installé : %APPDATA%");
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  assert.equal(fichierRecettes(env), launcher, "installée par le launcher");
  assert.equal(fichierRecettes({ ...env, HANGAR_APP_DATA: path.join(d, "Local", "fr.rayan.launcher", "data", "rayans-telecommande") }), launcher);
  fs.mkdirSync(path.dirname(seul), { recursive: true });
  fs.writeFileSync(seul, "{}");
  assert.equal(fichierRecettes(env), seul, "seul fichier existant");
  fs.writeFileSync(launcher, "{}");
  fs.utimesSync(seul, new Date(2020, 0, 1), new Date(2020, 0, 1));
  assert.equal(fichierRecettes(env), launcher, "le plus récent");
});

test("vue : recettes avec remarques et favoris, plan du jour, ce que je prépare, courses par magasin", () => {
  const { fav, fichier } = dossiers();
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, JSON.stringify({ favoris: ["tiktok-1"], plan: plan("2026-11-16"), magasins: { riz: "Grand Frais" }, achetes: { riz: 5 } }));
  const v = vue(fav, fichier, new Date(2026, 10, 16, 9));
  assert.equal(v.trouve, true);
  assert.deepEqual(v.recettes.map((r) => [r.id, r.favori]), [["tiktok-1", true], ["tiktok-2", false]]);
  assert.deepEqual(v.recettes[0].remarques.halal, ["Prends du poulet halal."]);
  assert.equal(v.plan!.semaineEnCours, true);
  assert.equal(v.plan!.aujourdhui, 0);
  const lundi = v.plan!.jours[0];
  assert.equal(lundi.nom, "Lundi");
  assert.deepEqual(lundi.mange.map((m) => m.titre), [null, "Bowl poulet riz", null, null]);
  assert.deepEqual(lundi.prepare.map((p) => [p.id, p.quand]), [["tiktok-1", "aujourdhui"], ["tiktok-2", "ce-soir"]]);
  assert.equal(lundi.total, null, "pas de chiffres inventés");
  assert.deepEqual(lundi.courses.map((g) => g.titre), ["À Grand Frais", "À la boucherie halal"], "le magasin choisi sur le PC est suivi");
  const riz = lundi.courses[0].articles[0];
  assert.deepEqual([riz.nom, riz.achete, riz.conseil], ["riz", true, "Lidl, Aldi, Leclerc"]);
  assert.equal(v.plan!.semaine.flatMap((g) => g.articles).length, 4, "semaine : poulet, riz, flocons, skyr");
  assert.equal(vue(fav, fichier, new Date(2026, 10, 24)).plan!.aujourdhui, null, "autre semaine");
});

test("sans recettes.json ni dossier Favoris : vue vide, sans erreur", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "recettes-vide-"));
  assert.deepEqual(vue(path.join(d, "absent"), path.join(d, "recettes.json")), { trouve: false, recettes: [], plan: null });
});

test("écritures : je l'ai faite, favori, article pris ; relu avant, .bak gardé, rien d'autre perdu", () => {
  const { fichier } = dossiers();
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, JSON.stringify({ favoris: ["a"], panier: ["tiktok-1"], plan: plan("2026-11-16") }));
  modifier(fichier, demande("faite", { id: "tiktok-1" }), 1000);
  // Pendant ce temps, l'app de bureau écrit autre chose : ce n'est pas perdu.
  const bureau = JSON.parse(fs.readFileSync(fichier, "utf8"));
  bureau.magasins = { riz: "Aldi" };
  fs.writeFileSync(fichier, JSON.stringify(bureau));
  modifier(fichier, demande("favori", { id: "tiktok-2", oui: true }));
  modifier(fichier, demande("favori", { id: "tiktok-2", oui: true }), 5);
  modifier(fichier, demande("achete", { cle: "riz", oui: true }), 2000);
  const d = lireDonnees(fichier);
  assert.deepEqual(d.faites, { "tiktok-1": [1000] });
  assert.deepEqual(d.favoris, ["a", "tiktok-2"], "« oui » deux fois ne l'enlève pas");
  assert.deepEqual(d.achetes, { riz: 2000 });
  assert.deepEqual(d.magasins, { riz: "Aldi" });
  assert.deepEqual(d.panier, ["tiktok-1"]);
  assert.equal(d.plan!.jours[0].diner.fixe, true);
  assert.ok(fs.existsSync(`${fichier}.bak`));
  modifier(fichier, demande("annulerFaite", { id: "tiktok-1", at: 1000 }));
  modifier(fichier, demande("viderAchetes", {}));
  assert.deepEqual([lireDonnees(fichier).faites, lireDonnees(fichier).achetes], [{}, {}]);
  assert.deepEqual(fs.readdirSync(path.dirname(fichier)).sort(), ["recettes.json", "recettes.json.bak"], "pas de fichier temporaire oublié");
});

test("recettes.json abîmé : la sauvegarde, sinon une erreur et rien n'est écrasé", () => {
  const { fichier } = dossiers();
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, "{ abîmé");
  fs.writeFileSync(`${fichier}.bak`, JSON.stringify({ favoris: ["x"] }));
  assert.deepEqual(lireDonnees(fichier).favoris, ["x"]);
  fs.writeFileSync(`${fichier}.bak`, "{ abîmé aussi");
  assert.throws(() => modifier(fichier, demande("faite", { id: "x" })), (e) => e instanceof ErreurRecettes && e.code === 409);
  assert.equal(fs.readFileSync(fichier, "utf8"), "{ abîmé");
});

test("demandes refusées : action inconnue, champ manquant ou trop long", () => {
  assert.throws(() => demande("supprimerTout", {}), (e) => e instanceof ErreurRecettes && e.code === 404);
  assert.throws(() => demande("faite", {}), ErreurRecettes);
  assert.throws(() => demande("achete", { cle: "x".repeat(400), oui: true }), ErreurRecettes);
  assert.throws(() => demande("annulerFaite", { id: "a", at: "hier" }), ErreurRecettes);
  assert.deepEqual(demande("favori", { id: "a", oui: "oui" }), { quoi: "favori", id: "a", oui: false }, "seulement true veut dire oui");
});
