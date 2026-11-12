// Pont vers la couche Rust. Hors de Tauri (simple `npm run dev:ui` dans un navigateur), un faux
// backend en mémoire permet de voir tous les états de l'interface.
import { invoke } from "@tauri-apps/api/core";
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
  lastError: ErrorInfo | null;
  dataDir: string;
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
  image: (id: string, kind: "icon" | "image") => call<string | null>("get_image", { id, kind }),
};

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
