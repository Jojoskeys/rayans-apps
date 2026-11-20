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

import { ajouterIdee, ajouterRetourScript, listerIdees, listerScripts, supprimerIdee } from "../src/core/studio.ts";

test("scripts : listés avec leur texte et leurs sources, réponses par version", () => {
  const d = dossier();
  fs.writeFileSync(path.join(d, "psycho-baille.json"), JSON.stringify({ titre: "Pourquoi tu bâilles ?", compte: "psycho", texte: "Pourquoi…", sources: ["Provine 1986", 3], version: 1, envoye: 10 }));
  fs.writeFileSync(path.join(d, "vide.json"), JSON.stringify({ titre: "sans texte" }));
  fs.writeFileSync(path.join(d, "psycho-baille.retours.json"), "[]");
  const l = listerScripts(d);
  assert.deepEqual(l.map((s) => s.id), ["psycho-baille"]);
  assert.deepEqual(l[0].sources, ["Provine 1986"]);
  ajouterRetourScript(d, "psycho-baille", 1, "corriger", "plus court", 5);
  assert.equal(listerScripts(d)[0].retours[0].commentaire, "plus court");
  assert.throws(() => ajouterRetourScript(d, "psycho-baille", 2, "ok", ""), ErreurRetour);
});

test("idées : ajoutées en tête, compte inconnu vidé, suppression", () => {
  const f = path.join(dossier(), "sous", "idees.json");
  const a = ajouterIdee(f, "  pourquoi on bâille  ", "psycho", 1);
  const b = ajouterIdee(f, "Youssouf et ses frères", "pirate", 2);
  assert.deepEqual(listerIdees(f).map((i) => [i.texte, i.compte, i.statut]), [["Youssouf et ses frères", "", "nouvelle"], ["pourquoi on bâille", "psycho", "nouvelle"]]);
  assert.throws(() => ajouterIdee(f, "   ", "ayati"), ErreurRetour);
  supprimerIdee(f, b.id);
  assert.deepEqual(listerIdees(f).map((i) => i.id), [a.id]);
  assert.throws(() => supprimerIdee(f, "absent"), ErreurRetour);
});

// ------------------------------------------------------------------ stories à poster
import { aPoster, cheminStory, marquerPostee } from "../src/core/studio.ts";

test("stories : seules les stories validées (dernière version) et pas encore postées sont à poster", () => {
  const d = dossier();
  const deposer = (id: string, version = 1) => {
    fs.writeFileSync(path.join(d, `${id}.mp4`), "leger");
    fs.writeFileSync(path.join(d, `${id}.json`), JSON.stringify({ titre: `T ${id}`, version, envoye: 1 }));
  };
  deposer("court-story-1"); deposer("court-story-2"); deposer("court-story-3", 2); deposer("court");
  fs.writeFileSync(path.join(d, "court-story-1.hd.mp4"), "pleine qualite");
  ajouterRetour(d, "court-story-1", 1, "ok", "", 10);
  ajouterRetour(d, "court-story-2", 1, "corriger", "trop court", 11);
  fs.writeFileSync(path.join(d, "court-story-3.retours.json"), JSON.stringify([{ version: 1, verdict: "ok", commentaire: "", at: 5 }]));
  ajouterRetour(d, "court", 1, "ok", "", 12);   // un Short validé n'est pas une story
  assert.equal(lister(d).length, 4);              // le .hd.mp4 n'apparaît pas comme une vidéo à part
  const l = aPoster(d);
  assert.deepEqual(l.map((s) => s.id), ["court-story-1"]);
  assert.equal(l[0].taille, "pleine qualite".length);
  assert.equal(l[0].validee, 10);
  assert.equal(cheminStory(d, "court-story-1"), path.join(d, "court-story-1.hd.mp4"));
  assert.equal(cheminStory(d, "court-story-2"), path.join(d, "court-story-2.mp4"));   // sans .hd : la version légère
  assert.equal(cheminStory(d, "court"), null);
  assert.equal(cheminStory(d, "../court-story-1"), null);
  marquerPostee(d, "court-story-1", 20);
  assert.deepEqual(aPoster(d), []);
  assert.throws(() => marquerPostee(d, "court-story-1"), (e: unknown) => e instanceof ErreurRetour && e.code === 404);
});
