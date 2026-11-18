import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ajouterRetour, cheminVideo, ErreurRetour, lister } from "../src/core/studio.ts";

const dossier = () => fs.mkdtempSync(path.join(os.tmpdir(), "studio-"));
const deposer = (d: string, id: string, meta: Record<string, unknown> = {}) => {
  fs.writeFileSync(path.join(d, `${id}.mp4`), "video");
  fs.writeFileSync(path.join(d, `${id}.json`), JSON.stringify({ titre: `Titre ${id}`, texte: "légende", version: 1, envoye: 1000, ...meta }));
};

test("studio : liste les vidéos déposées, les plus récentes d'abord, ignore le reste", () => {
  const d = dossier();
  deposer(d, "ayati-qaroun", { envoye: 1000 });
  deposer(d, "psycho-inacheve", { envoye: 2000, version: 3, note: "voix refaite" });
  fs.writeFileSync(path.join(d, "Pas Valide.mp4"), "x");
  fs.writeFileSync(path.join(d, "orphelin.json"), "{}");
  const l = lister(d);
  assert.deepEqual(l.map((v) => v.id), ["psycho-inacheve", "ayati-qaroun"]);
  assert.equal(l[0].version, 3);
  assert.equal(l[0].note, "voix refaite");
  assert.equal(l[1].titre, "Titre ayati-qaroun");
  assert.deepEqual(l[1].retours, []);
  assert.deepEqual(lister(path.join(d, "absent")), []);
});

test("studio : chemin de la vidéo seulement pour un identifiant sûr et présent", () => {
  const d = dossier();
  deposer(d, "ayati-qaroun");
  assert.equal(cheminVideo(d, "ayati-qaroun"), path.join(d, "ayati-qaroun.mp4"));
  for (const id of ["../secret", "ayati-qaroun.mp4", "AYATI", "", "absent"]) assert.equal(cheminVideo(d, id), null);
});

test("studio : retours enregistrés à la suite, pour la version regardée", () => {
  const d = dossier();
  deposer(d, "ayati-qaroun");
  ajouterRetour(d, "ayati-qaroun", 1, "corriger", "  le titre déborde à 0:12  ", 5);
  fs.writeFileSync(path.join(d, "ayati-qaroun.json"), JSON.stringify({ titre: "Q", version: 2, envoye: 6 }));
  ajouterRetour(d, "ayati-qaroun", 2, "ok", "", 7);
  assert.deepEqual(lister(d)[0].retours, [
    { version: 1, verdict: "corriger", commentaire: "le titre déborde à 0:12", at: 5 },
    { version: 2, verdict: "ok", commentaire: "", at: 7 },
  ]);
});

test("studio : refuse une ancienne version, une correction vide, une vidéo inconnue", () => {
  const d = dossier();
  deposer(d, "ayati-qaroun", { version: 2 });
  const code = (f: () => unknown) => { try { f(); return 0; } catch (e) { assert.ok(e instanceof ErreurRetour); return e.code; } };
  assert.equal(code(() => ajouterRetour(d, "ayati-qaroun", 1, "ok", "")), 409);
  assert.equal(code(() => ajouterRetour(d, "ayati-qaroun", 2, "corriger", "   ")), 400);
  assert.equal(code(() => ajouterRetour(d, "ayati-qaroun", 2, "publier", "")), 400);
  assert.equal(code(() => ajouterRetour(d, "../x", 1, "ok", "")), 404);
  assert.equal(code(() => ajouterRetour(d, "absent", 1, "ok", "")), 404);
  assert.deepEqual(lister(d)[0].retours, []);
});
