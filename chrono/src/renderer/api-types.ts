import type { Action, AppData, Phase } from "../core/types.ts";

export interface InitialState {
  data: AppData;
  version: string;
  dataDir: string;
  warning: string | null;
}

export type Signal =
  | { type: "son"; to: Phase }
  | { type: "message"; text: string };

export interface ExportRequest {
  /** Période [from, to[ ; absente = tout. */
  from?: number;
  to?: number;
  /** Nom de fichier proposé, sans extension. */
  name: string;
}

export type Command = "mini" | "principal" | "masquer-mini" | "quitter" | "ouvrir-dossier";

export interface ChronoApi {
  getState(): Promise<InitialState>;
  dispatch(action: Action): Promise<void>;
  onState(cb: (data: AppData) => void): () => void;
  onSignal(cb: (s: Signal) => void): () => void;
  /** Chemin du fichier écrit, ou null si l'utilisateur a annulé. */
  exportCsv(req: ExportRequest): Promise<string | null>;
  command(cmd: Command): Promise<void>;
}

declare global {
  interface Window {
    chrono: ChronoApi;
  }
}
