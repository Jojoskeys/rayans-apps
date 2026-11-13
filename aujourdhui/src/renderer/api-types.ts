import type { SourceCount, SourceId } from "../core/counts.ts";

export interface Settings {
  reminder: boolean;
  reminderHour: number;
  reminderMinute: number;
  startWithWindows: boolean;
  closeToTray: boolean;
}

export interface State {
  settings: Settings;
  counts: SourceCount[];
  updatedAt: number;
  version: string;
  dataDir: string;
  paths: Record<SourceId, string>;
  today: string;
}

export interface AujourdhuiApi {
  getState(): Promise<State>;
  onState(cb: (s: State) => void): () => void;
  refresh(): Promise<State>;
  updateSettings(p: Partial<Settings>): Promise<State>;
  openApp(id: SourceId): Promise<void>;
  testNotification(): Promise<boolean>;
  openFolder(p: string): void;
  quit(): void;
}

declare global {
  interface Window { aujourdhui: AujourdhuiApi }
}
