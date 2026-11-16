// Pont vers le processus principal (voir src/main/preload.cjs).
export interface AudioProgress {
  done: number;
  total: number;
  failed: number;
}

export interface HifzApi {
  loadData(): Promise<unknown>;
  saveData(json: string): Promise<boolean>;
  exportData(json: string): Promise<boolean>;
  importData(): Promise<unknown>;
  cachedAudio(names: string[]): Promise<string[]>;
  downloadAudio(names: string[]): Promise<{ ok: number; failed: number }>;
  audioInfo(): Promise<{ files: number; bytes: number; dir: string }>;
  clearAudio(): Promise<boolean>;
  onAudioProgress(cb: (p: AudioProgress) => void): () => void;
  info(): Promise<{ version: string; dataFile: string; packaged: boolean; test: boolean; demo: boolean }>;
  onSmokeGo(cb: (v: unknown) => void): void;
  openLink(url: string): Promise<void>;
  openDataFolder(): Promise<string>;
  smokeReport(r: Record<string, unknown>): void;
}

declare global {
  interface Window {
    hifz: HifzApi;
  }
}

export const api = (): HifzApi => window.hifz;

/** Version web (Rayan's Mobile sur iPhone) : fichiers servis à côté de la page, audio lu directement en ligne. */
const web = (): boolean => typeof window !== 'undefined' && (window as unknown as { HIFZ_WEB?: boolean }).HIFZ_WEB === true;
export const appUrl = (path: string): string => (web() ? path : `hifz://app/${path}`);
export const audioUrl = (name: string): string => (web() ? `https://everyayah.com/data/Husary_128kbps/${name}` : `hifz://audio/${name}`);
