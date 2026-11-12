// Processus principal de Rayan's Chrono : il détient l'état (minuteur, projets, temps), le fait avancer,
// l'enregistre, et pilote la fenêtre principale, la mini-fenêtre et l'icône de la zone de notification.
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, screen, shell, Tray } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PHASE_LABEL, reduce, remaining, segmentElapsed } from "../core/engine.ts";
import { entriesCsv } from "../core/csv.ts";
import { formatClock } from "../core/summary.ts";
import type { Action, AppData, ChronoEvent } from "../core/types.ts";
import type { Command, ExportRequest, InitialState, Signal } from "../renderer/api-types.ts";
import { newId, Store } from "./store.ts";
import { runLaunchTest } from "./launch-test.ts";

const APP_NAME = "Rayan's Chrono";
const testArg = process.argv.find((a) => a.startsWith("--test-lancement="));
const testReport = testArg ? testArg.slice("--test-lancement=".length) : null;

// Données : dossier fourni par Rayan's Launcher (conservé entre les versions), sinon le dossier utilisateur.
// Le test de lancement travaille dans un dossier temporaire pour ne jamais toucher aux vraies données.
const dataDir = testReport
  ? fs.mkdtempSync(path.join(os.tmpdir(), "rayans-chrono-test-"))
  : process.env.HANGAR_APP_DATA || path.join(app.getPath("appData"), "Rayans Chrono");
if (testReport) app.setPath("userData", path.join(dataDir, "electron"));

const assets = path.join(__dirname, "..", "assets");
const rendererHtml = path.join(__dirname, "renderer", "index.html");

let store: Store;
let data: AppData;
let mainWin: BrowserWindow | null = null;
let miniWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let saveTimer: NodeJS.Timeout | null = null;
let trayHintShown = false;

if (!testReport && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showMain());
  app.whenReady().then(start);
}

// ----- État -------------------------------------------------------------------------------------

export function getData() { return data; }

export function dispatch(action: Action) {
  const r = reduce(data, action, { now: Date.now(), newId });
  if (!r.changed) return;
  data = r.data;
  for (const e of r.events) onEvent(e);
  // Le réglage « toujours au-dessus » s'applique tout de suite à la mini-fenêtre ouverte.
  if (action.type === "settings" && miniWin && !miniWin.isDestroyed()) miniWin.setAlwaysOnTop(data.settings.miniOnTop, "floating");
  broadcast();
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

export function saveNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try { store.save(data); } catch (err) { console.error("Enregistrement impossible :", err); }
}

function broadcast() {
  for (const w of [mainWin, miniWin]) if (w && !w.isDestroyed()) w.webContents.send("etat", data);
  updateTray();
}

function signal(s: Signal) {
  // Le son est joué par une seule fenêtre (la principale, même cachée) pour ne pas l'entendre deux fois.
  const w = mainWin && !mainWin.isDestroyed() ? mainWin : miniWin;
  w?.webContents.send("signal", s);
}

function onEvent(e: ChronoEvent) {
  if (e.type !== "phaseEnd") return;
  const s = data.settings;
  if (s.sound) signal({ type: "son", to: e.to });
  if (s.notifications && Notification.isSupported()) {
    const title = e.from === "travail" ? "Pomodoro terminé" : "Fin de la pause";
    const next = PHASE_LABEL[e.to].toLowerCase();
    const body = e.autoStarted
      ? `${PHASE_LABEL[e.to]} démarrée (${formatClock(remaining(data.timer, Date.now()))}).`
      : `Prochaine étape : ${next}. Cliquez sur Démarrer quand vous êtes prêt.`;
    const n = new Notification({ title, body, silent: true, icon: path.join(assets, "icon.png") });
    n.on("click", () => showMain());
    n.show();
  }
}

// ----- Démarrage -------------------------------------------------------------------------------

