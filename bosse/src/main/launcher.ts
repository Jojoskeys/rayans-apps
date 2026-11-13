// Applications installées par Rayan's Launcher : où elles sont, et comment les lancer comme le launcher le fait
// (même dossier de travail, mêmes variables HANGAR_*, donc les mêmes données).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface InstalledApp { id: string; name: string; version: string; exe: string; dataDir: string }

/** Dossier de Rayan's Launcher (%LOCALAPPDATA%\fr.rayan.launcher, ou HANGAR_HOME). */
export function launcherRoot(env: NodeJS.ProcessEnv = process.env): string {
  if (env.HANGAR_HOME) return env.HANGAR_HOME;
  // Lancée par le launcher : HANGAR_APP_DATA = <racine>\data\<id>.
  if (env.HANGAR_APP_DATA) return path.dirname(path.dirname(env.HANGAR_APP_DATA));
  return path.join(env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "fr.rayan.launcher");
}

/** Lit installed.json (contenu brut) et en déduit les applications installées. */
export function parseInstalled(raw: unknown, root: string): InstalledApp[] {
  const apps = (raw as { apps?: Record<string, unknown> } | null)?.apps;
  if (!apps || typeof apps !== "object") return [];
  const out: InstalledApp[] = [];
  for (const [id, v] of Object.entries(apps)) {
    const a = v as { name?: unknown; current?: { version?: unknown; dir?: unknown; executable?: unknown } };
    const c = a?.current;
    if (!/^[a-z0-9_-]{2,64}$/.test(id) || !c || typeof c.dir !== "string" || typeof c.executable !== "string") continue;
    if (c.dir.includes("..") || c.executable.includes("..")) continue;
    out.push({
      id, name: typeof a.name === "string" ? a.name : id, version: typeof c.version === "string" ? c.version : "",
      exe: path.join(root, "apps", id, "versions", c.dir, c.executable), dataDir: path.join(root, "data", id),
    });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name, "fr"));
}

export function installedApps(root = launcherRoot()): InstalledApp[] {
  try { return parseInstalled(JSON.parse(fs.readFileSync(path.join(root, "installed.json"), "utf8")), root); }
  catch { return []; }
}

/** Lance une application installée, détachée (elle continue si celle-ci se ferme). */
export function launchApp(app: InstalledApp, args: string[] = []): Promise<void> {
  if (!fs.existsSync(app.exe)) return Promise.reject(new Error(`${app.name} est introuvable : réinstallez-la depuis Rayan's Launcher.`));
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^(ELECTRON_|NODE_OPTIONS$|HANGAR_)/.test(k)) env[k] = v;
  fs.mkdirSync(app.dataDir, { recursive: true });
  Object.assign(env, { HANGAR_APP_ID: app.id, HANGAR_APP_VERSION: app.version, HANGAR_APP_DATA: app.dataDir });
  return new Promise((resolve, reject) => {
    const child = spawn(app.exe, args, { cwd: path.dirname(app.exe), env, detached: true, stdio: "ignore" });
    child.once("error", (e) => reject(new Error(`${app.name} n'a pas pu être lancée : ${e.message}`)));
    child.once("spawn", () => { child.unref(); resolve(); });
  });
}

/** Lance l'application installée `id` ; erreur lisible si elle n'est pas installée. */
export async function launchById(id: string, args: string[] = [], label = id, root = launcherRoot()) {
  const app = installedApps(root).find((a) => a.id === id);
  if (!app) throw new Error(`${label} n'est pas installée : ajoutez-la depuis Rayan's Launcher.`);
  await launchApp(app, args);
  return app;
}
