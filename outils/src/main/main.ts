// Processus principal de Rayan's Outils : fenêtre principale (un panneau par outil), barre de commande ouverte par
// un raccourci global, fenêtre de sélection pour copier le texte de l'écran, icône dans la zone de notification.
import { app, BrowserWindow, clipboard, desktopCapturer, dialog, globalShortcut, ipcMain, Menu, nativeImage, Notification, screen, shell, Tray } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import QRCode from "qrcode";
import { formatDuration, parse, pickOutput, wifiQrText, type PowerMode, type ToolId } from "../core/commands.ts";
import type { Goto, PdfQuality, Power, RunResult, Settings, State } from "../renderer/api-types.ts";
import { compressImage } from "./image.ts";
import { IMAGE_EXT, mergeToPdf, PDF_EXT, suggestPdfName } from "./pdf.ts";
import { ShareServer } from "./share.ts";
import { cancelShutdown, listOutputs, ocr, readWifi, scheduleShutdown, setOutput, sleepNow } from "./windows.ts";
import { runLaunchTest } from "./launch-test.ts";

const APP_NAME = "Rayan's Outils";
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const testReport = arg("test-lancement");
const atLogin = process.argv.includes("--demarrage");

const dataDir = testReport
  ? fs.mkdtempSync(path.join(os.tmpdir(), "rayans-outils-test-"))
  : arg("donnees") || process.env.HANGAR_APP_DATA || path.join(app.getPath("appData"), "Rayans Outils");
if (testReport) app.setPath("userData", path.join(dataDir, "electron"));
const dataFile = path.join(dataDir, "outils.json");

const assets = path.join(__dirname, "..", "assets");
const rendererHtml = path.join(__dirname, "renderer", "index.html");

const DEFAULTS: Settings = { shortcut: "Control+Alt+Space", startWithWindows: false, closeToTray: true, pdfQuality: "normale", imgTarget: 1024 };

let settings: Settings = { ...DEFAULTS };
let power: Power | null = null;
let lastText: State["lastText"] = null;
let shareQr: string | null = null;
let shortcutOk = false;
let powerTimer: NodeJS.Timeout | null = null;
let win: BrowserWindow | null = null;
let palette: BrowserWindow | null = null;
let capture: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

const inbox = testReport ? path.join(dataDir, "recus") : path.join(app.getPath("downloads"), "Depuis le téléphone");
const share = new ShareServer(inbox, () => {
  if (!share.info) shareQr = null;
  broadcast();
  const last = share.info?.received.at(-1);
  if (last && lastReceived !== last) { lastReceived = last; notify("Fichier reçu du téléphone", path.basename(last), () => shell.showItemInFolder(last)); }
});
let lastReceived: string | null = null;

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
    settings = {
      shortcut: typeof s.shortcut === "string" && s.shortcut ? s.shortcut : DEFAULTS.shortcut,
      startWithWindows: typeof s.startWithWindows === "boolean" ? s.startWithWindows : DEFAULTS.startWithWindows,
      closeToTray: typeof s.closeToTray === "boolean" ? s.closeToTray : DEFAULTS.closeToTray,
      pdfQuality: ["legere", "normale", "originale"].includes(s.pdfQuality) ? s.pdfQuality : DEFAULTS.pdfQuality,
      imgTarget: Number.isFinite(s.imgTarget) && s.imgTarget >= 20 ? s.imgTarget : DEFAULTS.imgTarget,
    };
    const p = raw.power;
    power = p && ["eteindre", "redemarrer", "veille"].includes(p.mode) && Number.isFinite(p.at) && p.at > Date.now() ? p : null;
  } catch { /* premier lancement ou fichier illisible : valeurs par défaut */ }
}

function save() {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ settings, power }, null, 1));
  fs.renameSync(tmp, dataFile);
}

export function state(): State {
  return { settings, power, lastText, share: share.info && shareQr ? { ...share.info, qr: shareQr } : null, version: app.getVersion(), dataDir, shortcutOk };
}

function broadcast() {
  for (const w of [win, palette]) if (w && !w.isDestroyed()) w.webContents.send("etat", state());
  updateTray();
}

function notify(title: string, body: string, onClick?: () => void) {
  if (!Notification.isSupported() || testReport) return;
  const n = new Notification({ title, body, icon: path.join(assets, "icon.png"), silent: true });
  n.on("click", () => (onClick ? onClick() : showMain()));
  n.show();
}

// ----- Démarrage --------------------------------------------------------------------------------

