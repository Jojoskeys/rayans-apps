// Processus principal de Rayan's Sauve : il copie avec robocopy les dossiers importants (données des applications,
// Documents…) vers un disque externe ou OneDrive, garde l'historique, et rappelle de sauvegarder quand la dernière
// sauvegarde réussie date de trop longtemps.
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, shell, Tray } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ago, CACHE_DIRS, dayKey, FOLDER, lastSuccess, normalizeData, parseSummary, reminderNeeded, robocopyArgs, robocopyOk, targets, type AppData, type RunResult, type Settings, type Source } from "../core/backup.ts";
import type { Progress, State } from "../renderer/api-types.ts";
import { runLaunchTest } from "./launch-test.ts";

const APP_NAME = "Rayan's Sauve";
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const testReport = arg("test-lancement");
const atLogin = process.argv.includes("--demarrage");

const dataDir = testReport
  ? fs.mkdtempSync(path.join(os.tmpdir(), "rayans-sauve-test-"))
  : arg("donnees") || process.env.HANGAR_APP_DATA || path.join(app.getPath("appData"), "Rayans Sauve");
if (testReport) app.setPath("userData", path.join(dataDir, "electron"));
const dataFile = path.join(dataDir, "sauve.json");

const assets = path.join(__dirname, "..", "assets");
const rendererHtml = path.join(__dirname, "renderer", "index.html");

let data: AppData;
let progress: Progress | null = null;
let child: ChildProcess | null = null;
let cancelRequested = false;
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
/** Pour le test : horloge et sources proposées remplaçables, notifications notées. */
export const testHooks = { clock: () => Date.now(), presets: null as Source[] | null, sent: [] as string[] };

if (!testReport && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showMain());
  app.whenReady().then(start);
}

// ----- Sources proposées ------------------------------------------------------------------------

const roaming = () => process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const launcherRoot = () => process.env.HANGAR_HOME
  || (process.env.HANGAR_APP_DATA ? path.dirname(path.dirname(process.env.HANGAR_APP_DATA)) : path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "fr.rayan.launcher"));

function presets(): Source[] {
  if (testHooks.presets) return testHooks.presets;
  const p = (id: string, label: string, dir: string, extra: Partial<Source> = {}): Source => ({ id, label, path: dir, enabled: true, files: [], excludeDirs: CACHE_DIRS, preset: true, ...extra });
  return [
    p("apps", "Données des apps (Rayan's Launcher)", path.join(launcherRoot(), "data")),
    p("revision", "Rayan's Révision", path.join(roaming(), "fr.rayan.revision")),
    p("hifz", "Rayan's Hifz", path.join(roaming(), "Rayans Hifz"), { files: ["hifz-donnees.json", "hifz-donnees.json.bak"], excludeDirs: [] }),
    p("ouvertures", "Rayan's Ouvertures", path.join(roaming(), "Rayans Ouvertures", "donnees"), { excludeDirs: [...CACHE_DIRS, "cache"] }),
    p("documents", "Documents", app.getPath("documents"), { excludeDirs: CACHE_DIRS.filter((d) => d === "node_modules") }),
  ];
}

// ----- Données ----------------------------------------------------------------------------------

function load() {
  let raw: unknown = null;
  for (const f of [dataFile, `${dataFile}.bak`]) {
    try { raw = JSON.parse(fs.readFileSync(f, "utf8")); break; } catch { /* suivant */ }
  }
  data = normalizeData(raw, presets());
}

function save() {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  if (fs.existsSync(dataFile)) fs.copyFileSync(dataFile, `${dataFile}.bak`);
  fs.renameSync(tmp, dataFile);
}

export function getData() { return data; }

export function state(): State {
  const dest = data.settings.destination;
  return {
    data, progress, version: app.getVersion(), dataDir, now: testHooks.clock(),
    destinationOk: !!dest && fs.existsSync(dest),
    exists: Object.fromEntries(data.settings.sources.map((s) => [s.id, fs.existsSync(s.path)])),
    oneDrive: process.env.OneDrive && fs.existsSync(process.env.OneDrive) ? process.env.OneDrive : null,
  };
}

function broadcast() {
  if (win && !win.isDestroyed()) win.webContents.send("etat", state());
  updateTray();
}

export function updateSettings(patch: Partial<Settings>) {
  const before = data.settings;
  data = normalizeData({ ...data, settings: { ...data.settings, ...patch } }, presets());
  if (before.startWithWindows !== data.settings.startWithWindows) applyLoginItem();
  try { save(); } catch (e) { console.error(e); }
  broadcast();
  return state();
}

// ----- Démarrage --------------------------------------------------------------------------------

