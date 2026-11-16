import type { SourceCount, SourceId } from "../core/counts.ts";
import type { CourseChange } from "../core/ics.ts";
import type { Deadline, DisplayCourse, SharedMail } from "../core/fac.ts";
import type { RoutineItem } from "../core/routine.ts";

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
