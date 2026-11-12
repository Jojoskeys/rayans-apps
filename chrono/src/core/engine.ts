// Moteur de Rayan's Chrono : une fonction pure (état, action, instant) -> (nouvel état, événements).
// Le processus principal d'Electron est le seul à l'appeler ; les fenêtres ne font qu'afficher l'état.
import type { Action, AppData, ChronoEvent, Ctx, Entry, Phase, Project, Settings, Timer } from "./types.ts";

export const MIN_ENTRY_MS = 1000;
/** Au-delà de ce retard (veille de l'ordinateur), la phase suivante n'est pas démarrée automatiquement. */
export const OVERDUE_MS = 60_000;

export const PALETTE = ["#E8594F", "#3BA776", "#4F7CE8", "#E8A93B", "#9B5DE5", "#2EB5C9", "#D9488F", "#7A8B99"];

export const DEFAULT_SETTINGS: Settings = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longEvery: 4,
  autoStartBreaks: true,
  autoStartWork: false,
  sound: true,
  volume: 70,
  notifications: true,
  miniOnTop: true,
  closeToTray: true,
};

export const PHASE_LABEL: Record<Phase, string> = { travail: "Travail", pause: "Pause", longue: "Longue pause" };

export function phaseMs(s: Settings, p: Phase): number {
  const min = p === "travail" ? s.workMin : p === "pause" ? s.shortBreakMin : s.longBreakMin;
  return Math.round(min * 60_000);
}

export function createData(ctx: Ctx): AppData {
  const project: Project = { id: ctx.newId(), name: "Général", color: PALETTE[0], archived: false, createdAt: ctx.now };
  return {
    schemaVersion: 1,
    projects: [project],
    tasks: [],
    entries: [],
    settings: { ...DEFAULT_SETTINGS },
    timer: idleTimer(DEFAULT_SETTINGS),
    selection: { projectId: project.id, taskId: null },
    ui: { miniX: null, miniY: null },
  };
}

function idleTimer(s: Settings): Timer {
  return {
    mode: "pomodoro", phase: "travail", status: "arret", endsAt: null,
    remainingMs: phaseMs(s, "travail"), cycle: 0, completed: 0, segmentStart: null,
  };
}

// ----- Lecture d'un fichier (tolérante) -------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function normalizeSettings(raw: unknown): Settings {
  const r = isObj(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  return {
    workMin: clamp(num(r.workMin, d.workMin), 1, 180),
    shortBreakMin: clamp(num(r.shortBreakMin, d.shortBreakMin), 1, 60),
    longBreakMin: clamp(num(r.longBreakMin, d.longBreakMin), 1, 120),
    longEvery: Math.round(clamp(num(r.longEvery, d.longEvery), 1, 12)),
    autoStartBreaks: bool(r.autoStartBreaks, d.autoStartBreaks),
    autoStartWork: bool(r.autoStartWork, d.autoStartWork),
    sound: bool(r.sound, d.sound),
    volume: clamp(num(r.volume, d.volume), 0, 100),
    notifications: bool(r.notifications, d.notifications),
    miniOnTop: bool(r.miniOnTop, d.miniOnTop),
    closeToTray: bool(r.closeToTray, d.closeToTray),
  };
}

