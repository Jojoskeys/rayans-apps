// Appels à Windows : scripts PowerShell fournis avec l'application (son, Wi-Fi, OCR) et commandes d'alimentation.
import { app } from "electron";
import { execFile } from "node:child_process";
import path from "node:path";
import type { PowerMode } from "../core/commands.ts";

const scriptsDir = () => (app.isPackaged ? path.join(process.resourcesPath, "scripts") : path.join(app.getAppPath(), "resources"));

function run(file: string, args: string[], timeout = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim().split(/\r?\n/).filter((l) => !/^\s*(\+|Au caractère|At line|CategoryInfo|FullyQualifiedErrorId)/.test(l)).slice(0, 3).join(" ")));
      else resolve(stdout);
    });
  });
}

async function ps<T>(script: string, args: string[] = []): Promise<T> {
  if (process.platform !== "win32") throw new Error("Disponible seulement sous Windows.");
  const out = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(scriptsDir(), script), ...args]);
  const line = out.trim().split(/\r?\n/).pop() ?? "";
  return JSON.parse(line) as T;
}

export interface Output { id: string; nom: string; parDefaut: boolean }
export const listOutputs = () => ps<Output[] | Output>("son.ps1").then((r) => (Array.isArray(r) ? r : [r]));
export const setOutput = (id: string) => ps<Output[] | Output>("son.ps1", ["-Choisir", id]).then((r) => (Array.isArray(r) ? r : [r]));

export interface Wifi { connecte: boolean; ssid: string | null; securite: string | null; cle: string | null }
export const readWifi = () => ps<Wifi>("wifi.ps1");

export const ocr = (png: string) => ps<{ texte: string; langue: string }>("ocr.ps1", ["-Image", png]);

/** Extinction ou redémarrage confiés à Windows (shutdown.exe) : ils ont lieu même si l'application est fermée. */
export async function scheduleShutdown(mode: Exclude<PowerMode, "veille">, minutes: number) {
  await run("shutdown.exe", ["/a"]).catch(() => { /* rien à annuler */ });
  await run("shutdown.exe", [mode === "redemarrer" ? "/r" : "/s", "/t", String(Math.round(minutes * 60)), "/c", `Rayan's Outils : ${mode === "redemarrer" ? "redémarrage" : "extinction"} programmé(e).`]);
}
export const cancelShutdown = () => run("shutdown.exe", ["/a"]).then(() => true, () => false);

/** Mise en veille (et non hibernation) via l'API .NET de Windows. */
export const sleepNow = () => run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
  "Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)"]);
