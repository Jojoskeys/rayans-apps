// Pont vers la couche Rust (src-tauri/src/lib.rs). Toute la logique de fichiers est côté Rust.
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import { open as tauriOpen } from "@tauri-apps/plugin-dialog";
import { mockInvoke } from "./mock";

// Hors de Tauri (`npm run dev:ui` dans un navigateur) : faux backend en mémoire.
const inTauri = "__TAURI_INTERNALS__" in window;
const invoke = <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
  inTauri ? tauriInvoke<T>(cmd, args) : (mockInvoke(cmd, args) as Promise<T>);
const listen: typeof tauriListen = inTauri ? tauriListen : async () => () => {};
const open: typeof tauriOpen = inTauri ? tauriOpen : (async () => null) as unknown as typeof tauriOpen;

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  extensions: string[];
  namePattern: string;
  olderThanDays: number | null;
  minSize: number | null;
  maxSize: number | null;
  folders: string[];
  target: string;
}

export interface Config {
  watched: string[];
  rules: Rule[];
  duplicates: boolean;
  quarantineDir: string;
  ignoreRecentMinutes: number;
  auto: { enabled: boolean; mode: "surveillance" | "intervalle"; intervalMinutes: number };
}

export type OpKind = "ranger" | "doublon";

export interface PlanItem {
  id: number;
  kind: OpKind;
  source: string;
  destination: string;
  renamed: boolean;
  reason: string;
  size: number;
  modifiedMs: number;
  duplicateOf: string | null;
}

export interface Plan {
  id: string;
  createdMs: number;
  scanned: number;
  items: PlanItem[];
  skipped: { path: string; reason: string }[];
}

export interface Moved {
  id: number;
  source: string;
  destination: string;
  renamed: boolean;
}
export interface Failed {
  id: number;
  path: string;
  reason: string;
}
export interface ApplyReport {
  batch: string | null;
  moved: Moved[];
  failed: Failed[];
}
export interface UndoReport {
  restored: Moved[];
  failed: Failed[];
}

export interface OpView {
  op: number;
  kind: OpKind;
  reason: string;
  from: string;
  to: string;
  state: "fait" | "annule" | "incertain";
  restoredTo: string | null;
}
export interface BatchView {
  id: string;
  date: string;
  origin: string;
  ops: OpView[];
}

export interface StateView {
  config: Config;
  dataDir: string;
  version: string;
  autoPlan: Plan | null;
  autoStatus: string;
}

export const api = {
  getState: () => invoke<StateView>("get_state"),
  saveConfig: (config: Config) => invoke<Config>("save_config", { config }),
  rulesByDefault: () => invoke<Rule[]>("rules_by_default"),
  analyze: () => invoke<Plan>("analyze"),
  apply: (planId: string, ids: number[]) => invoke<ApplyReport>("apply", { planId, ids }),
  dismissAutoPlan: () => invoke<void>("dismiss_auto_plan"),
  history: () => invoke<BatchView[]>("history"),
  undo: (batch: string, ops: number[] | null) => invoke<UndoReport>("undo_batch", { batch, ops }),
  reveal: (path: string) => invoke<void>("reveal", { path }),
  openFolder: (path: string) => invoke<void>("open_folder", { path }),
  ready: () => invoke<void>("frontend_ready"),
  pickFolder: async (title: string): Promise<string | null> => {
    const r = await open({ directory: true, multiple: false, title });
    return typeof r === "string" ? r : null;
  },
  onAutoPlan: (cb: (count: number) => void) => listen<number>("plan-automatique", (e) => cb(e.payload)),
};

export function errorText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return String(e);
}
