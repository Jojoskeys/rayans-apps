// « Coller en texte brut » : le raccourci (Ctrl+Alt+V par défaut) remplace le contenu du presse-papiers par son seul
// texte (sans police, couleurs ni liens), puis colle. Un petit PowerShell reste prêt en arrière-plan : il attend que
// les touches du raccourci soient relâchées, puis envoie Ctrl+V à la fenêtre active.
import { clipboard } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

const SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type @'
using System; using System.Runtime.InteropServices; using System.Threading;
public static class RoColler {
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int k);
  [DllImport("user32.dll")] static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
  public static void Coller() {
    // Ctrl, Alt, Maj, Windows : on attend qu'ils soient relâchés (2 s au plus).
    int[] mods = { 0x11, 0x12, 0x10, 0x5B, 0x5C };
    for (int i = 0; i < 100; i++) { bool bas = false; foreach (int m in mods) if ((GetAsyncKeyState(m) & 0x8000) != 0) bas = true; if (!bas) break; Thread.Sleep(20); }
    keybd_event(0x11, 0, 0, UIntPtr.Zero); keybd_event(0x56, 0, 0, UIntPtr.Zero);
    keybd_event(0x56, 0, 2, UIntPtr.Zero); keybd_event(0x11, 0, 2, UIntPtr.Zero);
  }
}
'@
Write-Output "pret"
while ($true) { $l = [Console]::In.ReadLine(); if ($null -eq $l) { break }; if ($l -eq 'colle') { [RoColler]::Coller(); Write-Output "ok" } }
`;

let ps: ChildProcess | null = null;

function aide(): ChildProcess | null {
  if (process.platform !== "win32") return null;
  if (ps && ps.exitCode === null && !ps.killed) return ps;
  const sys = process.env.SystemRoot ?? "C:\\Windows";
  ps = spawn(path.join(sys, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Buffer.from(SCRIPT, "utf16le").toString("base64")],
    { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
  ps.on("exit", () => { ps = null; });
  return ps;
}

/** Démarre l'aide à l'avance (le premier collage serait sinon lent d'une seconde). */
export const prechaufferCollage = () => { aide(); };
export const arreterCollage = () => { if (ps && ps.exitCode === null) ps.kill(); ps = null; };

/** Garde seulement le texte du presse-papiers. Renvoie false s'il n'y a pas de texte (une image, par exemple). */
export async function texteBrut(): Promise<boolean> {
  const t = await clipboard.readText();
  if (!t) return false;
  clipboard.writeText(t);
  return true;
}

/** Texte brut puis collage dans la fenêtre active. */
export async function collerBrut(): Promise<boolean> {
  if (!(await texteBrut())) return false;
  aide()?.stdin?.write("colle\n");
  return true;
}
