// Processus principal de Rayan's Bosse : il garde les espaces de travail (bosse.json) et les ouvre : programmes,
// dossiers, fichiers, sites, applications de Rayan's Launcher, Rayan's Chrono sur le projet et PowerToys Workspaces.
//   « Rayans Bosse.exe --projet=<nom> » ouvre directement l'espace (utilisé par « bosse <projet> » de Rayan's Outils).
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, shell } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chronoName, findWorkspace, itemLabel, kindOfPath, normalizeData, normalizeUrl, parsePowerToys, splitArgs, type AppData, type Item, type Workspace } from "../core/model.ts";
import type { InitialState, LaunchReport, PickKind } from "../renderer/api-types.ts";
import { installedApps, launchApp, launchById, launcherRoot } from "./launcher.ts";
import { runLaunchTest } from "./launch-test.ts";

const APP_NAME = "Rayan's Bosse";
const CHRONO_ID = "rayans-chrono-app";
const arg = (argv: string[], name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const testReport = arg(process.argv, "test-lancement");

const dataDir = testReport
  ? fs.mkdtempSync(path.join(os.tmpdir(), "rayans-bosse-test-"))
  : process.env.HANGAR_APP_DATA || path.join(app.getPath("appData"), "Rayans Bosse");
if (testReport) app.setPath("userData", path.join(dataDir, "electron"));
const dataFile = path.join(dataDir, "bosse.json");

const assets = path.join(__dirname, "..", "assets");
const rendererHtml = path.join(__dirname, "renderer", "index.html");

let data: AppData = normalizeData(null);
let warning: string | null = null;
let win: BrowserWindow | null = null;
/** Pour le test : ce qui aurait été ouvert, au lieu de l'ouvrir vraiment. */
export const dryRun: { on: boolean; opened: string[] } = { on: !!testReport, opened: [] };

if (!testReport && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const projet = arg(argv, "projet");
    if (projet === null) showMain();
    else void openByName(projet);
  });
  app.whenReady().then(start);
}

// ----- Données ----------------------------------------------------------------------------------

function load() {
  fs.mkdirSync(dataDir, { recursive: true });
  for (const f of [dataFile, `${dataFile}.bak`]) {
    if (!fs.existsSync(f)) continue;
    try {
      data = normalizeData(JSON.parse(fs.readFileSync(f, "utf8")));
      if (f !== dataFile) warning = "Le fichier des espaces était illisible : la version précédente a été restaurée.";
      return;
    } catch {
      if (f === dataFile) {
        const kept = path.join(dataDir, `bosse.illisible-${Date.now()}.json`);
        fs.renameSync(dataFile, kept);
        warning = `Le fichier des espaces était illisible. Il a été mis de côté : ${path.basename(kept)}`;
      }
    }
  }
}

function save() {
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  if (fs.existsSync(dataFile)) fs.copyFileSync(dataFile, `${dataFile}.bak`);
  fs.renameSync(tmp, dataFile);
}

export function getData() { return data; }

export function setData(next: AppData) {
  data = normalizeData(next);
  try { save(); } catch (e) { console.error("Enregistrement impossible :", e); }
  // Pas de renvoi vers la fenêtre : c'est elle qui vient d'envoyer ces données (et elle a peut-être déjà changé depuis).
  return state();
}

// ----- PowerToys Workspaces ----------------------------------------------------------------------

const localAppData = () => process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");

