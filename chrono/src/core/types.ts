// Modèle de données de Rayan's Chrono. Tout est enregistré dans un seul fichier JSON local (chrono.json).

export type Phase = "travail" | "pause" | "longue";
export type Mode = "pomodoro" | "chrono";
export type Status = "arret" | "marche" | "pause";

export interface Project {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  createdAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  done: boolean;
  createdAt: number;
}

/** Une plage de temps enregistrée (horodatages en millisecondes). */
export interface Entry {
  id: string;
  projectId: string;
  taskId: string | null;
  start: number;
  end: number;
  source: "pomodoro" | "chrono" | "manuel";
  note: string;
}

export interface Settings {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  /** Une longue pause après ce nombre de pomodoros de travail. */
  longEvery: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  sound: boolean;
  /** 0 à 100. */
  volume: number;
  notifications: boolean;
  miniOnTop: boolean;
  closeToTray: boolean;
}

export interface Timer {
  mode: Mode;
  phase: Phase;
  status: Status;
  /** Fin prévue de la phase Pomodoro en cours (status « marche »). */
  endsAt: number | null;
  /** Temps restant de la phase Pomodoro quand elle n'est pas en marche. */
  remainingMs: number;
  /** Pomodoros de travail terminés depuis la dernière longue pause. */
  cycle: number;
  /** Pomodoros de travail terminés au total (statistique). */
  completed: number;
  /** Début du segment de travail en cours, enregistré au prochain arrêt. */
  segmentStart: number | null;
}

export interface Selection {
  projectId: string;
  taskId: string | null;
}

export interface UiPrefs {
  miniX: number | null;
  miniY: number | null;
}

export interface AppData {
  schemaVersion: 1;
  projects: Project[];
  tasks: Task[];
  entries: Entry[];
  settings: Settings;
  timer: Timer;
  selection: Selection;
  ui: UiPrefs;
}

export type Action =
  | { type: "start" }
  | { type: "pause" }
  | { type: "toggle" }
  | { type: "reset" }
  | { type: "skip" }
  | { type: "tick" }
  | { type: "setMode"; mode: Mode }
  | { type: "select"; projectId: string; taskId: string | null }
  | { type: "addProject"; name: string; color?: string }
  | { type: "updateProject"; id: string; name?: string; color?: string; archived?: boolean }
  | { type: "deleteProject"; id: string }
  | { type: "addTask"; projectId: string; name: string }
  | { type: "updateTask"; id: string; name?: string; done?: boolean }
  | { type: "deleteTask"; id: string }
  | { type: "addEntry"; projectId: string; taskId: string | null; start: number; end: number; note?: string }
  | { type: "updateEntry"; id: string; projectId?: string; taskId?: string | null; start?: number; end?: number; note?: string }
  | { type: "deleteEntry"; id: string }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "miniPosition"; x: number; y: number };

export type ChronoEvent =
  | { type: "phaseEnd"; from: Phase; to: Phase; autoStarted: boolean }
  | { type: "entryLogged"; entry: Entry };

export interface Ctx {
  now: number;
  newId: () => string;
}
