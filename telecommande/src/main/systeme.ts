// Actions sur Windows : état, alimentation, applis et fenêtres, Wi-Fi. Tout s'exécute dans la session de Rayan.
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { lireInterfaces, lireProfils, type EtatWifi } from "../core/wifi.ts";

const SYS = process.env.SystemRoot ?? "C:\\Windows";

export function executer(fichier: string, args: string[], timeout = 20_000): Promise<string> {
  return new Promise((ok, ko) => {
    execFile(fichier, args, { timeout, windowsHide: true, encoding: "buffer", maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      // netsh écrit dans la page de code de la console : on décode en UTF-8 si possible, sinon en latin-1 (cp850 proche).
      const dec = (b: Buffer) => { const t = b.toString("utf8"); return t.includes("\uFFFD") ? b.toString("latin1") : t; };
      if (err && !stdout?.length) ko(new Error(dec(stderr as Buffer) || err.message)); else ok(dec(stdout as Buffer));
    });
  });
}

/** PowerShell avec un script encodé (aucun souci de guillemets) ; la sortie est en UTF-8. */
export function powershell(script: string, timeout = 30_000): Promise<string> {
  const complet = "[Console]::OutputEncoding=[Text.Encoding]::UTF8;$ProgressPreference='SilentlyContinue';" + script;
  return executer(path.join(SYS, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Buffer.from(complet, "utf16le").toString("base64")], timeout);
}