function start() {
  app.setAppUserModelId("fr.rayan.outils");
  Menu.setApplicationMenu(null);
  load();
  if (power?.mode === "veille") armSleep();

  ipcMain.handle("etat", () => state());
  ipcMain.handle("reglages", (_e, patch: Partial<Settings>) => updateSettings(patch));
  ipcMain.handle("commande", (_e, text: string) => runCommand(text));
  ipcMain.on("masquer-palette", () => palette?.hide());
  ipcMain.handle("choisir-fichiers", (e, kind: "pdf" | "image" | "tout", multiple: boolean) => pickFiles(BrowserWindow.fromWebContents(e.sender), kind, multiple));
  ipcMain.handle("pdf", (e, files: string[], quality: PdfQuality) => doMergePdf(BrowserWindow.fromWebContents(e.sender), files, quality));
  ipcMain.handle("img", async (_e, file: string, target: number) => {
    const r = await compressImage(file, target);
    updateSettings({ imgTarget: target });
    return r;
  });
  ipcMain.handle("partage", async (_e, files: string[]) => { await startShare(files); });
  ipcMain.handle("partage-stop", () => share.stop());
  ipcMain.handle("qr", (_e, text: string) => QRCode.toDataURL(text, { margin: 2, width: 420, errorCorrectionLevel: "M" }));
  ipcMain.handle("wifi", async () => {
    const w = await readWifi();
    return { ...w, qr: w.connecte && w.ssid ? await QRCode.toDataURL(wifiQrText(w.ssid, w.cle, w.securite), { margin: 2, width: 360 }) : null };
  });
  ipcMain.handle("sorties", () => listOutputs());
  ipcMain.handle("sortie", (_e, id: string) => setOutput(id));
  ipcMain.handle("capturer", () => startCapture());
  ipcMain.handle("alim", (_e, mode: PowerMode, minutes: number) => schedulePower(mode, minutes));
  ipcMain.handle("alim-annuler", () => cancelPower());
  ipcMain.on("montrer", (_e, p: string) => shell.showItemInFolder(p));
  ipcMain.on("ouvrir", (_e, p: string) => { void shell.openPath(p); });
  ipcMain.on("copier", (_e, t: string) => clipboard.writeText(t));
  ipcMain.on("quitter", () => { quitting = true; app.quit(); });
  ipcMain.on("capture-fin", (_e, rect) => void finishCapture(rect));

  createTray();
  createMain(!atLogin);
  registerShortcut();
  applyLoginItem();

  app.on("before-quit", () => { quitting = true; void share.stop(); });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("window-all-closed", () => { /* l'application vit dans la zone de notification */ });

  if (testReport) runLaunchTest(testReport, { getMain: () => win, getPalette: () => palette, getTray: () => tray, state, runCommand, share, dataDir, openPalette });
}

export function updateSettings(patch: Partial<Settings>): State {
  const before = settings;
  settings = { ...settings, ...patch };
  if (before.shortcut !== settings.shortcut) registerShortcut(before.shortcut);
  if (before.startWithWindows !== settings.startWithWindows) applyLoginItem();
  try { save(); } catch (e) { console.error(e); }
  broadcast();
  return state();
}

function registerShortcut(previous?: string) {
  if (previous) globalShortcut.unregister(previous);
  try { shortcutOk = globalShortcut.register(settings.shortcut, () => openPalette()); }
  catch { shortcutOk = false; }
}

function applyLoginItem() {
  if (!app.isPackaged || testReport || process.platform !== "win32") return;
  app.setLoginItemSettings({ openAtLogin: settings.startWithWindows, path: process.execPath, args: ["--demarrage", `--donnees=${dataDir}`], name: "Rayans Outils" });
}

// ----- Fenêtres ---------------------------------------------------------------------------------

const icon = () => nativeImage.createFromPath(path.join(assets, "icon.png"));
const webPreferences = () => ({ preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true });

