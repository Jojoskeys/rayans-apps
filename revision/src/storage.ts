/**
 * Accès au disque. Dans l'application (Tauri), les données sont dans un fichier JSON local
 * (voir src-tauri/src/lib.rs) ; dans un simple navigateur (`npm run dev:ui`), dans localStorage.
 */
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { dayKey } from "./core/fsrs";
import { parseDb } from "./core/io";
import type { Db } from "./core/model";
import { sampleDb } from "./core/sample";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const LS_KEY = "rayans-revision-db";

export interface LoadResult {
  db: Db;
  /** Message à afficher (copie de secours utilisée, premier démarrage…). */
  notice: string | null;
  firstRun: boolean;
  dir: string;
}

interface Loaded {
  main: string | null;
  backup: string | null;
  dir: string;
}

export async function loadDb(): Promise<LoadResult> {
  const raw: Loaded = isTauri
    ? await invoke<Loaded>("load_db")
    : { main: localStorage.getItem(LS_KEY), backup: null, dir: "localStorage (navigateur)" };
  if (raw.main !== null) {
    try {
      return { db: parseDb(raw.main), notice: null, firstRun: false, dir: raw.dir };
    } catch (e) {
      if (raw.backup !== null) {
        try {
          return {
            db: parseDb(raw.backup),
            notice: "Le fichier de données était illisible : la copie de secours (version précédente) a été chargée.",
            firstRun: false,
            dir: raw.dir,
          };
        } catch {
          /* on signale l'erreur d'origine ci-dessous */
        }
      }
      throw new Error(
        `Le fichier de données (${raw.dir}\\revision.json) est illisible : ${(e as Error).message} ` +
          "Il n'a pas été modifié. Restaurez une copie du dossier « sauvegardes » ou déplacez ce fichier pour repartir de zéro.",
      );
    }
  }
  const db = sampleDb();
  await saveDb(db);
  return { db, notice: null, firstRun: true, dir: raw.dir };
}

export async function saveDb(db: Db): Promise<void> {
  const text = JSON.stringify(db);
  if (isTauri) await invoke("save_db", { text, day: dayKey(Date.now(), db.settings.dayStartHour) });
  else localStorage.setItem(LS_KEY, text);
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
      try {
        await saveDb(db);
      } catch (e) {
        this.onError(`Enregistrement impossible : ${String(e)}`);
      }
    }
    this.running = false;
  }
}

export interface PickedFile {
  name: string;
  text: string;
}

const IMPORT_EXT = ["csv", "txt", "tsv", "json"];

export async function pickImportFile(): Promise<PickedFile | null> {
  if (isTauri) {
    const path = await open({ multiple: false, directory: false, filters: [{ name: "CSV, texte ou JSON", extensions: IMPORT_EXT }] });
    if (!path || Array.isArray(path)) return null;
    const text = await invoke<string>("read_text_file", { path });
    return { name: path.split(/[\\/]/).pop() ?? path, text };
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = IMPORT_EXT.map((e) => "." + e).join(",");
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.click();
  });
}

/** Propose un emplacement et écrit le fichier. Renvoie le chemin choisi, ou null si annulé. */
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

/** Nom de fichier sans caractères interdits par Windows. */
export function safeFileName(s: string): string {
  return s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "export";
}
