// Processus principal de Rayan's Recettes : lit les recettes de Rayan's Favoris (sans jamais y écrire), garde les
// données de l'app (favoris, « je l'ai faite », recettes perso, panier) et pilote la fenêtre.
import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, shell } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appliquer } from "../core/donnees.ts";
import { lienValide } from "../core/lecture.ts";
import type { Action, Donnees } from "../core/types.ts";
import type { Etat } from "../renderer/api-types.ts";
import { dossierFavoris, lireFavoris, type Lecture } from "./source.ts";
import { Store } from "./store.ts";
import { exempleFavoris, runLaunchTest } from "./launch-test.ts";

const APP_NAME = "Rayan's Recettes";
const testArg = process.argv.find((a) => a.startsWith("--test-lancement="));
const testReport = testArg ? testArg.slice("--test-lancement=".length) : null;

// Données : dossier fourni par Rayan's Launcher (conservé entre les versions), sinon le dossier utilisateur.
// Le test de lancement travaille dans un dossier temporaire, avec des recettes d'exemple.
const dataDir = testReport
  ? fs.mkdtempSync(path.join(os.tmpdir(), "rayans-recettes-test-"))
  : process.env.HANGAR_APP_DATA || path.join(app.getPath("appData"), "Rayans Recettes");
if (testReport) app.setPath("userData", path.join(dataDir, "electron"));

const assets = path.join(__dirname, "..", "assets");
let store: Store;
let donnees: Donnees;
let lecture: Lecture = { recettes: [], trouve: false, illisibles: [] };
let favorisDir = "";
let mainWin: BrowserWindow | null = null;

if (!testReport && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWin) return;
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.show();
    mainWin.focus();
  });
  app.whenReady().then(start);
}

function etat(): Etat {
  return {
    recettes: lecture.recettes, donnees, dossier: favorisDir, trouve: lecture.trouve, illisibles: lecture.illisibles,
    version: app.getVersion(), warning: store.warning,
  };
}

function actualiser() {
  lecture = lireFavoris(favorisDir);
  return etat();
}

export function dispatch(a: Action): Etat {
  donnees = appliquer(donnees, a);
  try { store.save(donnees); } catch (err) { console.error("Enregistrement impossible :", err); }
  return etat();
}

function start() {
  app.setAppUserModelId("fr.rayan.recettes");
  Menu.setApplicationMenu(null);
  store = new Store(dataDir);
  donnees = store.load();
  favorisDir = testReport ? exempleFavoris(dataDir) : dossierFavoris(app.getPath("documents"));
  actualiser();

  ipcMain.handle("etat", () => etat());
  ipcMain.handle("actualiser", () => actualiser());
  ipcMain.handle("action", (_e, a: Action) => dispatch(a));
  ipcMain.handle("ouvrir-lien", async (_e, url: string) => {
    const ok = lienValide(url);
    if (ok) await shell.openExternal(ok);
  });
  ipcMain.handle("ouvrir-dossier", async () => {
    await shell.openPath(fs.existsSync(favorisDir) ? favorisDir : app.getPath("documents"));
  });
  ipcMain.handle("copier", (_e, texte: string) => clipboard.writeText(String(texte)));

  mainWin = new BrowserWindow({
    width: 1120, height: 760, minWidth: 820, minHeight: 560, show: false,
    title: APP_NAME, backgroundColor: "#151118", icon: nativeImage.createFromPath(path.join(assets, "icon.png")),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  mainWin.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWin.once("ready-to-show", () => { if (!testReport) mainWin?.show(); });
  // Les recettes de Rayan's Favoris peuvent avoir changé pendant que l'app était en arrière-plan.
  mainWin.on("focus", () => { actualiser(); mainWin?.webContents.send("change"); });
  mainWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWin.webContents.on("will-navigate", (e) => e.preventDefault());
  mainWin.on("closed", () => { mainWin = null; });
  app.on("window-all-closed", () => app.quit());

  if (testReport) runLaunchTest(testReport, { getMain: () => mainWin, dataDir, getDonnees: () => donnees });
}
