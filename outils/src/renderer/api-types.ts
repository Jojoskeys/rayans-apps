import type { PowerMode, ToolId } from "../core/commands.ts";
import type { RecentFile, Suivi, SuiviAction } from "../core/suivi.ts";

export type PdfQuality = "legere" | "normale" | "originale";

export interface Settings {
  /** Raccourci global qui ouvre la barre de commande (format Electron, ex. « Control+Alt+Space »). */
  shortcut: string;
  startWithWindows: boolean;
  closeToTray: boolean;
  pdfQuality: PdfQuality;
  imgTarget: number;
}

export interface Power { mode: PowerMode; at: number }

export interface ShareInfo { url: string; files: { name: string; size: number }[]; received: string[]; expiresAt: number; inbox: string }

export interface State {
  settings: Settings;
  power: Power | null;
  lastText: { texte: string; at: number } | null;
  share: (ShareInfo & { qr: string }) | null;
  version: string;
  dataDir: string;
  shortcutOk: boolean;
  /** Échéances, liens à lire, entretien, textes à coller. */
  suivi: Suivi;
  now: number;
}

export interface Goto { tool: ToolId; targetKo?: number | null; text?: string | null; message?: string }

export interface RunResult { ok: boolean; message?: string; close?: boolean }

export interface Output { id: string; nom: string; parDefaut: boolean }
export interface WifiInfo { connecte: boolean; ssid: string | null; securite: string | null; cle: string | null; qr: string | null }

export interface OutilsApi {
  getState(): Promise<State>;
  onState(cb: (s: State) => void): () => void;
  onGoto(cb: (g: Goto) => void): () => void;
  updateSettings(patch: Partial<Settings>): Promise<State>;
  run(text: string): Promise<RunResult>;
  hidePalette(): void;
  pathOf(file: File): string;
  pickFiles(kind: "pdf" | "image" | "tout", multiple: boolean): Promise<string[]>;
  mergePdf(files: string[], quality: PdfQuality): Promise<{ out: string; pages: number; bytes: number } | null>;
  compressImage(file: string, targetKo: number): Promise<{ out: string; bytes: number; before: number; width: number; height: number; ok: boolean }>;
  shareStart(files: string[]): Promise<void>;
  shareStop(): Promise<void>;
  qr(text: string): Promise<string>;
  wifi(): Promise<WifiInfo>;
  outputs(): Promise<Output[]>;
  setOutput(id: string): Promise<Output[]>;
  captureText(): Promise<void>;
  schedulePower(mode: PowerMode, minutes: number): Promise<void>;
  cancelPower(): Promise<void>;
  showInFolder(p: string): void;
  openPath(p: string): void;
  copy(text: string): void;
  quit(): void;
  suivi(a: SuiviAction): Promise<State>;
  recents(): Promise<RecentFile[]>;
  exportIcs(): Promise<string | null>;
  openUrl(url: string): void;
  // Fenêtre de sélection (capture d'écran pour l'OCR)
  onCaptureImage(cb: (dataUrl: string) => void): () => void;
  captureDone(rect: { x: number; y: number; width: number; height: number } | null): void;
}

declare global {
  interface Window { outils: OutilsApi }
}
