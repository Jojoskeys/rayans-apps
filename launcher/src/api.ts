// Pont vers la couche Rust. Hors de Tauri (simple `npm run dev:ui` dans un navigateur), un faux
// backend en mémoire permet de voir tous les états de l'interface.
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { mockBackend } from "./mock";

export interface ErrorInfo {
  code: string;
  message: string;
  hint: string;
}

export interface TaskView {
  kind: "install" | "update";
  phase: "downloading" | "verifying" | "extracting" | "finalizing";
  received: number;
  total: number | null;
}

export interface AppView {
  id: string;
  name: string;
  description: string;
  releaseNotes: string;
  releaseDate: string | null;
  size: number | null;
  availableVersion: string | null;
  installedVersion: string | null;
  installedReleaseNotes: string | null;
  pendingVersion: string | null;
  inCatalog: boolean;
  updateAvailable: boolean;
  running: boolean;
  task: TaskView | null;
  /** Octets déjà reçus d'un téléchargement annulé ou coupé. */
  partialBytes: number | null;
  lastError: ErrorInfo | null;
  dataDir: string;
  /** Version précédente gardée sur le disque : retour possible. */
  previousVersion: string | null;
  /** Versions du catalogue ignorées jusqu'à celle-ci incluse. */
  heldVersion: string | null;
  backupCount: number;
  lastBackupAt: string | null;
}

export interface BackupInfo {
  id: string;
  appId: string;
  version: string | null;
  createdAt: string;
  /** manual, update (avant une mise à jour), restore (avant une restauration), rollback (avant un retour) */
  reason: "manual" | "update" | "restore" | "rollback";
  size: number;
  files: number;
}

export interface CatalogView {
  status: "none" | "ready";
  title: string | null;
  sourceUrl: string | null;
  fetchedAt: string | null;
  fromCache: boolean;
  trust: "signed" | "unsigned" | null;
  refreshing: boolean;
  error: ErrorInfo | null;
  warning: string | null;
  appCount: number;
}

export interface Snapshot {
  mode: "development" | "distributed";
  publicKeyConfigured: boolean;
  catalogUrl: string | null;
  dataRoot: string;
  catalog: CatalogView;
  apps: AppView[];
  /** Catalogue local modifiable (ajout de ZIP possible), sinon null. */
  localCatalogPath: string | null;
  /** Résultat du dernier import du dossier « À ajouter ». */
  notices: string[];
}

export interface LauncherUpdate {
  version: string;
  file: string;
  /** Annoncée par le catalogue publié (sinon : installateur déposé dans « À ajouter »). */
  fromCatalog: boolean;
}

export interface Features {
  shortcuts: boolean;
  /** Raccourci global de la palette, ou null s'il n'a pas pu être enregistré. */
  paletteShortcut: string | null;
}

export interface ZipEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  releaseNotes: string;
  executable: string;
}

export interface ZipProposal {
  entry: ZipEntry;
  executables: string[];
  source: "manifeste" | "modèle" | "deviné";
  existingVersion: string | null;
  complete: boolean;
}

export type CoreEvent =
  | { type: "changed" }
  | { type: "progress"; appId: string; task: TaskView }
  | { type: "exited"; appId: string; code: number | null };

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return inTauri ? invoke<T>(cmd, args) : mockBackend.invoke<T>(cmd, args);
}

export const api = {
  snapshot: () => call<Snapshot>("get_snapshot"),
  refresh: () => call<void>("refresh_catalog"),
  setCatalogUrl: (url: string) => call<void>("set_catalog_url", { url }),
  install: (id: string) => call<void>("install", { id }),
  launch: (id: string) => call<number>("launch", { id }),
  uninstall: (id: string, removeData: boolean) => call<void>("uninstall", { id, removeData }),
  dismissError: (id: string) => call<void>("dismiss_error", { id }),
  inspectZip: (path: string) => call<ZipProposal>("inspect_zip", { path }),
  addZip: (path: string, entry: ZipEntry) => call<string>("add_zip", { path, entry }),
  dismissNotices: () => call<void>("dismiss_notices"),
  cancelDownload: (id: string) => call<boolean>("cancel_download", { id }),
  discardDownload: (id: string) => call<void>("discard_download", { id }),
  openFolder: (id: string, which: "install" | "data") => call<void>("open_folder", { id, which }),
  features: () => call<Features>("features"),
  createShortcut: (id: string) => call<string>("create_shortcut", { id }),
  launcherUpdate: () => call<LauncherUpdate | null>("launcher_update"),
  applyLauncherUpdate: () => call<void>("apply_launcher_update"),
  /** Fenêtre « Ouvrir » de Windows, filtrée sur les ZIP. */
  pickZip: async (): Promise<string | null> => {
    if (!inTauri) return "C:\\Users\\vous\\Downloads\\Analyse-Echecs-1.0.0-Windows-x64.zip";
    const r = await open({ multiple: false, directory: false, filters: [{ name: "Archive ZIP", extensions: ["zip"] }] });
    return typeof r === "string" ? r : null;
  },
  image: (id: string, kind: "icon" | "image") => call<string | null>("get_image", { id, kind }),
  minimizeWindow: () => call<void>("minimize_window"),
  listBackups: (id: string) => call<BackupInfo[]>("list_backups", { id }),
  backup: (id: string) => call<BackupInfo>("backup_app", { id }),
  restoreBackup: (id: string, backupId: string) => call<void>("restore_backup", { id, backupId }),
  deleteBackup: (id: string, backupId: string) => call<void>("delete_backup", { id, backupId }),
  rollback: (id: string, restore: string | null) => call<void>("rollback", { id, restore }),
  setHold: (id: string, hold: boolean) => call<void>("set_hold", { id, hold }),
  openBackupsFolder: (id: string) => call<void>("open_backups_folder", { id }),
};

/** Raccourci global (Ctrl + Alt + Espace) : le launcher passe au premier plan et demande la palette. */
export async function onPaletteRequest(f: () => void): Promise<() => void> {
  if (!inTauri) return () => {};
  return listen("hangar://palette", () => f());
}

export async function subscribe(onEvent: (e: CoreEvent) => void): Promise<() => void> {
  if (!inTauri) return mockBackend.subscribe(onEvent);
  const a = await listen<CoreEvent>("hangar://changed", (e) => onEvent(e.payload));
  const b = await listen<CoreEvent>("hangar://progress", (e) => onEvent(e.payload));
  return () => {
    a();
    b();
  };
}

/** Les erreurs Rust arrivent sous forme d'ErrorInfo ; tout le reste est converti. */
export function toErrorInfo(e: unknown): ErrorInfo {
  if (e && typeof e === "object" && "message" in e) {
    const o = e as Partial<ErrorInfo>;
    return { code: o.code ?? "other", message: String(o.message), hint: o.hint ?? "Réessayez." };
  }
  return { code: "other", message: String(e), hint: "Réessayez." };
}
