// Processus principal de Rayan's Télécommande : serveur local (joignable seulement par Tailscale), fenêtre de
// réglages, icône dans la zone de notification et démarrage avec Windows.
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, shell, Tray } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { genererCode } from "../core/securite.ts";
import { normaliserDonnees, type Donnees } from "../core/donnees.ts";
import type { Commande, Etat } from "../renderer/api-types.ts";
import { Store } from "./store.ts";
import { demarrerServeur, dossierBonnesAffaires, dossierReception } from "./serveur.ts";
import { Push } from "./push.ts";
import { AlertesAffaires } from "./alertes-affaires.ts";
import { depublier, etatTailscale, publier, servePublie, type EtatTailscale } from "./tailscale.ts";
import { runLaunchTest } from "./launch-test.ts";

const APP_NAME = "Rayan's Télécommande";
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const testReport = arg("test-lancement");
const atLogin = process.argv.includes("--demarrage");

const dataDir = testReport
  ? fs.mkdtempSync(path.join(os.tmpdir(), "rayans-telecommande-test-"))
  : arg("donnees") || process.env.HANGAR_APP_DATA || path.join(app.getPath("appData"), "Rayans Telecommande");
if (testReport) app.setPath("userData", path.join(dataDir, "electron"));

const assets = path.join(__dirname, "..", "assets");
const rendererHtml = path.join(__dirname, "renderer", "index.html");

let store: Store;
let donnees: Donnees;
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let ts: EtatTailscale = { installe: false, connecte: false, proprietaire: null, adresse: null, httpsActive: false, appareils: [] };
let publie = false;
let serveurOk = false;
let derniereUtilisation = 0;

if (!testReport && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showMain());
  app.whenReady().then(start);
}

function start() {
  app.setAppUserModelId("fr.rayan.telecommande");
  Menu.setApplicationMenu(null);
  store = new Store(dataDir);
  donnees = store.load();

  ipcMain.handle("etat", () => etat());
  ipcMain.handle("commande", (_e, c: Commande) => commande(c));

  const push = new Push(dataDir, journaliser);
  const serveur = demarrerServeur({
    donnees: () => donnees,
    dossierDonnees: dataDir,
    journaliser,
    dossierBoite: store.boite,
    utilise: (appareil) => {
      const avant = derniereUtilisation;
      derniereUtilisation = Date.now();
      if (Date.now() - avant > 15 * 60_000) {
        journaliser("Connexion depuis le téléphone", appareil);
        if (donnees.reglages.notifierConnexion) alerte(APP_NAME, "Ton iPhone vient de se connecter à la télécommande.");
      }
    },
    alerte,
    changeBoite: () => save(),
    push,
    alertesAffaires: new AlertesAffaires(dataDir, dossierBonnesAffaires, push, journaliser),
    version: app.getVersion(),
  }, () => ts.proprietaire);
  serveur.on("listening", () => { serveurOk = true; pousser(); });
  serveur.on("error", (e) => { serveurOk = false; journaliser("Serveur indisponible", String((e as Error).message)); pousser(); });

  createTray();
  createMain(!atLogin);
  applyLoginItem();
  void actualiser();
  setInterval(() => void actualiser(), 30_000);

  app.on("before-quit", () => { quitting = true; });
  app.on("window-all-closed", () => { /* vit dans la zone de notification */ });

  if (testReport) runLaunchTest(testReport, { getMain: () => win, getDonnees: () => donnees });
}

async function actualiser() {
  ts = await etatTailscale();
  publie = await servePublie();
  updateTray();
  pousser();
}

function etat(): Etat {
  return { donnees, version: app.getVersion(), tailscale: ts, publie, serveurOk, dossierReception: dossierReception(), avertissement: store.warning };
}
function pousser() { if (win && !win.isDestroyed()) win.webContents.send("etat", etat()); }

function save() {
  try { store.save(donnees); } catch (e) { console.error("Enregistrement impossible :", e); }
  pousser();
}

function journaliser(quoi: string, detail?: string) {
  donnees.journal.push({ at: Date.now(), quoi, detail });
  if (donnees.journal.length > 200) donnees.journal.splice(0, donnees.journal.length - 200);
  save();
}

function alerte(titre: string, texte: string) {
  if (!Notification.isSupported() || testReport) return;
  const n = new Notification({ title: titre, body: texte, icon: path.join(assets, "icon.png") });
  n.on("click", () => showMain());
  n.show();
}

function applyLoginItem() {
  if (!app.isPackaged || testReport || process.platform !== "win32") return;
  app.setLoginItemSettings({ openAtLogin: donnees.reglages.demarrerAvecWindows, path: process.execPath, args: ["--demarrage", `--donnees=${dataDir}`], name: "Rayans Telecommande" });
}

function ajouterBoite(type: "fichier" | "texte", nom: string, ecrire: (dest: string) => void) {
  const id = randomUUID();
  const dest = path.join(store.boite, id);
  ecrire(dest);
  donnees.boite.push({ id, type, nom, taille: fs.statSync(dest).size, at: Date.now() });
  save();
}

