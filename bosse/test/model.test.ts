import { test } from "node:test";
import assert from "node:assert/strict";
import { chronoName, findWorkspace, itemLabel, kindOfPath, normalizeData, normalizeUrl, parsePowerToys, relativeDay, splitArgs } from "../src/core/model.ts";
import { launcherRoot, parseInstalled } from "../src/main/launcher.ts";
import path from "node:path";

const ws = (name: string, extra = {}) => ({ id: name, name, color: "#4F7CE8", items: [], chrono: true, chronoProject: "", powertoys: null, lastOpened: null, createdAt: 0, ...extra });

test("données : normalisation et rejet de ce qui est invalide", () => {
  const d = normalizeData({
    workspaces: [
      ws("Mémoire", { items: [{ id: "a", kind: "url", target: "https://x.fr", label: "", args: "" }, { id: "b", kind: "virus", target: "x" }, { id: "c", kind: "dossier", target: "  " }] }),
      ws("Mémoire"), // id en double
      { id: "z", name: "   " },
      ws("Perso", { color: "rouge", chrono: "oui" }),
    ],
    settings: { hideAfterLaunch: false },
  });
  assert.equal(d.workspaces.length, 2);
  assert.equal(d.workspaces[0].items.length, 1);
  assert.equal(d.workspaces[1].chrono, true);
  assert.match(d.workspaces[1].color, /^#/);
  assert.equal(d.settings.hideAfterLaunch, false);
  assert.deepEqual(normalizeData("n'importe quoi").workspaces, []);
});

test("recherche d'un espace par ce qui est tapé", () => {
  const d = normalizeData({ workspaces: [ws("Mémoire de master"), ws("Site perso"), ws("Site client")] });
  assert.equal(findWorkspace(d, "mémoire de master")!.name, "Mémoire de master");
  assert.equal(findWorkspace(d, "memoire")!.name, "Mémoire de master");
  assert.equal(findWorkspace(d, "site"), null, "ambigu");
  assert.equal(findWorkspace(d, "client")!.name, "Site client");
  assert.equal(findWorkspace(d, ""), null);
  assert.equal(chronoName(d.workspaces[0]), "Mémoire de master");
  assert.equal(chronoName({ ...d.workspaces[0], chronoProject: "Master " }), "Master");
});

test("adresses, arguments et types d'éléments", () => {
  assert.equal(normalizeUrl("github.com/moi"), "https://github.com/moi");
  assert.equal(normalizeUrl("http://localhost:3000"), "http://localhost:3000/");
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("file:///C:/x"), null);
  assert.equal(normalizeUrl("bonjour"), null);
  assert.deepEqual(splitArgs('--profil "Mon dossier" -n'), ["--profil", "Mon dossier", "-n"]);
  assert.equal(kindOfPath("C:/x/Code.exe", false), "app");
  assert.equal(kindOfPath("C:/x/Raccourci.lnk", false), "app");
  assert.equal(kindOfPath("C:/x/notes.docx", false), "fichier");
  assert.equal(kindOfPath("C:/x", true), "dossier");
  const it = (kind: "app" | "url" | "dossier" | "rayan", target: string, label = "") => ({ id: "i", kind, target, label, args: "" });
  assert.equal(itemLabel(it("app", "C:/Programmes/Code.exe")), "Code");
  assert.equal(itemLabel(it("url", "https://www.github.com/x")), "github.com");
  assert.equal(itemLabel(it("dossier", "C:/Projets/Mémoire/")), "Mémoire");
  assert.equal(itemLabel(it("rayan", "rayans-revision"), { "rayans-revision": "Rayan's Révision" }), "Rayan's Révision");
  assert.equal(itemLabel(it("url", "https://x.fr", "Cours")), "Cours");
});

test("PowerToys Workspaces et applications du launcher", () => {
  assert.deepEqual(parsePowerToys({ workspaces: [{ id: "{A}", name: "Code", applications: [] }, { id: 3 }] }), [{ id: "{A}", name: "Code" }]);
  assert.deepEqual(parsePowerToys(null), []);
  const root = "C:/L";
  const apps = parseInstalled({ apps: {
    "rayans-chrono-app": { name: "Rayan's Chrono", current: { version: "1.0.4", dir: "1.0.4-ab", executable: "Rayans Chrono.exe" } },
    "mauvais": { name: "x", current: { dir: "../..", executable: "a.exe" } },
    "sans-version": { name: "y" },
  } }, root);
  assert.equal(apps.length, 1);
  assert.equal(apps[0].exe, path.join(root, "apps", "rayans-chrono-app", "versions", "1.0.4-ab", "Rayans Chrono.exe"));
  assert.equal(apps[0].dataDir, path.join(root, "data", "rayans-chrono-app"));
  assert.equal(launcherRoot({ HANGAR_APP_DATA: path.join("C:/L", "data", "rayans-bosse") }), path.join("C:/L"));
  assert.equal(launcherRoot({ LOCALAPPDATA: "C:/U" }), path.join("C:/U", "fr.rayan.launcher"));
});

test("date de dernière ouverture", () => {
  const now = new Date(2026, 10, 13, 15, 0).getTime();
  assert.equal(relativeDay(null, now), "jamais ouvert");
  assert.equal(relativeDay(new Date(2026, 10, 13, 9, 5).getTime(), now), "ouvert aujourd'hui à 09:05");
  assert.match(relativeDay(new Date(2026, 10, 12, 22, 0).getTime(), now), /^ouvert hier/);
  assert.equal(relativeDay(new Date(2026, 10, 3).getTime(), now), "ouvert il y a 10 jours");
});
