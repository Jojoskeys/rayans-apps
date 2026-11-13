import type { AppData, RunResult, Settings } from "../core/backup.ts";

export interface Progress { index: number; total: number; label: string }

export interface State {
  data: AppData;
  progress: Progress | null;
  version: string;
  dataDir: string;
  now: number;
  /** Le dossier de destination est accessible (disque branché). */
  destinationOk: boolean;
  /** Chaque source existe-t-elle sur cet ordinateur ? */
  exists: Record<string, boolean>;
  oneDrive: string | null;
}

export interface SauveApi {
  getState(): Promise<State>;
  onState(cb: (s: State) => void): () => void;
  updateSettings(p: Partial<Settings>): Promise<State>;
  backup(): Promise<RunResult>;
  cancel(): Promise<void>;
  pickDestination(): Promise<string | null>;
  pickSources(): Promise<string[]>;
  open(p: string): void;
  quit(): void;
}

declare global {
  interface Window { sauve: SauveApi }
}