/** Vérifie et complète des données lues sur le disque. Ce qui est invalide est écarté, jamais deviné. */
export function normalizeData(raw: unknown, ctx: Ctx): AppData {
  if (!isObj(raw)) return createData(ctx);
  const settings = normalizeSettings(raw.settings);
  const projects: Project[] = (Array.isArray(raw.projects) ? raw.projects : []).filter(isObj)
    .filter((p) => str(p.id) && str(p.name))
    .map((p, i) => ({
      id: str(p.id), name: str(p.name), color: /^#[0-9a-f]{6}$/i.test(str(p.color)) ? str(p.color) : PALETTE[i % PALETTE.length],
      archived: bool(p.archived, false), createdAt: num(p.createdAt, ctx.now),
    }));
  if (projects.length === 0) projects.push({ id: ctx.newId(), name: "Général", color: PALETTE[0], archived: false, createdAt: ctx.now });
  const pids = new Set(projects.map((p) => p.id));
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : []).filter(isObj)
    .filter((t) => str(t.id) && str(t.name) && pids.has(str(t.projectId)))
    .map((t) => ({ id: str(t.id), projectId: str(t.projectId), name: str(t.name), done: bool(t.done, false), createdAt: num(t.createdAt, ctx.now) }));
  const tids = new Map(tasks.map((t) => [t.id, t.projectId]));
  const entries: Entry[] = (Array.isArray(raw.entries) ? raw.entries : []).filter(isObj)
    .filter((e) => str(e.id) && pids.has(str(e.projectId)) && num(e.start, NaN) < num(e.end, NaN))
    .map((e) => {
      const taskId = typeof e.taskId === "string" && tids.get(e.taskId) === e.projectId ? e.taskId : null;
      const source = e.source === "pomodoro" || e.source === "chrono" || e.source === "manuel" ? e.source : "manuel";
      return { id: str(e.id), projectId: str(e.projectId), taskId, start: num(e.start, 0), end: num(e.end, 0), source, note: str(e.note) };
    });
  entries.sort((a, b) => a.start - b.start);

  const rt = isObj(raw.timer) ? raw.timer : {};
  const mode = rt.mode === "chrono" ? "chrono" : "pomodoro";
  const phase: Phase = rt.phase === "pause" || rt.phase === "longue" ? rt.phase : "travail";
  const status = rt.status === "marche" || rt.status === "pause" ? rt.status : "arret";
  const timer: Timer = {
    mode, phase, status,
    endsAt: status === "marche" && mode === "pomodoro" ? num(rt.endsAt, ctx.now) : null,
    remainingMs: clamp(num(rt.remainingMs, phaseMs(settings, phase)), 0, phaseMs(settings, phase)),
    cycle: Math.max(0, Math.round(num(rt.cycle, 0))),
    completed: Math.max(0, Math.round(num(rt.completed, 0))),
    segmentStart: typeof rt.segmentStart === "number" && rt.segmentStart <= ctx.now ? rt.segmentStart : null,
  };
  if (mode === "chrono" && status !== "marche") { timer.status = "arret"; timer.segmentStart = null; }
  if (mode === "chrono" && status === "marche" && timer.segmentStart === null) timer.status = "arret";

  const rs = isObj(raw.selection) ? raw.selection : {};
  let projectId = str(rs.projectId);
  if (!pids.has(projectId)) projectId = (projects.find((p) => !p.archived) ?? projects[0]).id;
  const taskId = typeof rs.taskId === "string" && tids.get(rs.taskId) === projectId ? rs.taskId : null;

  const ru = isObj(raw.ui) ? raw.ui : {};
  return {
    schemaVersion: 1, projects, tasks, entries, settings, timer,
    selection: { projectId, taskId },
    ui: { miniX: typeof ru.miniX === "number" ? ru.miniX : null, miniY: typeof ru.miniY === "number" ? ru.miniY : null },
  };
}

// ----- Lecture de l'état ------------------------------------------------------------------------

/** Temps restant de la phase Pomodoro (ms). */
export function remaining(t: Timer, now: number): number {
  if (t.mode !== "pomodoro") return 0;
  return t.status === "marche" && t.endsAt !== null ? Math.max(0, t.endsAt - now) : t.remainingMs;
}

/** Durée du segment de travail en cours, pas encore enregistré. */
export function segmentElapsed(t: Timer, now: number): number {
  return t.segmentStart !== null ? Math.max(0, now - t.segmentStart) : 0;
}

/** Le segment en cours, comme une entrée (pour les totaux en direct). */
export function liveEntry(d: AppData, now: number): Entry | null {
  const t = d.timer;
  if (t.segmentStart === null || now - t.segmentStart < 1) return null;
  return {
    id: "en-cours", projectId: d.selection.projectId, taskId: d.selection.taskId,
    start: t.segmentStart, end: now, source: t.mode, note: "",
  };
}

// ----- Réducteur -------------------------------------------------------------------------------

export interface Result {
  data: AppData;
  events: ChronoEvent[];
  /** Faut-il enregistrer sur le disque ? */
  changed: boolean;
}

export function reduce(data: AppData, action: Action, ctx: Ctx): Result {
  const d: AppData = structuredClone(data);
  const events: ChronoEvent[] = [];
  const changed = apply(d, action, ctx, events);
  return { data: changed ? d : data, events, changed };
}

function closeSegment(d: AppData, at: number, ctx: Ctx, events: ChronoEvent[]) {
  const t = d.timer;
  if (t.segmentStart === null) return;
  const start = t.segmentStart;
  t.segmentStart = null;
  if (at - start < MIN_ENTRY_MS) return;
  const entry: Entry = {
    id: ctx.newId(), projectId: d.selection.projectId, taskId: d.selection.taskId,
    start, end: at, source: t.mode, note: "",
  };
  d.entries.push(entry);
  events.push({ type: "entryLogged", entry });
}

function setPhase(d: AppData, phase: Phase) {
  d.timer.phase = phase;
  d.timer.remainingMs = phaseMs(d.settings, phase);
}

function startPomodoro(d: AppData, at: number) {
  const t = d.timer;
  if (t.remainingMs <= 0) t.remainingMs = phaseMs(d.settings, t.phase);
  t.status = "marche";
  t.endsAt = at + t.remainingMs;
  if (t.phase === "travail") t.segmentStart = at;
}

