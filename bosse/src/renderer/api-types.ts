import type { AppData, Item, ItemKind } from "../core/model.ts";

export type PickKind = "dossier" | "fichier" | "app";

export interface InitialState {
  data: AppData;
  version: string;
  dataDir: string;
  warning: string | null;
  /** Applications installées par Rayan's Launcher. */
  apps: { id: string; name: string }[];
  chronoInstalled: boolean;
  powertoys: { installed: boolean; workspaces: { id: string; name: string }[] };
}

export interface LaunchReport { name: string; results: { label: string; ok: boolean; error?: string }[] }

export interface BosseApi {
  getState(): Promise<InitialState>;
  onState(cb: (s: InitialState) => void): () => void;
  onMessage(cb: (m: string) => void): () => void;
  save(data: AppData): Promise<InitialState>;
  openWorkspace(id: string): Promise<LaunchReport>;
  testItem(item: Item): Promise<void>;
  pick(kind: PickKind): Promise<string[]>;
  inspect(paths: string[]): Promise<{ path: string; kind: ItemKind }[]>;
  pathOf(file: File): string;
  openDataDir(): void;
  quit(): void;
}

declare global {
  interface Window { bosse: BosseApi }
}
