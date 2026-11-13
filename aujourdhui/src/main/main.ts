// Processus principal de Rayan's Aujourd'hui : il relit chaque minute ce qu'il reste à réviser dans Révision, Hifz et
// Ouvertures, l'affiche dans la fenêtre et sur l'icône de la zone de notification, et envoie un rappel le soir.
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, shell, Tray } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NAMES, reminderDue, reminderText, todayISO, totalLeft, type SourceCount, type SourceId } from "../core/counts.ts";
import type { Settings, State } from "../renderer/api-types.ts";
import { launchById } from "./launcher.ts";
import { readCounts, sourcePaths } from "./sources.ts";
import { runLaunchTest } from "./launch-test.ts";

const APP_NAME = "Rayan's Aujourd'hui";
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const testReport = arg("test-lancement");
const atLogin = process.argv.includes("--demarrage");

const dataDir = testReport
  ? fs.mkdtempSync(path.join(os.tmpdir(), "rayans-aujourdhui-test-"))
  : arg("donnees") || process.env.HANGAR_APP_DATA || path.join(app.getPath("appData"), "Rayans Aujourdhui");
if (testReport) app.setPath("userData", path.join(dataDir, "electron"));
const dataFile = path.join(dataDir, "aujourdhui.json");

const assets = path.join(__dirname, "..", "assets");
const rendererHtml = path.join(__dirname, "renderer", "index.html");

export const APP_IDS: Record<SourceId, string> = { revision: "rayans-revision", hifz: "rayans-hifz", ouvertures: "rayans-ouvertures" };

const DEFAULTS: Settings = { reminder: true, reminderHour: 19, reminderMinute: 0, startWithWindows: false, closeToTray: true };
let settings: Settings = { ...DEFAULTS };
let lastSentDay: string | null = null;
let counts: SourceCount[] = [];
let updatedAt = 0;
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
/** Pour le test : horloge et emplacements des données remplaçables, notifications notées au lieu d'être affichées. */
export const testHooks = { clock: () => Date.now(), paths: sourcePaths(), sent: [] as string[] };

if (!testReport && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showMain());
  app.whenReady().then(start);
}

// ----- Données ----------------------------------------------------------------------------------

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    const s = raw.settings ?? {};
    const int = (v: unknown, min: number, max: number, d: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : d);
    settings = {
      reminder: typeof s.reminder === "boolean" ? s.reminder : DEFAULTS.reminder,
      reminderHour: int(s.reminderHour, 0, 23, DEFAULTS.reminderHour),
      reminderMinute: int(s.reminderMinute, 0, 59, DEFAULTS.reminderMinute),
      startWithWindows: typeof s.startWithWindows === "boolean" ? s.startWithWindows : DEFAULTS.startWithWindows,
      closeToTray: typeof s.closeToTray === "boolean" ? s.closeToTray : DEFAULTS.closeToTray,
    };
    lastSentDay = typeof raw.lastSentDay === "string" ? raw.lastSentDay : null;
  } catch { /* premier lancement */ }
}

function save() {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ settings, lastSentDay }, null, 1));
  fs.renameSync(tmp, dataFile);
}

export function state(): State {
  return { settings, counts, updatedAt, version: app.getVersion(), dataDir, paths: testHooks.paths, today: todayISO(testHooks.clock()) };
}

function broadcast() {
  if (win && !win.isDestroyed()) win.webContents.send("etat", state());
  updateTray();
}

export function updateSettings(patch: Partial<Settings>) {
  const before = settings;
  settings = { ...settings, ...patch };
  if (before.startWithWindows !== settings.startWithWindows) applyLoginItem();
  try { save(); } catch (e) { console.error(e); }
  broadcast();
  return state();
}

// ----- Démarrage --------------------------------------------------------------------------------