function powerToysLauncher(): string | null {
  const candidates = [
    path.join(localAppData(), "PowerToys", "PowerToys.WorkspacesLauncher.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "PowerToys", "PowerToys.WorkspacesLauncher.exe"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function powerToysWorkspaces() {
  try {
    return parsePowerToys(JSON.parse(fs.readFileSync(path.join(localAppData(), "Microsoft", "PowerToys", "Workspaces", "workspaces.json"), "utf8")));
  } catch { return []; }
}

// ----- État pour la fenêtre --------------------------------------------------------------------

export function state(): InitialState {
  const apps = installedApps().filter((a) => a.id !== "rayans-launcher").map((a) => ({ id: a.id, name: a.name }));
  return {
    data, version: app.getVersion(), dataDir, warning, apps,
    chronoInstalled: apps.some((a) => a.id === CHRONO_ID),
    powertoys: { installed: !!powerToysLauncher(), workspaces: powerToysWorkspaces() },
  };
}

// ----- Démarrage --------------------------------------------------------------------------------

function start() {
  app.setAppUserModelId("fr.rayan.bosse");
  Menu.setApplicationMenu(null);
  load();

  ipcMain.handle("etat", () => state());
  ipcMain.handle("enregistrer", (_e, next: AppData) => setData(next));
  ipcMain.handle("ouvrir-espace", (_e, id: string) => {
    const w = data.workspaces.find((x) => x.id === id);
    if (!w) throw new Error("Espace introuvable.");
    return openWorkspace(w);
  });
  ipcMain.handle("tester", (_e, item: Item) => openItem(item));
  ipcMain.handle("choisir", (e, kind: PickKind) => pick(BrowserWindow.fromWebContents(e.sender), kind));
  ipcMain.handle("chemins", (_e, paths: string[]) => paths.map((p) => {
    let dir = false;
    try { dir = fs.statSync(p).isDirectory(); } catch { /* introuvable : traité comme un fichier */ }
    return { path: p, kind: kindOfPath(p, dir) };
  }));
  ipcMain.on("ouvrir-donnees", () => void shell.openPath(dataDir));
  ipcMain.on("quitter", () => app.quit());

  const projet = arg(process.argv, "projet");
  if (projet !== null && !testReport) {
    // Lancée par « bosse <projet> » : on ouvre l'espace sans fenêtre, puis on s'arrête.
    void openByName(projet).then((ok) => { if (ok) setTimeout(() => app.quit(), 1500); });
  } else {
    createMain();
  }
  app.on("window-all-closed", () => app.quit());

  if (testReport) runLaunchTest(testReport, { getMain: () => win, getData, setData, openByName, dataFile, dryRun });
}

function createMain() {
  win = new BrowserWindow({
    width: 1000, height: 700, minWidth: 780, minHeight: 540, show: false,
    title: APP_NAME, backgroundColor: "#111418", icon: nativeImage.createFromPath(path.join(assets, "icon.png")),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  win.loadFile(rendererHtml);
  win.once("ready-to-show", () => win?.show());
  win.on("closed", () => { win = null; });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
}

export function showMain(message?: string) {
  if (!win) createMain();
  const w = win!;
  if (w.isMinimized()) w.restore();
  w.show();
  w.focus();
  if (message) {
    const send = () => w.webContents.send("message", message);
    if (w.webContents.isLoading()) w.webContents.once("did-finish-load", send); else send();
  }
}

function notify(title: string, body: string) {
  if (testReport || !Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: true, icon: path.join(assets, "icon.png") });
  n.on("click", () => showMain());
  n.show();
}

// ----- Ouverture d'un espace --------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ouvre l'espace nommé ; s'il n'existe pas, la fenêtre s'ouvre avec un message. */
export async function openByName(name: string): Promise<boolean> {
  const w = findWorkspace(data, name);
  if (!w) {
    const noms = data.workspaces.map((x) => x.name).join(", ");
    showMain(name.trim()
      ? `Aucun espace ne s'appelle « ${name.trim()} ».${noms ? ` Espaces : ${noms}.` : " Créez-le ici."}`
      : "Indiquez le nom d'un espace : bosse <projet>.");
    return false;
  }
  const r = await openWorkspace(w);
  const fails = r.results.filter((x) => !x.ok);
  if (fails.length) notify(`${w.name} : ${fails.length} élément${fails.length > 1 ? "s" : ""} non ouvert${fails.length > 1 ? "s" : ""}`, fails.map((f) => `${f.label} : ${f.error}`).join("\n").slice(0, 250));
  else notify(`Espace « ${w.name} » ouvert`, r.results.map((x) => x.label).join(", ").slice(0, 250) || "Rien à ouvrir.");
  return true;
}

export async function openWorkspace(w: Workspace): Promise<LaunchReport> {
  const results: LaunchReport["results"] = [];
  const names = Object.fromEntries(state().apps.map((a) => [a.id, a.name]));
  if (w.powertoys) {
    results.push(await attempt("PowerToys Workspaces", () => openPowerToys(w.powertoys!)));
    await sleep(400);
  }
  for (const it of w.items) {
    results.push(await attempt(itemLabel(it, names), () => openItem(it)));
    await sleep(250);
  }
  if (w.chrono) {
    const projet = chronoName(w);
    results.push(await attempt(`Chrono sur « ${projet} »`, async () => {
      if (dryRun.on) { dryRun.opened.push(`chrono:${projet}`); return; }
      await launchById(CHRONO_ID, [`--projet=${projet}`], "Rayan's Chrono");
    }));
  }
  data = { ...data, workspaces: data.workspaces.map((x) => (x.id === w.id ? { ...x, lastOpened: Date.now() } : x)) };
  try { save(); } catch (e) { console.error(e); }
  win?.webContents.send("etat", state());
  if (win && data.settings.hideAfterLaunch && results.every((x) => x.ok) && !testReport) win.minimize();
  return { name: w.name, results };
}

async function attempt(label: string, fn: () => Promise<void>) {
  try { await fn(); return { label, ok: true }; }
  catch (e) { return { label, ok: false, error: String((e as Error)?.message ?? e) }; }
}

export async function openItem(it: Item): Promise<void> {
  if (dryRun.on) { dryRun.opened.push(`${it.kind}:${it.target}`); return; }
  switch (it.kind) {
    case "url": {
      const url = normalizeUrl(it.target);
      if (!url) throw new Error("adresse invalide");
      await shell.openExternal(url);
      return;
    }
    case "rayan": {
      const a = installedApps().find((x) => x.id === it.target);
      if (!a) throw new Error("application non installée dans Rayan's Launcher");
      await launchApp(a);
      return;
    }
    case "app": {
      if (!fs.existsSync(it.target)) throw new Error("programme introuvable");
      if (/\.exe$/i.test(it.target)) {
        await new Promise<void>((resolve, reject) => {
          const c = spawn(it.target, splitArgs(it.args), { cwd: path.dirname(it.target), detached: true, stdio: "ignore" });
          c.once("error", reject);
          c.once("spawn", () => { c.unref(); resolve(); });
        });
        return;
      }
      await openPath(it.target);
      return;
    }
    case "dossier":
    case "fichier":
      if (!fs.existsSync(it.target)) throw new Error(it.kind === "dossier" ? "dossier introuvable" : "fichier introuvable");
      await openPath(it.target);
  }
}

async function openPath(p: string) {
  const err = await shell.openPath(p);
  if (err) throw new Error(err);
}

async function openPowerToys(id: string) {
  if (dryRun.on) { dryRun.opened.push(`powertoys:${id}`); return; }
  const exe = powerToysLauncher();
  if (!exe) throw new Error("PowerToys n'est pas installé");
  await new Promise<void>((resolve, reject) => {
    const c = spawn(exe, [id], { cwd: path.dirname(exe), detached: true, stdio: "ignore" });
    c.once("error", reject);
    c.once("spawn", () => { c.unref(); resolve(); });
  });
}

async function pick(parent: BrowserWindow | null, kind: PickKind): Promise<string[]> {
  const opts: Electron.OpenDialogOptions = kind === "dossier"
    ? { title: "Choisir des dossiers", properties: ["openDirectory", "multiSelections"] }
    : kind === "app"
      ? { title: "Choisir un programme", properties: ["openFile"], defaultPath: process.env.ProgramFiles, filters: [{ name: "Programmes et raccourcis", extensions: ["exe", "lnk", "bat", "cmd", "appref-ms"] }] }
      : { title: "Choisir des fichiers", properties: ["openFile", "multiSelections"] };
  const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
  return r.canceled ? [] : r.filePaths;
}

export { launcherRoot };