function start() {
  app.setAppUserModelId("fr.rayan.sauve");
  Menu.setApplicationMenu(null);
  load();

  ipcMain.handle("etat", () => state());
  ipcMain.handle("reglages", (_e, p: Partial<Settings>) => updateSettings(p));
  ipcMain.handle("sauvegarder", () => runBackup());
  ipcMain.handle("annuler", () => cancel());
  ipcMain.handle("choisir-destination", async (e) => {
    const parent = BrowserWindow.fromWebContents(e.sender);
    const opts: Electron.OpenDialogOptions = { title: "Où enregistrer la sauvegarde ?", properties: ["openDirectory", "createDirectory"], buttonLabel: "Choisir ce dossier" };
    const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle("choisir-source", async (e) => {
    const parent = BrowserWindow.fromWebContents(e.sender);
    const opts: Electron.OpenDialogOptions = { title: "Dossier à sauvegarder", properties: ["openDirectory", "multiSelections"] };
    const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
    return r.canceled ? [] : r.filePaths;
  });
  ipcMain.on("ouvrir", (_e, p: string) => void shell.openPath(p));
  ipcMain.on("quitter", () => { quitting = true; app.quit(); });

  createTray();
  createMain(!atLogin);
  applyLoginItem();
  setTimeout(checkReminder, 60_000);
  setInterval(checkReminder, 30 * 60_000);

  app.on("before-quit", (e) => {
    if (child && !testReport) {
      const r = dialog.showMessageBoxSync({ type: "warning", buttons: ["Arrêter la sauvegarde et quitter", "Continuer la sauvegarde"], defaultId: 1, cancelId: 1, title: APP_NAME, message: "Une sauvegarde est en cours." });
      if (r === 1) { e.preventDefault(); quitting = false; return; }
      cancel();
    }
    quitting = true;
  });
  app.on("window-all-closed", () => { /* l'application vit dans la zone de notification */ });

  if (testReport) runLaunchTest(testReport, { getMain: () => win, getTray: () => tray, getData, updateSettings, runBackup, checkReminder, state, testHooks, dataFile, reload: load });
}

function applyLoginItem() {
  if (!app.isPackaged || testReport || process.platform !== "win32") return;
  app.setLoginItemSettings({ openAtLogin: data.settings.startWithWindows, path: process.execPath, args: ["--demarrage", `--donnees=${dataDir}`], name: "Rayans Sauve" });
}

function notify(title: string, body: string) {
  testHooks.sent.push(`${title} : ${body}`);
  if (testReport || !Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: path.join(assets, "icon.png") });
  n.on("click", () => showMain());
  n.show();
}

export function checkReminder() {
  const now = testHooks.clock();
  if (child || !reminderNeeded(data, now)) return;
  data = { ...data, lastReminderDay: dayKey(now) };
  try { save(); } catch (e) { console.error(e); }
  const last = lastSuccess(data);
  notify("Pensez à sauvegarder", last ? `Dernière sauvegarde : ${ago(last, now)}.` : "Aucune sauvegarde n'a encore été faite.");
  broadcast();
}

// ----- Sauvegarde -------------------------------------------------------------------------------

function cancel() {
  cancelRequested = true;
  child?.kill();
}

const isInside = (child: string, parent: string) => {
  const rel = path.relative(parent, child);
  return rel === "" || (!!rel && !rel.startsWith("..") && !path.isAbsolute(rel));
};

function robocopy(args: string[]): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve, reject) => {
    const c = spawn("robocopy", args, { windowsHide: true });
    child = c;
    let out = "";
    c.stdout.on("data", (b: Buffer) => { out += b.toString("latin1"); });
    c.stderr.on("data", (b: Buffer) => { out += b.toString("latin1"); });
    c.once("error", (e) => { child = null; reject(new Error(`robocopy n'a pas pu être lancé : ${e.message}`)); });
    c.once("close", (code) => { child = null; resolve({ code, out }); });
  });
}