function createMain(show: boolean) {
  win = new BrowserWindow({ width: 1000, height: 700, minWidth: 780, minHeight: 540, show: false, title: APP_NAME, backgroundColor: "#111418", icon: icon(), webPreferences: webPreferences() });
  win.loadFile(rendererHtml);
  win.once("ready-to-show", () => { if (show) win?.show(); });
  win.on("close", (e) => {
    if (quitting) return;
    if (settings.closeToTray) { e.preventDefault(); win?.hide(); } else { quitting = true; app.quit(); }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
}

export function showMain(go?: Goto) {
  if (!win || win.isDestroyed()) createMain(true);
  const w = win!;
  if (w.isMinimized()) w.restore();
  w.show();
  w.focus();
  if (go) {
    if (w.webContents.isLoading()) w.webContents.once("did-finish-load", () => w.webContents.send("aller", go));
    else w.webContents.send("aller", go);
  }
}

export function openPalette() {
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const W = 620, H = 480;
  if (!palette || palette.isDestroyed()) {
    palette = new BrowserWindow({
      width: W, height: H, frame: false, resizable: false, show: false, skipTaskbar: true, alwaysOnTop: true, transparent: true,
      maximizable: false, minimizable: false, fullscreenable: false, title: `${APP_NAME} (commande)`, icon: icon(), webPreferences: webPreferences(),
    });
    palette.loadFile(rendererHtml, { query: { vue: "palette" } });
    palette.on("blur", () => { if (!testReport) palette?.hide(); });
  }
  palette.setBounds({ x: Math.round(d.x + (d.width - W) / 2), y: Math.round(d.y + d.height * 0.18), width: W, height: H });
  const p = palette;
  const reveal = () => { p.show(); p.focus(); p.webContents.send("etat", state()); };
  if (p.webContents.isLoading()) p.webContents.once("did-finish-load", reveal); else reveal();
}

// ----- Barre de commande ------------------------------------------------------------------------

export async function runCommand(text: string): Promise<RunResult> {
  const c = parse(text);
  if (!c) return { ok: false, message: "Commande inconnue. Essayez : pdf, img 1mo, tel, wifi, son, texte, eteins 45." };
  const go = (g: Goto): RunResult => { palette?.hide(); showMain(g); return { ok: true, close: true }; };
  switch (c.tool) {
    case "pdf": return go({ tool: "pdf" });
    case "img": return go({ tool: "img", targetKo: c.targetKo });
    case "tel": return go({ tool: "tel", text: c.text });
    case "wifi": return go({ tool: "wifi" });
    case "texte": palette?.hide(); await startCapture(); return { ok: true, close: true };
    case "son": {
      const outs = await listOutputs();
      const target = pickOutput(outs, c.query);
      if (!target) return go({ tool: "son", message: c.query ? `Aucune sortie audio ne correspond à « ${c.query} ».` : "Aucune sortie audio trouvée." });
      if (!target.parDefaut) await setOutput(target.id);
      notify("Sortie audio", target.nom);
      broadcast();
      return { ok: true, close: true, message: `Sortie audio : ${target.nom}` };
    }
    case "eteins": {
      if (c.cancel) { await cancelPower(); notify("Minuterie annulée", "L'ordinateur ne s'éteindra pas."); return { ok: true, close: true }; }
      if (c.minutes === null) return go({ tool: "eteins" });
      await schedulePower(c.mode, c.minutes);
      return { ok: true, close: true };
    }
  }
}

// ----- Outils -----------------------------------------------------------------------------------

async function pickFiles(parent: BrowserWindow | null, kind: "pdf" | "image" | "tout", multiple: boolean) {
  const filters = kind === "image"
    ? [{ name: "Images", extensions: IMAGE_EXT }]
    : kind === "pdf" ? [{ name: "Images et PDF", extensions: [...IMAGE_EXT, ...PDF_EXT] }] : [{ name: "Tous les fichiers", extensions: ["*"] }];
  const opts = { title: "Choisir des fichiers", properties: (multiple ? ["openFile", "multiSelections"] : ["openFile"]) as ("openFile" | "multiSelections")[], filters };
  const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
  return r.canceled ? [] : r.filePaths;
}

async function doMergePdf(parent: BrowserWindow | null, files: string[], quality: PdfQuality) {
  const opts = { title: "Enregistrer le PDF", defaultPath: suggestPdfName(files), filters: [{ name: "PDF", extensions: ["pdf"] }] };
  const r = parent ? await dialog.showSaveDialog(parent, opts) : await dialog.showSaveDialog(opts);
  if (r.canceled || !r.filePath) return null;
  const res = await mergeToPdf(files, r.filePath, quality);
  if (quality !== settings.pdfQuality) updateSettings({ pdfQuality: quality });
  return { out: r.filePath, ...res };
}

export async function startShare(files: string[]) {
  const info = await share.start(files);
  shareQr = await QRCode.toDataURL(info.url, { margin: 2, width: 420 });
  broadcast();
}

// Minuterie d'alimentation : extinction et redémarrage par Windows, veille par l'application.
export async function schedulePower(mode: PowerMode, minutes: number) {
  if (testReport) throw new Error("désactivé pendant le test");
  await cancelPower(false);
  if (mode === "veille") { power = { mode, at: Date.now() + minutes * 60_000 }; armSleep(); }
  else { await scheduleShutdown(mode, minutes); power = { mode, at: Date.now() + minutes * 60_000 }; }
  save();
  broadcast();
  const what = mode === "veille" ? "Mise en veille" : mode === "redemarrer" ? "Redémarrage" : "Extinction";
  notify(`${what} dans ${formatDuration(minutes)}`, "Tapez « eteins annuler » ou ouvrez Rayan's Outils pour annuler.");
}

export async function cancelPower(notifyState = true) {
  if (powerTimer) { clearTimeout(powerTimer); powerTimer = null; }
  if (power && power.mode !== "veille") await cancelShutdown();
  power = null;
  save();
  if (notifyState) broadcast();
}

function armSleep() {
  if (powerTimer) clearTimeout(powerTimer);
  const p = power;
  if (!p) return;
  powerTimer = setTimeout(() => { power = null; save(); broadcast(); void sleepNow(); }, Math.max(0, p.at - Date.now()));
}

// ----- Texte de l'écran (OCR) -------------------------------------------------------------------

let captureShot: { image: Electron.NativeImage; scale: number } | null = null;

export async function startCapture() {
  if (capture && !capture.isDestroyed()) return;
  await new Promise((r) => setTimeout(r, 180)); // laisse la barre de commande disparaître
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const size = { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) };
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: size });
  const src = sources.find((s) => s.display_id === String(d.id)) ?? sources[0];
  if (!src) throw new Error("Capture d'écran impossible.");
  captureShot = { image: src.thumbnail, scale: src.thumbnail.getSize().width / d.bounds.width };
  capture = new BrowserWindow({
    ...d.bounds, frame: false, show: false, skipTaskbar: true, alwaysOnTop: true, resizable: false, movable: false,
    fullscreenable: false, enableLargerThanScreen: true, hasShadow: false, title: `${APP_NAME} (sélection)`, webPreferences: webPreferences(),
  });
  capture.setAlwaysOnTop(true, "screen-saver");
  capture.loadFile(rendererHtml, { query: { vue: "capture" } });
  capture.webContents.once("did-finish-load", () => {
    capture?.webContents.send("capture-image", src.thumbnail.toDataURL());
    capture?.setBounds(d.bounds);
    capture?.show();
    capture?.focus();
  });
  capture.on("closed", () => { capture = null; });
}

