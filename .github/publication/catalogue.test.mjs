// node --test .github/publication/
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ENTRY_ASSET, assemble, build, buildEntry, candidates, checkManifest, compareVersions, parseTag, toPrune } from "./catalogue.mjs";

const SCRIPT = fileURLToPath(new URL("./catalogue.mjs", import.meta.url));
const fiche = {
  id: "analyse-echecs",
  name: "Rayan's Échecs",
  description: "Analyse de parties.",
  version: "1.0.205",
  releaseNotes: "Nouveautés.",
  executable: "Analyse Echecs.exe",
};

test("tags des releases d'applications", () => {
  assert.deepEqual(parseTag("analyse-echecs-v1.0.205"), { id: "analyse-echecs", version: "1.0.205" });
  assert.deepEqual(parseTag("rayans-launcher-v0.1.150"), { id: "rayans-launcher", version: "0.1.150" });
  assert.equal(parseTag("catalogue"), null);
  assert.equal(parseTag("v1.0.0"), null);
  assert.equal(parseTag("app-v1.0"), null);
  assert.equal(parseTag("app-v01.0.0"), null);
});

test("comparaison numérique des versions", () => {
  assert.ok(compareVersions("1.0.10", "1.0.9") > 0);
  assert.ok(compareVersions("0.2.0", "0.10.0") < 0);
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
});

test("fiche : champs exigés et chemins dangereux", () => {
  assert.deepEqual(checkManifest(fiche), []);
  assert.equal(checkManifest({ ...fiche, id: "Mon App" }).length, 1);
  assert.equal(checkManifest({ ...fiche, version: "1.0" }).length, 1);
  assert.equal(checkManifest({ ...fiche, description: " " }).length, 1);
  assert.equal(checkManifest({ ...fiche, executable: "app.bat" }).length, 1);
  assert.equal(checkManifest({ ...fiche, executable: "../app.exe" }).length, 1);
  assert.equal(checkManifest({ ...fiche, executable: "C:/app.exe" }).length, 1);
  assert.deepEqual(checkManifest({ ...fiche, executable: "bin/App.exe" }), []);
  assert.ok(checkManifest([]).length > 0);
});

test("entrée : adresses absolues vers la release", () => {
  const e = buildEntry(fiche, { repo: "o/r", zipName: "analyse-echecs-1.0.205.zip", sha256: "ab".repeat(32), size: 12, iconName: "icone.png", imageName: "image.png", date: "2026-11-12" });
  assert.equal(e.downloadUrl, "https://github.com/o/r/releases/download/analyse-echecs-v1.0.205/analyse-echecs-1.0.205.zip");
  assert.equal(e.icon, "https://github.com/o/r/releases/download/analyse-echecs-v1.0.205/icone.png");
  assert.equal(e.version, "1.0.205");
  assert.equal(e.size, 12);
});

test("candidats : plus récente d'abord, brouillons et releases étrangères ignorés", () => {
  const rel = (tag, extra = {}) => ({ tag, draft: false, assets: [ENTRY_ASSET], ...extra });
  const by = candidates([
    rel("app-v1.0.9"),
    rel("app-v1.0.10"),
    rel("app-v1.0.11", { draft: true }),
    rel("app-v1.0.12", { assets: ["autre.zip"] }),
    rel("catalogue"),
    rel("autre-v0.1.0"),
  ]);
  assert.deepEqual(by.get("app").map((c) => c.tag), ["app-v1.0.10", "app-v1.0.9"]);
  assert.deepEqual([...by.keys()].sort(), ["app", "autre"]);
});

test("nettoyage : garde les N plus récentes et celle du catalogue", () => {
  const by = new Map([["app", ["1.0.5", "1.0.4", "1.0.3", "1.0.2", "1.0.1"].map((v) => ({ tag: `app-v${v}`, version: v }))]]);
  assert.deepEqual(toPrune(by, new Set(["app-v1.0.5"]), 3), ["app-v1.0.2", "app-v1.0.1"]);
  assert.deepEqual(toPrune(by, new Set(["app-v1.0.1"]), 3), ["app-v1.0.2"]);
});

