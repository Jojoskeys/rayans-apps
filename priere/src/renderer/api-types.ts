import type { AppData, Settings } from "../core/settings.ts";

export type Command =
  | { type: "quitter" }
  | { type: "ouvrir-dossier" }
  | { type: "tester-notification" }
  | { type: "pause"; minutes: number | null };

export interface InitialState { data: AppData; version: string; dataDir: string; warning: string | null }

export interface PriereApi {
  getState(): Promise<InitialState>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  onState(cb: (d: AppData) => void): () => void;
  command(cmd: Command): Promise<boolean>;
}

declare global {
  interface Window { priere: PriereApi }
}