function start() {
  app.setAppUserModelId("fr.rayan.aujourdhui");
  Menu.setApplicationMenu(null);
  load();

  ipcMain.handle("etat", () => state());
  ipcMain.handle("actualiser", () => { refresh(); return state(); });
  ipcMain.handle("reglages", (_e, p: Partial<Settings>) => updateSettings(p));
  ipcMain.handle("ouvrir-app", (_e, id: SourceId) => openApp(id));
  ipcMain.handle("tester-notification", () => {
    const text = reminderText(counts);
    return notify("Rayan's Aujourd'hui", text ? `Il reste : ${text}` : "Tout est fait pour aujourd'hui. Le rappel du soir ressemblera à ceci.");
  });
  ipcMain.on("ouvrir-dossier", (_e, p: string) => void shell.openPath(p));
  ipcMain.on("quitter", () => { quitting = true; app.quit(); });

  createTray();
  createMain(!atLogin);
  applyLoginItem();
  refresh();
  setInterval(refresh, 60_000);

  app.on("before-quit", () => { quitting = true; });
  app.on("window-all-closed", () => { /* l'application vit dans la zone de notification */ });

  if (testReport) runLaunchTest(testReport, { getMain: () => win, getTray: () => tray, state, refresh, updateSettings, testHooks, dataFile });
}

function applyLoginItem() {
  if (!app.isPackaged || testReport || process.platform !== "win32") return;
  app.setLoginItemSettings({ openAtLogin: settings.startWithWindows, path: process.execPath, args: ["--demarrage", `--donnees=${dataDir}`], name: "Rayans Aujourdhui" });
}

/** Relit les données des applications, puis envoie le rappel du soir s'il est l'heure et qu'il reste quelque chose. */
export function refresh() {
  const now = testHooks.clock();
  counts = readCounts(now, testHooks.paths);
  updatedAt = now;
  if (settings.reminder && reminderDue(now, settings.reminderHour, settings.reminderMinute, lastSentDay)) {
    lastSentDay = todayISO(now);
    try { save(); } catch (e) { console.error(e); }
    const text = reminderText(counts);
    if (text) notify("Il reste des révisions aujourd'hui", text);
  }
  broadcast();
}

function notify(title: string, body: string) {
  testHooks.sent.push(`${title} : ${body}`);
  if (testReport || !Notification.isSupported()) return false;
  const n = new Notification({ title, body, icon: path.join(assets, "icon.png") });
  n.on("click", () => showMain());
  n.show();
  return true;
}

async function openApp(id: SourceId) {
  if (testReport) return;
  await launchById(APP_IDS[id], [], `Rayan's ${NAMES[id]}`);
}

// ----- Fenêtre ----------------------------------------------------------------------------------

function createMain(show: boolean) {
  win = new BrowserWindow({
    width: 760, height: 600, minWidth: 560, minHeight: 480, show: false,
    title: APP_NAME, backgroundColor: "#111418", icon: nativeImage.createFromPath(path.join(assets, "icon.png")),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  win.loadFile(rendererHtml);
  win.once("ready-to-show", () => { if (show) win?.show(); });
  win.on("focus", () => refresh());
  win.on("close", (e) => {
    if (quitting) return;
    if (settings.closeToTray) { e.preventDefault(); win?.hide(); } else { quitting = true; app.quit(); }
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

// ----- Zone de notification -----------------------------------------------------------------------

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(assets, "tray.png")));
  tray.on("click", () => { if (win && win.isVisible() && !win.isMinimized()) win.hide(); else showMain(); });
  updateTray();
}

let trayKey = "";
function updateTray() {
  if (!tray || tray.isDestroyed()) return;
  const left = totalLeft(counts);
  const lines = counts.filter((c) => c.total).map((c) => `${NAMES[c.id]} : ${c.total}`);
  tray.setToolTip(`${APP_NAME}\n${left ? lines.join("\n") : "Tout est fait"}`.slice(0, 127));
  const key = counts.map((c) => `${c.id}${c.total}`).join();
  if (key === trayKey) return;
  trayKey = key;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Ouvrir Rayan's Aujourd'hui", click: () => showMain() },
    { type: "separator" },
    ...counts.map((c) => ({ label: `${NAMES[c.id]}${c.total ? ` (${c.total})` : ""}`, click: () => void openApp(c.id).catch((e) => notify("Ouverture impossible", String(e.message ?? e))) })),
    { type: "separator" },
    { label: "Quitter", click: () => { quitting = true; app.quit(); } },
  ]));
}
