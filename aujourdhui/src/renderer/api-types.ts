import type { SourceCount, SourceId } from "../core/counts.ts";
import type { CourseChange } from "../core/ics.ts";
import type { Deadline, DisplayCourse, SharedMail } from "../core/fac.ts";
import type { RoutineItem } from "../core/routine.ts";

/** Synchronisation avec l'iPhone (Rayan's Mobile) par un dépôt GitHub privé. */
export interface SyncView {
  configured: boolean;
  repo: string;
  state: "inactif" | "en-cours" | "a-jour" | "erreur";
  message: string;
  lastSync: number;
  details: { name: string; result: string }[];
}

/** Routine : tâches de chaque jour, à cocher, avec rappel. */
export interface RoutineView {
  items: RoutineItem[];
  today: (RoutineItem & { done: boolean })[];
  streak: number;
  day: string;
}

/** Fac : emploi du temps ADE et mails partagés, tels qu'affichés. */
export interface FacView {
  configured: boolean;
  /** Adresse ADE raccourcie (elle donne accès au planning sans connexion). */
  url: string;
  lastFetch: number;
  lastError: string | null;
  fetching: boolean;
  courses: DisplayCourse[];
  removed: CourseChange[];
  mails: SharedMail[];
  deadlines: Deadline[];
  allowedSenders: string[];
  groups: string[];
  availableGroups: { name: string; count: number }[];
  webmail: string;
}

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
  fac: FacView;
  routine: RoutineView;
  sync?: SyncView;
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
  sync?: {
    configure(repo: string, token: string): Promise<SyncView>;
    now(): Promise<SyncView>;
    forget(): Promise<SyncView>;
  };
  routine: {
    add(title: string, time: string, days: number[]): Promise<RoutineView>;
    update(id: string, patch: { title?: string; time?: string; days?: number[] }): Promise<RoutineView>;
    remove(id: string): Promise<RoutineView>;
    toggle(id: string): Promise<RoutineView>;
  };
  fac: {
    setUrl(url: string): Promise<FacView>;
    refresh(): Promise<FacView>;
    addMail(text: string): Promise<FacView>;
    accept(mailId: string, id: string): Promise<FacView>;
    ignore(mailId: string, id: string): Promise<FacView>;
    undoCorrection(courseUid: string): Promise<FacView>;
    resolveConflict(courseUid: string, keep: "ade" | "mail"): Promise<FacView>;
    removeDeadline(id: string): Promise<FacView>;
    removeMail(id: string): Promise<FacView>;
    setSenders(list: string[]): Promise<FacView>;
    setGroups(list: string[]): Promise<FacView>;
    forget(): Promise<FacView>;
    openWebmail(subject: string): Promise<void>;
  };
}

declare global {
  interface Window { aujourdhui: AujourdhuiApi }
}