function start() {
  app.setAppUserModelId("fr.rayan.chrono");
  Menu.setApplicationMenu(null);
  store = new Store(dataDir);
  data = store.load(Date.now());
  // Rattrape les phases terminées pendant que l'application était fermée.
  dispatch({ type: "tick" });

  ipcMain.handle("etat", (): InitialState => ({ data, version: app.getVersion(), dataDir, warning: store.warning }));
  ipcMain.handle("action", (_e, action: Action) => dispatch(action));
  ipcMain.handle("export-csv", (_e, req: ExportRequest) => exportCsv(req));
  ipcMain.handle("commande", (_e, cmd: Command) => command(cmd));

  createTray();
  createMain(true);
  setInterval(() => { dispatch({ type: "tick" }); updateTrayTooltip(); }, 250);

  app.on("before-quit", () => { quitting = true; saveNow(); });
  app.on("window-all-closed", () => { /* l'application vit dans la zone de notification */ });

  if (testReport) runLaunchTest(testReport, { getMain: () => mainWin, getMini: () => miniWin, getTray: () => tray, store, command, dispatch, getData, saveNow, exportTo });
}

function windowIcon() {
  return nativeImage.createFromPath(path.join(assets, "icon.png"));
}

function createMain(show: boolean) {
  mainWin = new BrowserWindow({
    width: 980, height: 700, minWidth: 780, minHeight: 560, show: false,
    title: APP_NAME, backgroundColor: "#101318", icon: windowIcon(),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  mainWin.loadFile(rendererHtml);
  mainWin.once("ready-to-show", () => { if (show) mainWin?.show(); });
  mainWin.on("close", (e) => {
    if (quitting) return;
    if (data.settings.closeToTray) {
      e.preventDefault();
      mainWin?.hide();
      if (!trayHintShown && Notification.isSupported() && !testReport) {
        trayHintShown = true;
        new Notification({ title: APP_NAME, body: "Le chrono continue dans la zone de notification. Clic droit sur l'icône pour quitter.", silent: true }).show();
      }
    } else {
      quitting = true;
      app.quit();
    }
  });
  mainWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWin.webContents.on("will-navigate", (e) => e.preventDefault());
}

export function showMain() {
  if (!mainWin || mainWin.isDestroyed()) createMain(true);
  if (miniWin && !miniWin.isDestroyed()) miniWin.close();
  if (mainWin!.isMinimized()) mainWin!.restore();
  mainWin!.show();
  mainWin!.focus();
}

function openMini() {
  if (miniWin && !miniWin.isDestroyed()) { miniWin.show(); miniWin.focus(); return; }
  const W = 320, H = 112;
  const area = screen.getPrimaryDisplay().workArea;
  let x = data.ui.miniX ?? area.x + area.width - W - 24;
  let y = data.ui.miniY ?? area.y + area.height - H - 24;
  // Position enregistrée hors de tout écran (écran débranché) : on revient au coin par défaut.
  const visible = screen.getAllDisplays().some((d) => x >= d.workArea.x - W / 2 && x <= d.workArea.x + d.workArea.width - W / 2 && y >= d.workArea.y && y <= d.workArea.y + d.workArea.height - H / 2);
  if (!visible) { x = area.x + area.width - W - 24; y = area.y + area.height - H - 24; }
  miniWin = new BrowserWindow({
    width: W, height: H, x, y, frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    alwaysOnTop: data.settings.miniOnTop, skipTaskbar: true, show: false, title: `${APP_NAME} (mini)`,
    backgroundColor: "#101318", icon: windowIcon(),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  if (data.settings.miniOnTop) miniWin.setAlwaysOnTop(true, "floating");
  miniWin.loadFile(rendererHtml, { query: { vue: "mini" } });
  miniWin.once("ready-to-show", () => miniWin?.showInactive());
  miniWin.on("moved", () => {
    if (!miniWin) return;
    const [mx, my] = miniWin.getPosition();
    dispatch({ type: "miniPosition", x: mx, y: my });
  });
  miniWin.on("closed", () => { miniWin = null; updateTray(); });
  mainWin?.hide();
  updateTray();
}

async function command(cmd: Command) {
  switch (cmd) {
    case "mini": openMini(); break;
    case "principal": showMain(); break;
    case "masquer-mini": miniWin?.close(); break;
    case "quitter": quitting = true; app.quit(); break;
    case "ouvrir-dossier": await shell.openPath(dataDir); break;
  }
}


// ----- Export CSV -------------------------------------------------------------------------------

export function exportTo(file: string, req: ExportRequest) {
  fs.writeFileSync(file, entriesCsv(data, req.from ?? -Infinity, req.to ?? Infinity), "utf8");
}

async function exportCsv(req: ExportRequest): Promise<string | null> {
  const parent = BrowserWindow.getFocusedWindow() ?? mainWin;
  const opts = {
    title: "Exporter le temps en CSV",
    defaultPath: path.join(app.getPath("documents"), `${req.name.replace(/[\\/:*?"<>|]/g, "-")}.csv`),
    filters: [{ name: "CSV (Excel)", extensions: ["csv"] }],
  };
  const r = parent ? await dialog.showSaveDialog(parent, opts) : await dialog.showSaveDialog(opts);
  if (r.canceled || !r.filePath) return null;
  exportTo(r.filePath, req);
  return r.filePath;
}

// ----- Zone de notification -----------------------------------------------------------------------

let trayState = "";
let trayTip = "";

function trayIcon(kind: "arret" | "travail" | "pause") {
  return nativeImage.createFromPath(path.join(assets, `tray-${kind}.png`));
}

function createTray() {
  tray = new Tray(trayIcon("arret"));
  tray.setToolTip(APP_NAME);
  tray.on("click", () => {
    if (mainWin && mainWin.isVisible() && !mainWin.isMinimized()) mainWin.hide();
    else showMain();
  });
  updateTray();
}

function updateTray() {
  if (!tray || tray.isDestroyed()) return;
  const t = data.timer;
  const kind = t.status !== "marche" ? "arret" : t.mode === "pomodoro" && t.phase !== "travail" ? "pause" : "travail";
  const key = `${kind}|${t.status}|${t.mode}|${t.phase}|${!!miniWin}`;
  updateTrayTooltip();
  if (key === trayState) return;
  trayState = key;
  tray.setImage(trayIcon(kind));
  const running = t.status === "marche";
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: running ? "Mettre en pause" : t.status === "pause" ? "Reprendre" : "Démarrer", click: () => dispatch({ type: "toggle" }) },
    { label: "Passer à la phase suivante", enabled: t.mode === "pomodoro", click: () => dispatch({ type: "skip" }) },
    { label: "Arrêter et remettre à zéro", enabled: t.status !== "arret", click: () => dispatch({ type: "reset" }) },
    { type: "separator" },
    miniWin
      ? { label: "Fermer la mini-fenêtre", click: () => miniWin?.close() }
      : { label: "Mini-fenêtre", click: () => openMini() },
    { label: "Ouvrir Rayan's Chrono", click: () => showMain() },
    { type: "separator" },
    { label: "Quitter", click: () => { quitting = true; app.quit(); } },
  ]));
}

function updateTrayTooltip() {
  if (!tray || tray.isDestroyed()) return;
  const t = data.timer;
  const now = Date.now();
  const proj = data.projects.find((p) => p.id === data.selection.projectId)?.name ?? "";
  let tip: string;
  if (t.mode === "pomodoro") {
    const st = t.status === "marche" ? "" : t.status === "pause" ? " (en pause)" : " (arrêté)";
    tip = `${PHASE_LABEL[t.phase]} ${formatClock(remaining(t, now))}${st}`;
  } else {
    tip = t.status === "marche" ? `Chrono ${formatClock(segmentElapsed(t, now), false)}` : "Chrono arrêté";
  }
  tip = `${APP_NAME}\n${tip}${proj ? ` · ${proj}` : ""}`;
  if (tip !== trayTip) { trayTip = tip; tray.setToolTip(tip.slice(0, 127)); }
}