async function finishCapture(rect: { x: number; y: number; width: number; height: number } | null) {
  const shot = captureShot;
  captureShot = null;
  capture?.close();
  if (!rect || !shot || rect.width < 4 || rect.height < 4) return;
  const k = shot.scale;
  let crop = shot.image.crop({ x: Math.round(rect.x * k), y: Math.round(rect.y * k), width: Math.round(rect.width * k), height: Math.round(rect.height * k) });
  // Le moteur OCR de Windows lit mieux le petit texte agrandi.
  const { width, height } = crop.getSize();
  if (Math.max(width, height) < 900) crop = crop.resize({ width: width * 2, height: height * 2, quality: "best" });
  const tmp = path.join(os.tmpdir(), `rayans-outils-ocr-${Date.now()}.png`);
  fs.writeFileSync(tmp, crop.toPNG());
  try {
    const r = await ocr(tmp);
    const texte = r.texte.trim();
    lastText = { texte, at: Date.now() };
    if (texte) { clipboard.writeText(texte); notify("Texte copié", texte.length > 120 ? `${texte.slice(0, 117)}…` : texte); }
    else notify("Aucun texte reconnu", "Essayez une zone plus grande ou un texte plus net.", () => showMain({ tool: "texte" }));
  } catch (e) {
    lastText = { texte: "", at: Date.now() };
    notify("Reconnaissance impossible", String((e as Error).message ?? e), () => showMain({ tool: "texte" }));
  } finally {
    fs.rmSync(tmp, { force: true });
    broadcast();
  }
}

// ----- Zone de notification -----------------------------------------------------------------------

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(assets, "tray.png")));
  tray.on("click", () => openPalette());
  updateTray();
}

function updateTray() {
  if (!tray || tray.isDestroyed()) return;
  const accel = settings.shortcut.replace("Control", "Ctrl").replace("Space", "Espace");
  let tip = `${APP_NAME}\nBarre de commande : ${accel}`;
  if (power) tip += `\n${power.mode === "veille" ? "Veille" : power.mode === "redemarrer" ? "Redémarrage" : "Extinction"} à ${new Date(power.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  if (share.active) tip += "\nPartage avec le téléphone en cours";
  tray.setToolTip(tip.slice(0, 127));
  const go = (tool: ToolId) => () => showMain({ tool });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Barre de commande (${accel})`, click: () => openPalette() },
    { label: "Ouvrir Rayan's Outils", click: () => showMain() },
    { type: "separator" },
    { label: "Copier le texte de l'écran", click: () => void startCapture() },
    { label: "Échanger avec le téléphone", click: go("tel") },
    { label: "Mot de passe Wi-Fi", click: go("wifi") },
    ...(power ? [{ label: "Annuler la minuterie d'arrêt", click: () => void cancelPower() }] : []),
    ...(share.active ? [{ label: "Arrêter le partage", click: () => void share.stop() }] : []),
    { type: "separator" },
    { label: "Quitter", click: () => { quitting = true; app.quit(); } },
  ]));
}