test("catalogue : texte stable trié par nom", () => {
  const a = { id: "zz", name: "Alpha" };
  const b = { id: "aa", name: "Échecs" };
  const t1 = assemble([b, a]);
  assert.equal(t1, assemble([a, b]));
  const doc = JSON.parse(t1);
  assert.equal(doc.schemaVersion, 1);
  assert.deepEqual(doc.apps.map((x) => x.id), ["zz", "aa"]);
  assert.ok(t1.endsWith("}\n"));
});

test("construction : version invalide ou illisible sautée, la précédente reste au catalogue", () => {
  const rel = (tag) => ({ tag, draft: false, assets: [ENTRY_ASSET] });
  const releases = ["app-v1.0.1", "app-v1.0.2", "app-v1.0.3", "app-v1.0.4", "app-v1.0.5", "jeu-v2.0.0", "jeu-v2.1.0", "catalogue"].map(rel);
  const entry = (tag) => {
    const { id, version } = parseTag(tag);
    if (tag === "jeu-v2.1.0") throw new Error("404");
    return { id, name: id.toUpperCase(), version, executable: tag === "app-v1.0.5" ? "../x.exe" : "a.exe" };
  };
  const logs = [];
  const r = build(releases, {
    fetchEntry: entry,
    validate: (e) => (e.executable.includes("..") ? "chemin dangereux" : null),
    log: (l) => logs.push(l),
  });
  assert.equal(r.count, 2);
  const apps = JSON.parse(r.text).apps;
  assert.deepEqual(apps.map((a) => `${a.id} ${a.version}`), ["app 1.0.4", "jeu 2.0.0"]);
  assert.deepEqual(r.prune, ["app-v1.0.2", "app-v1.0.1"]);
  assert.equal(logs.filter((l) => l.startsWith("::warning")).length, 2);

  // Fiche qui ne correspond pas à son tag : refusée.
  const r2 = build([rel("app-v1.0.0")], { fetchEntry: () => ({ id: "autre", version: "1.0.0" }), validate: () => null, log: () => {} });
  assert.equal(r2.count, 0);
});

test("sous-commande entree : fichiers de la release et sorties", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "entree-"));
  fs.writeFileSync(path.join(d, "fiche.json"), "\uFEFF" + JSON.stringify(fiche));
  fs.writeFileSync(path.join(d, "app.zip"), "PK faux zip");
  fs.writeFileSync(path.join(d, "icon.PNG"), "\x89PNG");
  const out = execFileSync(process.execPath, [SCRIPT, "entree", "--manifest", path.join(d, "fiche.json"), "--zip", path.join(d, "app.zip"), "--repo", "o/r", "--icon", path.join(d, "icon.PNG"), "--dest", path.join(d, "rel"), "--notes-out", path.join(d, "notes.md")], { encoding: "utf8" });
  assert.match(out, /^tag=analyse-echecs-v1\.0\.205$/m);
  assert.match(out, /^name=Rayan's Échecs$/m);
  assert.deepEqual(fs.readdirSync(path.join(d, "rel")).sort(), ["analyse-echecs-1.0.205.zip", "icone.png", "image.png", ENTRY_ASSET].sort());
  const e = JSON.parse(fs.readFileSync(path.join(d, "rel", ENTRY_ASSET), "utf8"));
  assert.match(e.sha256, /^[0-9a-f]{64}$/);
  assert.equal(e.size, 11);
  assert.match(fs.readFileSync(path.join(d, "notes.md"), "utf8"), /SHA-256/);

  fs.writeFileSync(path.join(d, "mauvaise.json"), JSON.stringify({ ...fiche, version: "1.0" }));
  assert.throws(() => execFileSync(process.execPath, [SCRIPT, "entree", "--manifest", path.join(d, "mauvaise.json"), "--zip", path.join(d, "app.zip"), "--repo", "o/r", "--icon", path.join(d, "icon.PNG"), "--dest", path.join(d, "rel2")], { stdio: "pipe" }));
});
