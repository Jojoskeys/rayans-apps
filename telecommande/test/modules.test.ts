// Modules privés : pages servies sans sortir de leur dossier, chargement de serveur.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chargerModule, fichierPage, listerModules } from "../src/main/modules.ts";

const racine = fs.mkdtempSync(path.join(os.tmpdir(), "tc-modules-"));
fs.mkdirSync(path.join(racine, "essai", "page", "assets"), { recursive: true });
fs.writeFileSync(path.join(racine, "essai", "page", "index.html"), "<p>ok</p>");
fs.writeFileSync(path.join(racine, "essai", "page", "assets", "app.js"), "1");
fs.writeFileSync(path.join(racine, "essai", "page", "notes.txt"), "secret");
fs.writeFileSync(path.join(racine, "essai", "secret.json"), "{}");
fs.writeFileSync(path.join(racine, "essai", "serveur.mjs"), "export const gerer = (o) => o.route === 'GET /api/essai';");
fs.mkdirSync(path.join(racine, "Mauvais Nom"));

test("liste seulement les dossiers au nom simple", () => {
  assert.deepEqual(listerModules(racine), ["essai"]);
  assert.deepEqual(listerModules(path.join(racine, "absent")), []);
});

test("sert index.html et les fichiers de page/", () => {
  assert.equal(fichierPage(racine, "/essai/"), path.join(racine, "essai", "page", "index.html"));
  assert.equal(fichierPage(racine, "/essai/assets/app.js"), path.join(racine, "essai", "page", "assets", "app.js"));
});

test("refuse ce qui sort de page/, les types non servis et les modules absents", () => {
  for (const c of ["/essai", "/essai/../secret.json", "/essai/%2e%2e/secret.json", "/essai/..%5csecret.json", "/essai/notes.txt", "/absent/", "/", "/essai/%zz", "/Essai/"])
    assert.equal(fichierPage(racine, c), null, c);
});

test("charge serveur.mjs, et null sans module", async () => {
  const m = await chargerModule(racine, "essai");
  assert.ok(m);
  assert.equal(await m!.gerer({ route: "GET /api/essai" } as never), true);
  assert.equal(await chargerModule(racine, "absent"), null);
  assert.equal(await chargerModule(racine, "../essai"), null);
});
