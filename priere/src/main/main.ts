// Processus principal de Rayan's Prière : il garde les réglages, calcule les rappels toutes les 15 secondes, envoie
// les notifications Windows et vit dans la zone de notification (l'icône montre la prochaine prière).
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, shell, Tray } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { due, nextPrayer, prayerName } from "../core/schedule.ts";
import { normalizeSettings, type AppData, type Settings } from "../core/settings.ts";
import type { Command, InitialState } from "../renderer/api-types.ts";
import { Store } from "./store.ts";
import { runLaunchTest } from "./launch-test.ts";

const APP_NAME = "Rayan's Prière";
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const testReport = arg("test-lancement");
const atLogin = process.argv.includes("--demarrage");

// Données : dossier fourni par Rayan's Launcher (conservé entre les versions). Au démarrage de Windows, l'application
// est lancée sans le launcher : le dossier lui est alors passé par --donnees=.
const dataDir = testReport
  ? fs.mkdtempSync(path.join(os.tmpdir(), "rayans-priere-test-"))
  : arg("donnees") || process.env.HANGAR_APP_DATA || path.join(app.getPath("appData"), "Rayans Priere");
if (testReport) app.setPath("userData", path.join(dataDir, "electron"));

const assets = path.join(__dirname, "..", "assets");
const rendererHtml = path.join(__dirname, "renderer", "index.html");

let store: Store;
let data: AppData;
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
const sent = new Set<string>();
/** Pour les tests : horloge remplaçable. */
let clock = () => Date.now();

if (!testReport && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showMain());
  app.whenReady().then(start);
}

export function getData() { return data; }

function start() {
  app.setAppUserModelId("fr.rayan.priere");
  Menu.setApplicationMenu(null);
  store = new Store(dataDir);
  data = store.load();

  ipcMain.handle("etat", (): InitialState => ({ data, version: app.getVersion(), dataDir, warning: store.warning }));
  ipcMain.handle("reglages", (_e, patch: Partial<Settings>) => updateSettings(patch));
  ipcMain.handle("commande", (_e, cmd: Command) => command(cmd));

  createTray();
  // Lancée au démarrage de Windows : reste discrète dans la zone de notification (sauf s'il faut choisir un lieu).
  createMain(!(atLogin && data.settings.place));
  applyLoginItem();
  // Les rappels déjà passés au lancement ne sont pas envoyés en retard.
  for (const r of due(data.settings, clock(), sent, Infinity)) sent.add(r.key);
  setInterval(tick, 15_000);
  tick();

  app.on("before-quit", () => { quitting = true; });
  app.on("window-all-closed", () => { /* l'application vit dans la zone de notification */ });

  if (testReport) runLaunchTest(testReport, { getMain: () => win, getTray: () => tray, store, getData, updateSettings, tick, setClock: (f) => { clock = f; }, sent });
}

export function updateSettings(patch: Partial<Settings>) {
  const before = data.settings;
  data = { ...data, settings: normalizeSettings({ ...before, ...patch }) };
  try { store.save(data); } catch (err) { console.error("Enregistrement impossible :", err); }
  if (before.startWithWindows !== data.settings.startWithWindows || !before.place !== !data.settings.place) applyLoginItem();
  win?.webContents.send("etat", data);
  tick();
}

/** Démarrage avec Windows : réenregistré à chaque lancement, car le dossier de l'application change à chaque mise à jour. */
function applyLoginItem() {
  if (!app.isPackaged || testReport || process.platform !== "win32") return;
  const args = ["--demarrage", `--donnees=${dataDir}`];
  // Rien n'est inscrit tant que le premier écran (choix de la ville, case « démarrer avec Windows ») n'est pas validé.
  const on = data.settings.startWithWindows && !!data.settings.place;
  app.setLoginItemSettings({ openAtLogin: on, path: process.execPath, args, name: "Rayans Priere" });
}