async function commande(c: Commande): Promise<{ ok: boolean; message?: string; lien?: string; cible?: string; nom?: string } | null> {
  switch (c.type) {
    case "publier": { const r = await publier(); await actualiser(); if (r.ok) journaliser("Accès depuis l'iPhone activé"); return r; }
    case "depublier": await depublier(); await actualiser(); journaliser("Accès depuis l'iPhone coupé"); return { ok: true };
    case "nouveau-code": donnees.code = genererCode(); journaliser("Nouveau code d'association", "les anciens téléphones sont déconnectés"); return { ok: true };
    case "nouveau-code-montre": donnees.codeMontre = genererCode(); journaliser("Nouveau code de la montre", "à recopier dans garmin/montre/config.local.json, puis réinstaller l'app"); return { ok: true };
    case "reglages": donnees = normaliserDonnees({ ...donnees, reglages: { ...donnees.reglages, ...c.patch } }); save(); applyLoginItem(); return { ok: true };
    case "scenarios": donnees = normaliserDonnees({ ...donnees, scenarios: c.scenarios }); save(); return { ok: true };
    case "choisir-cible": {
      const r = await dialog.showOpenDialog(win!, c.dossier
        ? { title: "Dossier à ouvrir", properties: ["openDirectory"] }
        : { title: "Programme, raccourci ou fichier à ouvrir", properties: ["openFile"], defaultPath: path.join(process.env.ProgramData ?? "C:\\ProgramData", "Microsoft", "Windows", "Start Menu", "Programs") });
      if (r.canceled || !r.filePaths[0]) return null;
      const p = r.filePaths[0];
      return { ok: true, cible: p, nom: path.basename(p).replace(/\.(lnk|exe|url)$/i, "") };
    }
    case "envoyer-fichiers": {
      const r = await dialog.showOpenDialog(win!, { title: "Fichiers à envoyer au téléphone", properties: ["openFile", "multiSelections"] });
      if (r.canceled) return null;
      for (const p of r.filePaths) ajouterBoite("fichier", path.basename(p), (dest) => fs.copyFileSync(p, dest));
      journaliser("Fichiers déposés pour le téléphone", `${r.filePaths.length} fichier(s)`);
      return { ok: true, message: `${r.filePaths.length} fichier(s) prêts : ouvre Télécommande sur l'iPhone → Fichiers → Depuis le PC.` };
    }
    case "envoyer-texte": {
      if (!c.texte.trim()) return null;
      ajouterBoite("texte", c.texte.trim().slice(0, 40), (dest) => fs.writeFileSync(dest, c.texte, "utf8"));
      return { ok: true, message: "Texte prêt pour le téléphone." };
    }
    case "supprimer-boite": {
      const el = donnees.boite.find((e) => e.id === c.id);
      if (el) { fs.rmSync(path.join(store.boite, el.id), { force: true }); donnees.boite = donnees.boite.filter((e) => e !== el); save(); }
      return { ok: true };
    }
    case "ouvrir-lien": if (/^https:\/\/(login\.tailscale\.com|www\.icloud\.com)\//.test(c.url)) await shell.openExternal(c.url); return { ok: true };
    case "ouvrir-reception": fs.mkdirSync(dossierReception(), { recursive: true }); await shell.openPath(dossierReception()); return { ok: true };
    case "actualiser": await actualiser(); return { ok: true };
    case "quitter": quitting = true; app.quit(); return { ok: true };
  }
  return null;
}

function windowIcon() { return nativeImage.createFromPath(path.join(assets, "icon.png")); }

function createMain(show: boolean) {
  win = new BrowserWindow({
    width: 980, height: 720, minWidth: 780, minHeight: 560, show: false,
    title: APP_NAME, backgroundColor: "#101418", icon: windowIcon(),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  win.loadFile(rendererHtml);
  win.once("ready-to-show", () => { if (show) win?.show(); });
  win.on("close", (e) => { if (!quitting) { e.preventDefault(); win?.hide(); } });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
}

function showMain() {
  if (!win || win.isDestroyed()) createMain(true);
  if (win!.isMinimized()) win!.restore();
  win!.show();
  win!.focus();
  void actualiser();
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(assets, "tray.png")));
  tray.setToolTip(APP_NAME);
  tray.on("click", () => { if (win && win.isVisible() && !win.isMinimized()) win.hide(); else showMain(); });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Ouvrir Rayan's Télécommande", click: () => showMain() },
    { label: "Envoyer des fichiers au téléphone…", click: () => { showMain(); void commande({ type: "envoyer-fichiers" }).then((r) => r?.message && alerte(APP_NAME, r.message)); } },
    { label: "Faire sonner l'iPhone (iCloud)", click: () => void shell.openExternal("https://www.icloud.com/find") },
    { type: "separator" },
    { label: "Quitter", click: () => { quitting = true; app.quit(); } },
  ]));
}

function updateTray() {
  if (!tray || tray.isDestroyed()) return;
  const iphone = ts.appareils.find((a) => /ios/i.test(a.systeme));
  const lignes = [APP_NAME, !ts.connecte ? "Tailscale déconnecté" : publie ? "Accès depuis l'iPhone : actif" : "Accès depuis l'iPhone : à activer"];
  if (iphone) lignes.push(`iPhone : ${iphone.enLigne ? "en ligne" : "hors ligne"}`);
  tray.setToolTip(lignes.join("\n").slice(0, 127));
}
