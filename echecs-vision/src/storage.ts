/**
 * Accès au disque. Dans l'application (Tauri), les données sont dans un fichier JSON local (voir src-tauri/src/lib.rs) ;
 * sur l'iPhone (Rayan's Mobile), dans le magasin synchronisé ; dans un simple navigateur, dans localStorage.
 */
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { dayKey, emptyDb, parseDb, type Db } from "./core/model";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const LS_KEY = "rayans-echecs-vision-db";
const FICHIER = "echecs-vision";

interface WebStore { load(app: string): Promise<string | null>; save(app: string, text: string): void }
const webStore = (): WebStore | undefined => (typeof window !== "undefined" ? (window as unknown as { rayansStore?: WebStore }).rayansStore : undefined);

interface Loaded { main: string | null; backup: string | null; dir: string }

export interface LoadResult { db: Db; notice: string | null; firstRun: boolean }

export async function loadDb(): Promise<LoadResult> {
  let raw: Loaded;
  if (isTauri) raw = await invoke<Loaded>("load_db");
  else if (webStore()) raw = { main: await webStore()!.load(FICHIER), backup: null, dir: "cet appareil (synchronisé)" };
  else {
    let main: string | null = null;
    try { main = localStorage.getItem(LS_KEY); } catch { /* stockage indisponible */ }
    raw = { main, backup: null, dir: "ce navigateur" };
  }
  if (raw.main !== null) {
    try {
      return { db: parseDb(raw.main), notice: null, firstRun: false };
    } catch (e) {
      if (raw.backup !== null) {
        try {
          return { db: parseDb(raw.backup), notice: "Le fichier de données était illisible : la copie de secours a été chargée.", firstRun: false };
        } catch { /* on signale l'erreur d'origine ci-dessous */ }
      }
      throw new Error(`Le fichier de données (${raw.dir}) est illisible : ${(e as Error).message} Il n'a pas été modifié.`);
    }
  }
  const db = emptyDb();
  await saveDb(db);
  return { db, notice: null, firstRun: true };
}

export async function saveDb(db: Db): Promise<void> {
  const text = JSON.stringify(db);
  if (isTauri) await invoke("save_db", { text, day: dayKey(Date.now(), db.reglages.heureJour) });
  else if (webStore()) webStore()!.save(FICHIER, text);
  else {
    try { localStorage.setItem(LS_KEY, text); } catch { /* stockage indisponible */ }
  }
}

/** Enregistre la dernière version des données, une écriture à la fois, sans en perdre aucune. */
export class Saver {
  private pending: Db | null = null;
  private running = false;
  constructor(private onError: (msg: string) => void) {}
  push(db: Db) {
    this.pending = db;
    if (!this.running) void this.loop();
  }
  private async loop() {
    this.running = true;
    while (this.pending) {
      const db = this.pending;
      this.pending = null;
      try { await saveDb(db); } catch (e) { this.onError(`Enregistrement impossible : ${String(e)}`); }
    }
    this.running = false;
  }
}

/** Propose un emplacement et écrit le fichier (copie des données). */
export async function saveExportFile(defaultName: string, text: string): Promise<string | null> {
  const ext = defaultName.split(".").pop() ?? "txt";
  if (isTauri) {
    const path = await save({ defaultPath: defaultName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (!path) return null;
    await invoke("write_text_file", { path, text });
    return path;
  }
  const url = URL.createObjectURL(new Blob([text], { type: ext === "json" ? "application/json" : "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return defaultName;
}

/** Test de lancement : signale que l'interface est prête (ne fait rien en dehors du test). */
export async function signalReady(summary: object): Promise<void> {
  if (isTauri) await invoke("smoke_ready", { summary: JSON.stringify(summary) });
}