/** Fin (ou saut) de la phase Pomodoro en cours à l'instant `at`. */
function endPhase(d: AppData, at: number, ctx: Ctx, events: ChronoEvent[], natural: boolean) {
  const t = d.timer;
  const from = t.phase;
  if (from === "travail") {
    closeSegment(d, at, ctx, events);
    if (natural) { t.cycle += 1; t.completed += 1; }
  }
  let to: Phase;
  if (from === "travail") {
    if (natural && t.cycle >= d.settings.longEvery) { to = "longue"; t.cycle = 0; } else to = "pause";
  } else {
    if (from === "longue") t.cycle = 0;
    to = "travail";
  }
  const wasRunning = t.status === "marche";
  setPhase(d, to);
  t.status = "arret";
  t.endsAt = null;
  const auto = to === "travail" ? d.settings.autoStartWork : d.settings.autoStartBreaks;
  const overdue = natural && ctx.now - at > OVERDUE_MS;
  const autoStarted = wasRunning && auto && !overdue;
  if (autoStarted) startPomodoro(d, at);
  events.push({ type: "phaseEnd", from, to, autoStarted });
}

function apply(d: AppData, a: Action, ctx: Ctx, events: ChronoEvent[]): boolean {
  const t = d.timer;
  const now = ctx.now;
  switch (a.type) {
    case "tick": {
      let changed = false;
      // Plusieurs phases ont pu se terminer pendant une veille : on les rattrape une à une.
      for (let guard = 0; guard < 50 && t.mode === "pomodoro" && t.status === "marche" && t.endsAt !== null && t.endsAt <= now; guard++) {
        endPhase(d, t.endsAt, ctx, events, true);
        changed = true;
      }
      return changed;
    }
    case "start": {
      if (t.status === "marche") return false;
      if (!d.projects.some((p) => p.id === d.selection.projectId && !p.archived)) return false;
      if (t.mode === "pomodoro") startPomodoro(d, now);
      else { t.status = "marche"; t.segmentStart = now; }
      return true;
    }
    case "pause": {
      if (t.status !== "marche") return false;
      if (t.mode === "pomodoro") {
        t.remainingMs = remaining(t, now);
        t.endsAt = null;
        t.status = "pause";
        closeSegment(d, now, ctx, events);
      } else {
        closeSegment(d, now, ctx, events);
        t.status = "arret";
      }
      return true;
    }
    case "toggle":
      return apply(d, { type: t.status === "marche" ? "pause" : "start" }, ctx, events);
    case "reset": {
      closeSegment(d, now, ctx, events);
      t.status = "arret";
      t.endsAt = null;
      if (t.mode === "pomodoro") { setPhase(d, "travail"); t.cycle = 0; }
      return true;
    }
    case "skip": {
      if (t.mode !== "pomodoro") return false;
      endPhase(d, now, ctx, events, false);
      return true;
    }
    case "setMode": {
      if (a.mode === t.mode) return false;
      closeSegment(d, now, ctx, events);
      t.mode = a.mode;
      t.status = "arret";
      t.endsAt = null;
      if (a.mode === "pomodoro") setPhase(d, "travail");
      return true;
    }
    case "select": {
      const p = d.projects.find((x) => x.id === a.projectId);
      if (!p) return false;
      const taskId = a.taskId && d.tasks.some((x) => x.id === a.taskId && x.projectId === p.id) ? a.taskId : null;
      if (d.selection.projectId === p.id && d.selection.taskId === taskId) return false;
      // Le temps déjà passé reste attribué à l'ancienne sélection.
      const running = t.segmentStart !== null;
      closeSegment(d, now, ctx, events);
      d.selection = { projectId: p.id, taskId };
      if (running) t.segmentStart = now;
      return true;
    }
    case "addProject": {
      const name = a.name.trim();
      if (!name) return false;
      const used = new Set(d.projects.map((p) => p.color));
      const color = a.color ?? PALETTE.find((c) => !used.has(c)) ?? PALETTE[d.projects.length % PALETTE.length];
      const p: Project = { id: ctx.newId(), name, color, archived: false, createdAt: now };
      d.projects.push(p);
      return true;
    }
    case "updateProject": {
      const p = d.projects.find((x) => x.id === a.id);
      if (!p) return false;
      if (a.name !== undefined && a.name.trim()) p.name = a.name.trim();
      if (a.color !== undefined && /^#[0-9a-f]{6}$/i.test(a.color)) p.color = a.color;
      if (a.archived !== undefined) {
        if (a.archived && d.projects.filter((x) => !x.archived).length <= 1 && !p.archived) return false;
        p.archived = a.archived;
        if (p.archived && d.selection.projectId === p.id) reselect(d, ctx, events);
      }
      return true;
    }
    case "deleteProject": {
      if (!d.projects.some((x) => x.id === a.id) || d.projects.length <= 1) return false;
      if (d.selection.projectId === a.id) {
        // Le segment en cours appartient au projet supprimé : il n'est pas enregistré.
        t.segmentStart = null;
        if (t.status === "marche") { t.status = t.mode === "pomodoro" ? "pause" : "arret"; t.remainingMs = remaining(t, now); t.endsAt = null; }
      }
      d.projects = d.projects.filter((x) => x.id !== a.id);
      d.tasks = d.tasks.filter((x) => x.projectId !== a.id);
      d.entries = d.entries.filter((x) => x.projectId !== a.id);
      if (!d.projects.some((p) => !p.archived)) d.projects[0].archived = false;
      if (!d.projects.some((p) => p.id === d.selection.projectId)) reselect(d, ctx, events);
      return true;
    }
    case "addTask": {
      const name = a.name.trim();
      if (!name || !d.projects.some((p) => p.id === a.projectId)) return false;
      d.tasks.push({ id: ctx.newId(), projectId: a.projectId, name, done: false, createdAt: now });
      return true;
    }
    case "updateTask": {
      const task = d.tasks.find((x) => x.id === a.id);
      if (!task) return false;
      if (a.name !== undefined && a.name.trim()) task.name = a.name.trim();
      if (a.done !== undefined) task.done = a.done;
      return true;
    }
    case "deleteTask": {
      if (!d.tasks.some((x) => x.id === a.id)) return false;
      if (d.selection.taskId === a.id) {
        closeSegment(d, now, ctx, events);
        if (t.status === "marche") t.segmentStart = now;
        d.selection.taskId = null;
      }
      d.tasks = d.tasks.filter((x) => x.id !== a.id);
      // Le temps reste compté dans le projet, sans tâche.
      for (const e of d.entries) if (e.taskId === a.id) e.taskId = null;
      return true;
    }
    case "addEntry": {
      if (!d.projects.some((p) => p.id === a.projectId)) return false;
      if (!(a.end - a.start >= MIN_ENTRY_MS)) return false;
      const taskId = a.taskId && d.tasks.some((x) => x.id === a.taskId && x.projectId === a.projectId) ? a.taskId : null;
      const entry: Entry = { id: ctx.newId(), projectId: a.projectId, taskId, start: a.start, end: a.end, source: "manuel", note: (a.note ?? "").trim() };
      d.entries.push(entry);
      d.entries.sort((x, y) => x.start - y.start);
      return true;
    }
    case "updateEntry": {
      const e = d.entries.find((x) => x.id === a.id);
      if (!e) return false;
      const next = { ...e };
      if (a.projectId !== undefined) {
        if (!d.projects.some((p) => p.id === a.projectId)) return false;
        next.projectId = a.projectId;
      }
      if (a.taskId !== undefined) next.taskId = a.taskId;
      if (next.taskId && !d.tasks.some((x) => x.id === next.taskId && x.projectId === next.projectId)) next.taskId = null;
      if (a.start !== undefined) next.start = a.start;
      if (a.end !== undefined) next.end = a.end;
      if (a.note !== undefined) next.note = a.note.trim();
      if (!(next.end - next.start >= MIN_ENTRY_MS)) return false;
      Object.assign(e, next);
      d.entries.sort((x, y) => x.start - y.start);
      return true;
    }
    case "deleteEntry": {
      const before = d.entries.length;
      d.entries = d.entries.filter((x) => x.id !== a.id);
      return d.entries.length !== before;
    }
    case "settings": {
      const old = d.settings;
      d.settings = normalizeSettings({ ...old, ...a.patch });
      // Une phase arrêtée prend tout de suite la nouvelle durée ; une phase en cours garde la sienne.
      if (t.mode === "pomodoro" && t.status === "arret") t.remainingMs = phaseMs(d.settings, t.phase);
      if (t.mode === "pomodoro" && t.status === "pause") t.remainingMs = Math.min(t.remainingMs, phaseMs(d.settings, t.phase));
      return true;
    }
    case "miniPosition": {
      d.ui.miniX = Math.round(a.x);
      d.ui.miniY = Math.round(a.y);
      return true;
    }
  }
}

function reselect(d: AppData, ctx: Ctx, events: ChronoEvent[]) {
  const running = d.timer.segmentStart !== null;
  closeSegment(d, ctx.now, ctx, events);
  const p = d.projects.find((x) => !x.archived) ?? d.projects[0];
  d.selection = { projectId: p.id, taskId: null };
  if (running) d.timer.segmentStart = ctx.now;
}
