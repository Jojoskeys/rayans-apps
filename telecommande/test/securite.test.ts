import { test } from "node:test";
import assert from "node:assert/strict";
import { codeValide, genererCode, LimiteEssais, normaliserCode } from "../src/core/securite.ts";
import { nomDepuisUrl, nomLibre, nomSur, resoudre, type Racine } from "../src/core/chemins.ts";
import { lireInterfaces, lireProfils, profilValide } from "../src/core/wifi.ts";
import { normaliserDonnees } from "../src/core/donnees.ts";

test("code : 20 caractères lisibles, groupés par 5, tous différents", () => {
  const c = genererCode();
  assert.match(c, /^[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){3}$/);
  assert.notEqual(genererCode(), genererCode());
});

test("code : accepté sans tirets, en minuscules, avec espaces ; refusé sinon", () => {
  const c = genererCode();
  assert.ok(codeValide(c, c));
  assert.ok(codeValide(normaliserCode(c).toLowerCase(), c));
  assert.ok(codeValide(c.replace(/-/g, " "), c));
  assert.ok(!codeValide(c.slice(0, -1) + (c.endsWith("A") ? "B" : "A"), c));
  assert.ok(!codeValide("", c));
  assert.ok(!codeValide(undefined, c));
  assert.ok(!codeValide("ABC", "ABC"), "un code trop court n'est jamais valide");
});

test("limite d'essais : bloque après 8 échecs, pendant 15 minutes", () => {
  const l = new LimiteEssais();
  const t = 1_000_000;
  for (let i = 0; i < 7; i++) assert.equal(l.echec(t + i), false);
  assert.equal(l.echec(t + 8), true);
  assert.ok(l.bloque(t + 60_000));
  assert.ok(!l.bloque(t + 16 * 60_000));
});

const racines: Racine[] = [{ id: "documents", nom: "Documents", chemin: "C:\\Users\\rayan\\Documents" }];

test("chemins : on reste sous la racine", () => {
  assert.equal(resoudre(racines, "documents", ""), "C:\\Users\\rayan\\Documents");
  assert.equal(resoudre(racines, "documents", "Cours/L2/td.pdf"), "C:\\Users\\rayan\\Documents\\Cours\\L2\\td.pdf");
  assert.equal(resoudre(racines, "documents", "/Cours"), "C:\\Users\\rayan\\Documents\\Cours");
  assert.equal(resoudre(racines, "documents", "../Desktop"), null);
  assert.equal(resoudre(racines, "documents", "Cours/../../.."), null);
  assert.equal(resoudre(racines, "documents", "..\\..\\Windows"), null);
  assert.equal(resoudre(racines, "documents", "C:\\Windows"), null);
  assert.equal(resoudre(racines, "documents", "//serveur/partage"), null);
  assert.equal(resoudre(racines, "inconnu", ""), null);
  // Un dossier voisin au nom qui commence pareil n'est pas « dedans ».
  assert.equal(resoudre(racines, "documents", "../Documents2"), null);
});

test("chemins : un lien qui sort de la racine est refusé", () => {
  const realpath = (p: string) => p.toLowerCase().endsWith("\\lien") ? "C:\\Windows" : p;
  assert.equal(resoudre(racines, "documents", "lien", realpath), null);
});

test("noms de fichiers sûrs et libres", () => {
  assert.equal(nomSur("photo:1?.jpg"), "photo_1_.jpg");
  assert.equal(nomSur("..\\..\\evil.exe"), "evil.exe");
  assert.equal(nomSur("CON.txt"), "_CON.txt");
  assert.equal(nomSur("   "), "fichier");
  assert.equal(nomSur("fin. "), "fin");
  const pris = new Set(["a.jpg", "a (2).jpg"]);
  assert.equal(nomLibre("a.jpg", (n) => pris.has(n)), "a (3).jpg");
  assert.equal(nomLibre("b.jpg", (n) => pris.has(n)), "b.jpg");
  assert.equal(nomDepuisUrl("https://ex.com/dl/Mon%20fichier.pdf?x=1"), "Mon fichier.pdf");
  assert.equal(nomDepuisUrl("https://ex.com/", 'attachment; filename="rapport.zip"'), "rapport.zip");
  assert.equal(nomDepuisUrl("https://ex.com/"), "telechargement");
});

test("Wi-Fi : lecture de netsh en français et en anglais", () => {
  const fr = `
    Nom                    : Wi-Fi
    Description            : RZ616 Wi-Fi 6E 160MHz
    État                   : connecté
    SSID                   : PlanetCampus - Prive 024726
    Signal                 : 92%
    Profil                 : PlanetCampus - Prive 024726 `;
  assert.deepEqual(lireInterfaces(fr), { connecte: true, ssid: "PlanetCampus - Prive 024726", signal: 92, profil: "PlanetCampus - Prive 024726" });
  const en = "    State                  : disconnected\n    Signal : 0%";
  assert.equal(lireInterfaces(en).connecte, false);
  const profils = "Profils utilisateur\n-------------------\n    Profil Tous les utilisateurs : Maison\n    All User Profile     : iPhone de Rayan\n";
  assert.deepEqual(lireProfils(profils), ["Maison", "iPhone de Rayan"]);
  assert.ok(profilValide("Maison", ["Maison"]));
  assert.ok(!profilValide('Maison" & calc', ["Maison\" & calc"]));
  assert.ok(!profilValide("Autre", ["Maison"]));
});

test("données : arrêt et veille désactivés par défaut, étapes invalides écartées", () => {
  const d = normaliserDonnees({ scenarios: [{ id: "x", nom: "Test", etapes: [{ type: "fermer", processus: "Discord.exe" }, { type: "fermer", processus: "a;rm" }, { type: "ouvrir", cible: "" }] }] });
  assert.equal(d.reglages.autoriserArret, false);
  assert.equal(d.reglages.autoriserVeille, false);
  assert.deepEqual(d.scenarios[0].etapes, [{ type: "fermer", processus: "Discord" }]);
  assert.ok(normaliserCode(d.code).length === 20);
  assert.equal(normaliserDonnees(null).scenarios.length, 2);
});
