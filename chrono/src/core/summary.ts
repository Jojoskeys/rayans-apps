// Totaux par jour, par semaine, par projet et par tâche (heure locale ; semaines du lundi au dimanche).
import type { AppData, Entry } from "./types.ts";

export const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Minuit du jour suivant (gère les changements d'heure : les jours ne font pas toujours 24 h). */
export function addDays(dayStart: number, n: number): number {
  const d = new Date(dayStart);
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfWeek(t: number): number {
  const d = new Date(startOfDay(t));
  const offset = (d.getDay() + 6) % 7; // lundi = 0
  return addDays(d.getTime(), -offset);
}

export function dayKey(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dayLabel(t: number): string {
  const d = new Date(t);
  return `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function weekLabel(weekStart: number): string {
  const end = addDays(weekStart, 6);
  const a = new Date(weekStart);
  const b = new Date(end);
  const left = a.getMonth() === b.getMonth() ? `${a.getDate()}` : `${a.getDate()} ${MONTHS[a.getMonth()]}`;
  return `Semaine du ${left} au ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

/** Durée d'une entrée comprise dans [from, to[. */
export function overlap(e: Entry, from: number, to: number): number {
  return Math.max(0, Math.min(e.end, to) - Math.max(e.start, from));
}

export interface TaskTotal { taskId: string | null; name: string; ms: number }
export interface ProjectTotal { projectId: string; name: string; color: string; ms: number; tasks: TaskTotal[] }
export interface DayTotal { start: number; key: string; ms: number; byProject: Record<string, number> }
export interface Summary { from: number; to: number; ms: number; projects: ProjectTotal[]; days: DayTotal[] }

/** Résumé de la période [from, to[ ; `extra` ajoute par exemple le segment en cours. */
export function summarize(d: AppData, from: number, to: number, extra: Entry[] = []): Summary {
  const entries = [...d.entries, ...extra].filter((e) => e.end > from && e.start < to);
  const projects = new Map<string, ProjectTotal>();
  const taskName = new Map(d.tasks.map((t) => [t.id, t.name]));
  for (const e of entries) {
    const ms = overlap(e, from, to);
    if (ms <= 0) continue;
    const proj = d.projects.find((p) => p.id === e.projectId);
    if (!proj) continue;
    let pt = projects.get(proj.id);
    if (!pt) { pt = { projectId: proj.id, name: proj.name, color: proj.color, ms: 0, tasks: [] }; projects.set(proj.id, pt); }
    pt.ms += ms;
    const tid = e.taskId && taskName.has(e.taskId) ? e.taskId : null;
    let tt = pt.tasks.find((x) => x.taskId === tid);
    if (!tt) { tt = { taskId: tid, name: tid ? taskName.get(tid)! : "Sans tâche", ms: 0 }; pt.tasks.push(tt); }
    tt.ms += ms;
  }
  const list = [...projects.values()].sort((a, b) => b.ms - a.ms);
  for (const p of list) p.tasks.sort((a, b) => b.ms - a.ms);

  const days: DayTotal[] = [];
  for (let s = startOfDay(from); s < to; s = addDays(s, 1)) {
    const e = Math.min(addDays(s, 1), to);
    const day: DayTotal = { start: s, key: dayKey(s), ms: 0, byProject: {} };
    for (const en of entries) {
      const ms = overlap(en, Math.max(s, from), e);
      if (ms <= 0 || !projects.has(en.projectId)) continue;
      day.ms += ms;
      day.byProject[en.projectId] = (day.byProject[en.projectId] ?? 0) + ms;
    }
    days.push(day);
  }
  return { from, to, ms: list.reduce((n, p) => n + p.ms, 0), projects: list, days };
}

/** « 1 h 05 », « 25 min », « 0 min ». */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/** Compte à rebours « 24:59 » ou « 1:02:03 ». */
export function formatClock(ms: number, roundUp = true): string {
  const total = roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatTime(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
