// Fenêtres et surveillance des aides à la concentration (voir core/focus.ts) :
//   - écran de pause plein écran, au-dessus de tout, pendant les pauses du Pomodoro ;
//   - barre fine en haut de l'écran principal, transparente aux clics ;
//   - pendant le travail, un petit PowerShell surveille la fenêtre au premier plan et réduit celles dont le titre
//     contient un mot bloqué (YouTube, Instagram…). Il est arrêté dès la fin de la phase de travail.
import { BrowserWindow, Notification, screen } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { etatFocus, REPORT_MS, type Report } from "../core/focus.ts";
import type { AppData } from "../core/types.ts";

interface Contexte { rendererHtml: string; preload: string; icone: string; test: boolean }

let ctx: Contexte;
let pauseWin: BrowserWindow | null = null;
let barreWin: BrowserWindow | null = null;
let report: Report | null = null;
let veilleur: ChildProcess | null = null;
let motsVeilleur = "";
let derniereAlerte = 0;

export function initFocus(c: Contexte) { ctx = c; }

const ouverte = (w: BrowserWindow | null): w is BrowserWindow => !!w && !w.isDestroyed();

/** Appelé à chaque changement d'état et chaque seconde. */
export function majFocus(d: AppData, now: number) {
  if (!ctx) return;
  const e = etatFocus(d, now, report);
  // Écran de pause
  if (e.ecranPause && !ouverte(pauseWin)) ouvrirPause();
  if (!e.ecranPause && ouverte(pauseWin)) { pauseWin.destroy(); pauseWin = null; }
  if (ouverte(pauseWin)) pauseWin.webContents.send("etat", d);
  // Barre du temps de travail
  if (e.barre && !ouverte(barreWin)) ouvrirBarre();
  if (!e.barre && ouverte(barreWin)) { barreWin.destroy(); barreWin = null; }
  if (ouverte(barreWin)) barreWin.webContents.send("barre", e.ratio);
  // Distractions
  const mots = e.bloquer ? JSON.stringify(d.settings.motsBloques) : "";
  if (mots !== motsVeilleur) { arreterVeilleur(); if (mots) demarrerVeilleur(d.settings.motsBloques); motsVeilleur = mots; }
}

/** « Encore 5 min » : une fois par pause. */
export function reporterPause(d: AppData, now: number) {
  const t = d.timer;
  if (t.endsAt === null || report?.pause === t.endsAt) return;
  report = { pause: t.endsAt, jusqua: now + REPORT_MS };
  majFocus(d, now);
}

export function fermerFocus() {
  arreterVeilleur();
  for (const w of [pauseWin, barreWin]) if (ouverte(w)) w.destroy();
  pauseWin = barreWin = null;
}

function ouvrirPause() {
  const ecran = screen.getPrimaryDisplay().bounds;
  pauseWin = new BrowserWindow({
    ...ecran, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: true,
    skipTaskbar: true, alwaysOnTop: true, backgroundColor: "#111418", show: false, title: "Rayan's Chrono (pause)", icon: ctx.icone,
    webPreferences: { preload: ctx.preload, contextIsolation: true, sandbox: true },
  });
  pauseWin.on("page-title-updated", (e) => e.preventDefault());
  pauseWin.setAlwaysOnTop(true, "screen-saver");
  pauseWin.setVisibleOnAllWorkspaces(true);
  void pauseWin.loadFile(ctx.rendererHtml, { query: { vue: "pause" } });
  pauseWin.once("ready-to-show", () => { if (!ouverte(pauseWin)) return; pauseWin.show(); pauseWin.setFullScreen(true); pauseWin.focus(); });
  // Alt+F4 ou fermeture forcée : la fenêtre revient tant que la pause dure (prochain passage de majFocus).
  pauseWin.on("closed", () => { pauseWin = null; });
}

function ouvrirBarre() {
  const { bounds } = screen.getPrimaryDisplay();
  barreWin = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: 4, frame: false, transparent: true, resizable: false, movable: false,
    focusable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, thickFrame: false, minHeight: 1, show: false, title: "Rayan's Chrono (barre)",
    webPreferences: { preload: ctx.preload, contextIsolation: true, sandbox: true },
  });
  barreWin.on("page-title-updated", (e) => e.preventDefault());
  barreWin.setAlwaysOnTop(true, "screen-saver");
  barreWin.setIgnoreMouseEvents(true);
  void barreWin.loadFile(ctx.rendererHtml, { query: { vue: "barre" } });
  barreWin.once("ready-to-show", () => { if (!ouverte(barreWin)) return; barreWin.showInactive(); barreWin.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: 4 }); });
  barreWin.on("closed", () => { barreWin = null; });
}

// ----- Distractions --------------------------------------------------------------------------------

/** Boucle PowerShell : toutes les secondes, si la fenêtre au premier plan contient un mot bloqué, elle est réduite. */
export const SCRIPT_VEILLEUR = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type @'
using System; using System.Runtime.InteropServices; using System.Text;
public static class RcFenetre {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
}
'@
$mots = (ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:RC_MOTS)))) | ForEach-Object { $_.Normalize([Text.NormalizationForm]::FormD) -replace '\\p{Mn}', '' } | ForEach-Object { $_.ToLowerInvariant() }
while ($true) {
  $h = [RcFenetre]::GetForegroundWindow()
  $sb = New-Object Text.StringBuilder 512
  [void][RcFenetre]::GetWindowText($h, $sb, 512)
  $titre = $sb.ToString()
  $plat = ($titre.Normalize([Text.NormalizationForm]::FormD) -replace '\\p{Mn}', '').ToLowerInvariant()
  if ($plat -and -not $plat.Contains("rayan's chrono")) {
    foreach ($m in $mots) { if ($m -and $plat.Contains($m)) { [void][RcFenetre]::ShowWindow($h, 6); Write-Output $m; break } }
  }
  Start-Sleep -Milliseconds 1000
}
`;

function demarrerVeilleur(mots: string[]) {
  if (process.platform !== "win32" || ctx.test) return;
  const sys = process.env.SystemRoot ?? "C:\\Windows";
  veilleur = spawn(path.join(sys, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Buffer.from(SCRIPT_VEILLEUR, "utf16le").toString("base64")],
    { windowsHide: true, env: { ...process.env, RC_MOTS: Buffer.from(JSON.stringify(mots), "utf8").toString("base64") } });
  veilleur.stdout?.setEncoding("utf8");
  veilleur.stdout?.on("data", (txt: string) => {
    const mot = txt.trim().split(/\r?\n/).pop();
    if (!mot || Date.now() - derniereAlerte < 20_000 || !Notification.isSupported()) return;
    derniereAlerte = Date.now();
    new Notification({ title: "Pas maintenant 🙂", body: `Fenêtre « ${mot} » réduite : tu es en séance de travail. Elle sera de nouveau libre à la pause.`, silent: true, icon: ctx.icone }).show();
  });
  veilleur.on("exit", () => { veilleur = null; });
}

function arreterVeilleur() {
  if (veilleur && veilleur.exitCode === null) veilleur.kill();
  veilleur = null;
  motsVeilleur = "";
}