export async function runBackup(): Promise<RunResult> {
  if (child || progress) throw new Error("Une sauvegarde est déjà en cours.");
  const dest = data.settings.destination;
  if (!dest) throw new Error("Choisissez d'abord où enregistrer la sauvegarde.");
  if (!fs.existsSync(dest)) throw new Error(`${dest} est introuvable : le disque est-il branché ?`);
  const sources = data.settings.sources.filter((s) => s.enabled);
  if (!sources.length) throw new Error("Aucun dossier à sauvegarder n'est coché.");

  const t0 = testHooks.clock();
  const started = Date.now();
  const result: RunResult = { at: t0, durationMs: 0, destination: dest, ok: true, copied: 0, skipped: 0, failed: 0, bytes: 0, problems: [] };
  const dirs = targets(sources, dest, path.join);
  cancelRequested = false;
  try {
    for (const [i, s] of sources.entries()) {
      if (cancelRequested) break;
      progress = { index: i, total: sources.length, label: s.label };
      broadcast();
      const target = dirs.get(s.id)!;
      // Application jamais utilisée sur cet ordinateur : rien à copier (la liste l'indique déjà).
      if (!fs.existsSync(s.path)) { if (!s.preset) result.problems.push(`${s.label} : dossier introuvable, ignoré (${s.path})`); continue; }
      if (isInside(target, s.path)) { result.problems.push(`${s.label} : la sauvegarde serait dans le dossier lui-même, ignoré`); result.ok = false; continue; }
      fs.mkdirSync(target, { recursive: true });
      const { code, out } = await robocopy(robocopyArgs(s, target, data.settings.mirror));
      if (cancelRequested) break;
      const sum = parseSummary(out);
      if (sum) {
        result.copied += sum.files[1];
        result.skipped += sum.files[2];
        result.failed += sum.files[4];
        result.bytes += sum.bytes[1];
      }
      if (!robocopyOk(code)) {
        result.ok = false;
        const last = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => /erreur|error/i.test(l)).pop();
        result.problems.push(`${s.label} : ${sum?.files[4] ? `${sum.files[4]} fichier(s) non copié(s)` : `erreur robocopy ${code}`}${last ? ` (${last.slice(0, 160)})` : ""}`);
      }
    }
    writeReadme(dest, sources, dirs);
  } finally {
    progress = null;
    child = null;
  }
  if (cancelRequested) { result.ok = false; result.cancelled = true; }
  result.durationMs = Date.now() - started;
  data = { ...data, history: [...data.history, result].slice(-30) };
  try { save(); } catch (e) { console.error(e); }
  broadcast();
  if (!win?.isVisible()) {
    if (result.ok) notify("Sauvegarde terminée", `${result.copied} fichier(s) copié(s), ${result.skipped} déjà à jour.`);
    else if (!result.cancelled) notify("Sauvegarde incomplète", result.problems[0] ?? "Des fichiers n'ont pas pu être copiés.");
  }
  return result;
}

/** Petit mode d'emploi à côté de la sauvegarde : d'où vient chaque dossier, pour restaurer. */
function writeReadme(dest: string, sources: Source[], dirs: Map<string, string>) {
  const lines = [
    `Sauvegarde faite par Rayan's Sauve le ${new Date().toLocaleString("fr-FR")}.`,
    "",
    "Pour restaurer, fermez l'application concernée puis recopiez le dossier sauvegardé à son emplacement d'origine :",
    "",
    ...sources.map((s) => `  ${path.basename(dirs.get(s.id)!)}  ->  ${s.path}${s.files.length ? `  (fichiers : ${s.files.join(", ")})` : ""}`),
    "",
  ];
  try { fs.writeFileSync(path.join(dest, FOLDER, "LISEZMOI.txt"), String.fromCharCode(0xfeff) + `${lines.join("\r\n")}`); } catch { /* facultatif */ }
}

// ----- Fenêtre ----------------------------------------------------------------------------------

function createMain(show: boolean) {
  win = new BrowserWindow({
    width: 860, height: 680, minWidth: 640, minHeight: 520, show: false,
    title: APP_NAME, backgroundColor: "#111418", icon: nativeImage.createFromPath(path.join(assets, "icon.png")),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  win.loadFile(rendererHtml);
  win.once("ready-to-show", () => { if (show) win?.show(); });
  win.on("focus", () => broadcast());
  win.on("close", (e) => {
    if (quitting) return;
    if (data.settings.closeToTray) { e.preventDefault(); win?.hide(); } else app.quit();
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

function updateTray() {
  if (!tray || tray.isDestroyed()) return;
  const last = lastSuccess(data);
  tray.setToolTip(`${APP_NAME}\n${progress ? `Sauvegarde en cours : ${progress.label}` : `Dernière sauvegarde : ${ago(last, testHooks.clock())}`}`.slice(0, 127));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Ouvrir Rayan's Sauve", click: () => showMain() },
    progress
      ? { label: "Arrêter la sauvegarde", click: () => cancel() }
      : { label: "Sauvegarder maintenant", enabled: !!data.settings.destination, click: () => void runBackup().catch((e) => notify("Sauvegarde impossible", String(e.message ?? e))) },
    { type: "separator" },
    { label: "Quitter", click: () => app.quit() },
  ]));
}
