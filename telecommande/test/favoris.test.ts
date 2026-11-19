import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { deposerLien, ErreurFavori, lienValide, resume } from "../src/core/favoris.ts";

const dossier = () => fs.mkdtempSync(path.join(os.tmpdir(), "favoris-"));

test("seuls les liens TikTok et Instagram passent", () => {
  assert.ok(lienValide("https://www.tiktok.com/@a/video/123"));
  assert.ok(lienValide("https://vm.tiktok.com/ZMabc/"));
  assert.ok(lienValide("https://www.instagram.com/reel/Cabc/"));
  assert.ok(!lienValide("https://tiktok.com.arnaque.example/video/1"));
  assert.ok(!lienValide("https://exemple.com/?u=instagram.com"));
  assert.ok(!lienValide("javascript:alert(1)"));
  assert.ok(!lienValide("pas un lien"));
});

test("un lien est déposé dans a-deposer, un mauvais lien est refusé", () => {
  const d = dossier();
  deposerLien(d, " https://www.instagram.com/reel/Cabc/ ", "pour toi");
  const f = fs.readdirSync(path.join(d, "a-deposer"));
  assert.equal(f.length, 1);
  const j = JSON.parse(fs.readFileSync(path.join(d, "a-deposer", f[0]), "utf8"));
  assert.equal(j.lien, "https://www.instagram.com/reel/Cabc/");
  assert.equal(j.note, "pour toi");
  assert.throws(() => deposerLien(d, "https://exemple.com", ""), ErreurFavori);
});

test("résumé : compte par état et dernières analysées avec leur fiche", () => {
  const d = dossier();
  fs.mkdirSync(path.join(d, "fiches"));
  fs.writeFileSync(path.join(d, "favoris.json"), JSON.stringify([
    { id: "a", etat: "analysee", titre: "Astuce", ajoute_le: 1, modifie_le: 5 },
    { id: "b", etat: "ignoree", ajoute_le: 2 },
    { id: "c", etat: "a_recuperer", ajoute_le: 3 },
  ]));
  fs.writeFileSync(path.join(d, "fiches", "a.json"), JSON.stringify({ categorie: "utile", resume: "R", securite: { verdict: "sur" } }));
  const r = resume(d);
  assert.deepEqual(r.compte, { analysee: 1, ignoree: 1, a_recuperer: 1 });
  assert.equal(r.recents.length, 1);
  assert.equal(r.recents[0].verdict, "sur");
  assert.equal(r.enAttente, 0);
});

test("résumé sans dossier : rien, sans erreur", () => {
  assert.deepEqual(resume(path.join(os.tmpdir(), "favoris-inexistant-" + Date.now())), { compte: {}, recents: [], enAttente: 0 });
});