/** Toutes les 15 s : notifications échues, puis infobulle de l'icône. */
export function tick() {
  const now = clock();
  const s = data.settings;
  if (s.pausedUntil && now >= s.pausedUntil) { updateSettings({ pausedUntil: null }); return; }
  for (const r of due(s, now, sent)) {
    sent.add(r.key);
    if (!Notification.isSupported()) continue;
    const n = new Notification({ title: r.title, body: r.body, silent: !s.sound, icon: path.join(assets, "icon.png") });
    n.on("click", () => showMain());
    n.show();
  }
  if (sent.size > 200) for (const k of [...sent].slice(0, 100)) sent.delete(k);
  updateTray(now);
}

const hm = (ms: number, tz: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(ms));

function windowIcon() { return nativeImage.createFromPath(path.join(assets, "icon.png")); }

function createMain(show: boolean) {
  win = new BrowserWindow({
    width: 940, height: 680, minWidth: 760, minHeight: 540, show: false,
    title: APP_NAME, backgroundColor: "#0F1416", icon: windowIcon(),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  win.loadFile(rendererHtml);
  win.once("ready-to-show", () => { if (show) win?.show(); });
  win.on("close", (e) => {
    if (quitting) return;
    if (data.settings.closeToTray && data.settings.place) { e.preventDefault(); win?.hide(); }
    else { quitting = true; app.quit(); }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
}

export function showMain() {
  if (!win || win.isDestroyed()) createMain(true);
  if (win!.isMinimized()) win!.restore();
  win!.show();
  win!.focus();
}

async function command(cmd: Command) {
  switch (cmd.type) {
    case "quitter": quitting = true; app.quit(); break;
    case "ouvrir-dossier": await shell.openPath(dataDir); break;
    case "tester-notification": {
      if (!Notification.isSupported()) return false;
      new Notification({ title: "Rayan's Prière", body: "Les notifications fonctionnent. Elles arriveront comme celle-ci.", silent: !data.settings.sound, icon: path.join(assets, "icon.png") }).show();
      return true;
    }
    case "pause": updateSettings({ pausedUntil: cmd.minutes ? clock() + cmd.minutes * 60_000 : null }); break;
  }
  return true;
}

// ----- Zone de notification -----------------------------------------------------------------------

let trayKey = "";

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(assets, "tray.png")));
  tray.setToolTip(APP_NAME);
  tray.on("click", () => { if (win && win.isVisible() && !win.isMinimized()) win.hide(); else showMain(); });
}

function updateTray(now: number) {
  if (!tray || tray.isDestroyed()) return;
  const s = data.settings;
  const next = nextPrayer(s, now);
  let tip = APP_NAME;
  if (!s.place) tip += "\nChoisissez votre ville";
  else if (next) {
    const mins = Math.max(0, Math.round((next.at - now) / 60_000));
    const dans = mins >= 60 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")}` : `${mins} min`;
    tip += `\n${prayerName(next.id, next.date)} à ${hm(next.at, s.place.tz)} (dans ${dans})`;
  }
  if (s.pausedUntil) tip += "\nNotifications suspendues";
  tray.setToolTip(tip.slice(0, 127));
  const paused = !!s.pausedUntil;
  const key = `${paused}`;
  if (key === trayKey) return;
  trayKey = key;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Ouvrir Rayan's Prière", click: () => showMain() },
    { type: "separator" },
    paused
      ? { label: "Reprendre les notifications", click: () => updateSettings({ pausedUntil: null }) }
      : { label: "Suspendre les notifications", submenu: [
          { label: "1 heure", click: () => command({ type: "pause", minutes: 60 }) },
          { label: "3 heures", click: () => command({ type: "pause", minutes: 180 }) },
          { label: "Jusqu'à demain", click: () => updateSettings({ pausedUntil: tomorrowMorning(clock()) }) },
        ] },
    { type: "separator" },
    { label: "Quitter", click: () => { quitting = true; app.quit(); } },
  ]));
}

function tomorrowMorning(now: number) {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(3, 0, 0, 0);
  return d.getTime();
}