/** Texte passé à PowerShell entre apostrophes. */
export const psTexte = (s: string) => "'" + s.replace(/'/g, "''") + "'";

// ----- État -----------------------------------------------------------------------------------------

let cpuPrec = os.cpus().map((c) => c.times);
function chargeCpu(): number {
  const now = os.cpus().map((c) => c.times);
  let occupe = 0, total = 0;
  now.forEach((t, i) => {
    const p = cpuPrec[i] ?? t;
    const tot = (t.user + t.nice + t.sys + t.idle + t.irq) - (p.user + p.nice + p.sys + p.idle + p.irq);
    occupe += tot - (t.idle - p.idle); total += tot;
  });
  cpuPrec = now;
  return total > 0 ? Math.round((occupe / total) * 100) : 0;
}
setInterval(() => { /* garde une mesure récente */ }, 60_000).unref();

export interface Disque { lettre: string; total: number; libre: number }

export function disques(): Disque[] {
  const out: Disque[] = [];
  for (const l of "CDEFGHIJ") {
    try { const s = fs.statfsSync(`${l}:\\`); if (s.blocks > 0) out.push({ lettre: l, total: s.blocks * s.bsize, libre: s.bavail * s.bsize }); } catch { /* absent */ }
  }
  return out;
}

export async function wifi(): Promise<EtatWifi> {
  try { return lireInterfaces(await executer(path.join(SYS, "System32", "netsh.exe"), ["wlan", "show", "interfaces"])); }
  catch { return { connecte: false, ssid: null, signal: null, profil: null }; }
}

export async function profilsWifi(): Promise<string[]> {
  try { return lireProfils(await executer(path.join(SYS, "System32", "netsh.exe"), ["wlan", "show", "profiles"])); } catch { return []; }
}

export async function etatSysteme() {
  return {
    nom: os.hostname(),
    demarreDepuis: Date.now() - os.uptime() * 1000,
    cpu: chargeCpu(),
    memoire: { total: os.totalmem(), libre: os.freemem() },
    disques: disques(),
    wifi: await wifi(),
  };
}

// ----- Alimentation ---------------------------------------------------------------------------------

export function verrouiller() { spawn(path.join(SYS, "System32", "rundll32.exe"), ["user32.dll,LockWorkStation"], { detached: true, stdio: "ignore" }).unref(); }

/** Redémarrage ou arrêt dans `delai` secondes (annulable pendant ce temps). */
export async function arret(type: "redemarrer" | "eteindre", delai = 20) {
  await executer(path.join(SYS, "System32", "shutdown.exe"), [type === "redemarrer" ? "/r" : "/s", "/t", String(delai), "/c", type === "redemarrer" ? "Redémarrage demandé depuis Rayan's Télécommande" : "Arrêt demandé depuis Rayan's Télécommande"]);
}
export async function annulerArret() { await executer(path.join(SYS, "System32", "shutdown.exe"), ["/a"]).catch(() => ""); }

/** Veille (S3), sans passer en veille prolongée. */
export function veille() {
  void powershell("Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend,$false,$false)");
}

// ----- Applications et fenêtres -----------------------------------------------------------------------

export interface Appli { id: string; nom: string; dossier: string; chemin: string }

/** Raccourcis du menu Démarrer (tous les utilisateurs + Rayan), sans les désinstalleurs et pages d'aide. */
export function applisMenuDemarrer(): Appli[] {
  const racines = [
    path.join(process.env.ProgramData ?? "C:\\ProgramData", "Microsoft", "Windows", "Start Menu", "Programs"),
    path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs"),
  ];
  const vus = new Map<string, Appli>();
  const parcourir = (dir: string, racine: string, prof: number) => {
    if (prof > 3) return;
    let entrees: fs.Dirent[] = [];
    try { entrees = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entrees) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { parcourir(p, racine, prof + 1); continue; }
      if (!/\.(lnk|url)$/i.test(e.name)) continue;
      const nom = e.name.replace(/\.(lnk|url)$/i, "");
      if (/d[ée]sinstall|uninstall|readme|lisez-moi|help|aide|documentation|website|site web|^(a propos|à propos|about)\b|^administrative tools$|^windows tools$/i.test(nom)) continue;
      const cle = nom.toLowerCase();
      if (vus.has(cle)) continue;
      vus.set(cle, { id: Buffer.from(cle).toString("base64url").slice(0, 40), nom, dossier: path.relative(racine, dir) || "", chemin: p });
    }
  };
  for (const r of racines) parcourir(r, r, 0);
  return [...vus.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

export interface Fenetre { pid: number; processus: string; titre: string }

export async function fenetres(): Promise<Fenetre[]> {
  const t = await powershell("Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | Select-Object Id,ProcessName,MainWindowTitle | ConvertTo-Json -Compress");
  if (!t.trim()) return [];
  const brut = JSON.parse(t);
  const liste = (Array.isArray(brut) ? brut : [brut]) as { Id: number; ProcessName: string; MainWindowTitle: string }[];
  const caches = /^(TextInputHost|ApplicationFrameHost|SystemSettings|ShellExperienceHost|SearchHost|StartMenuExperienceHost|LockApp)$/i;
  // Fenêtres techniques invisibles (ex. « fr.rayan.launcher-siw » des apps Tauri) et Tailscale lui-même : jamais proposées.
  return liste.filter((p) => !caches.test(p.ProcessName) && !/^tailscale/i.test(p.ProcessName) && !/-siw$/.test(p.MainWindowTitle) && p.Id !== process.pid)
    .map((p) => ({ pid: p.Id, processus: p.ProcessName, titre: p.MainWindowTitle }))
    .sort((a, b) => a.processus.localeCompare(b.processus, "fr"));
}

/** Ferme proprement (comme la croix) ; `forcer` arrête le processus sans enregistrer. */
export async function fermerFenetre(pid: number, forcer: boolean) {
  if (!Number.isInteger(pid) || pid <= 4) throw new Error("processus invalide");
  const interdits = /^(explorer|winlogon|csrss|lsass|services|svchost|dwm|tailscaled|tailscale-ipn)$/i;
  const nom = (await powershell(`(Get-Process -Id ${pid} -ErrorAction Stop).ProcessName`)).trim();
  if (interdits.test(nom)) throw new Error(`${nom} est un processus de Windows : il ne peut pas être fermé d'ici`);
  await powershell(forcer ? `Stop-Process -Id ${pid} -Force` : `$p=Get-Process -Id ${pid}; [void]$p.CloseMainWindow()`);
}

/** Ferme toutes les fenêtres d'un processus par son nom (scénarios). */
export async function fermerProcessus(nom: string) {
  if (!/^[\w .()+-]{1,80}$/.test(nom)) return;
  await powershell(`Get-Process -Name ${psTexte(nom)} -ErrorAction SilentlyContinue | ForEach-Object { [void]$_.CloseMainWindow() }`);
}

// ----- Connexions Bureau à distance (journal de Windows) ---------------------------------------------

export interface ConnexionBureau { at: number; utilisateur: string; adresse: string }

export async function connexionsBureau(max = 10): Promise<ConnexionBureau[]> {
  try {
    const t = await powershell(`Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-TerminalServices-RemoteConnectionManager/Operational';Id=1149} -MaxEvents ${max} -ErrorAction Stop | ForEach-Object { [pscustomobject]@{ at=[long]([DateTimeOffset]$_.TimeCreated).ToUnixTimeMilliseconds(); u=$_.Properties[0].Value; ip=$_.Properties[2].Value } } | ConvertTo-Json -Compress`);
    if (!t.trim()) return [];
    const brut = JSON.parse(t);
    return (Array.isArray(brut) ? brut : [brut]).map((e: { at: number; u: string; ip: string }) => ({ at: e.at, utilisateur: e.u, adresse: e.ip }));
  } catch { return []; }
}
