// Routine : ce que Rayan veut faire chaque jour (ou certains jours), à cocher dans la vue du jour, avec un rappel
// Windows à l'heure choisie tant que ce n'est pas fait. Fonctions pures : l'heure et les données sont passées en paramètre.

import { todayISO } from "./counts.ts";

export interface RoutineItem {
  id: string;
  title: string;
  /** Heure du rappel « HH:MM », ou "" pour une tâche sans rappel. */
  time: string;
  /** Jours de la semaine concernés (0 = dimanche … 6 = samedi). */
  days: number[];
  created: number;
}

export interface RoutineData {
  items: RoutineItem[];
  /** Tâches faites, par jour (« 2026-11-17 » → identifiants). Gardé 60 jours, pour la série. */
  done: Record<string, string[]>;
  /** Rappels déjà envoyés aujourd'hui (« 2026-11-17|id »), pour n'en envoyer qu'un par tâche et par jour. */
  sent: string[];
}

export const EMPTY_ROUTINE: RoutineData = { items: [], done: {}, sent: [] };
export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LABELS: Record<number, string> = { 1: "L", 2: "M", 3: "M", 4: "J", 5: "V", 6: "S", 0: "D" };
const KEEP_DAYS = 60;
/** Un rappel manqué (ordinateur éteint) part encore jusqu'à 2 h après l'heure prévue. */
const LATE_WINDOW = 2 * 3_600_000;

const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const minutesOf = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);

export function sanitizeRoutine(raw: unknown): RoutineData {
  const r = (raw ?? {}) as Partial<RoutineData>;
  const items = Array.isArray(r.items) ? r.items.filter((x) => x && typeof x.id === "string" && typeof x.title === "string").map((x) => ({
    id: x.id, title: x.title.slice(0, 200), time: typeof x.time === "string" && validTime(x.time) ? x.time : "",
    days: Array.isArray(x.days) ? [...new Set(x.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : ALL_DAYS,
    created: Number.isFinite(x.created) ? x.created : 0,
  })) : [];
  const done: Record<string, string[]> = {};
  if (r.done && typeof r.done === "object") for (const [k, v] of Object.entries(r.done)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(v)) done[k] = v.filter((x) => typeof x === "string");
  return { items, done, sent: Array.isArray(r.sent) ? r.sent.filter((x) => typeof x === "string") : [] };
}

/** Tâches prévues ce jour-là, triées par heure (les tâches sans heure à la fin). */
export function itemsForDay(d: RoutineData, now: number): RoutineItem[] {
  const wd = new Date(now).getDay();
  return d.items.filter((i) => i.days.includes(wd)).sort((a, b) => (a.time || "99") .localeCompare(b.time || "99") || a.created - b.created);
}

export function isDone(d: RoutineData, id: string, now: number): boolean {
  return (d.done[todayISO(now)] ?? []).includes(id);
}

export function toggleDone(d: RoutineData, id: string, now: number): RoutineData {
  const day = todayISO(now);
  const cur = new Set(d.done[day] ?? []);
  if (cur.has(id)) cur.delete(id); else cur.add(id);
  return prune({ ...d, done: { ...d.done, [day]: [...cur] } }, now);
}

export function addItem(d: RoutineData, title: string, time: string, days: number[], now: number): RoutineData {
  const t = title.trim();
  if (!t) throw new Error("donne un nom à la tâche");
  if (time && !validTime(time)) throw new Error("heure invalide");
  if (!days.length) throw new Error("choisis au moins un jour");
  const item: RoutineItem = { id: `r${now.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, title: t.slice(0, 200), time, days: [...new Set(days)], created: now };
  return { ...d, items: [...d.items, item] };
}

export function updateItem(d: RoutineData, id: string, patch: Partial<Pick<RoutineItem, "title" | "time" | "days">>): RoutineData {
  if (patch.time && !validTime(patch.time)) throw new Error("heure invalide");
  if (patch.title !== undefined && !patch.title.trim()) throw new Error("donne un nom à la tâche");
  if (patch.days && !patch.days.length) throw new Error("choisis au moins un jour");
  return { ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch, title: (patch.title ?? i.title).trim() } : i)) };
}

export function removeItem(d: RoutineData, id: string): RoutineData {
  return { ...d, items: d.items.filter((i) => i.id !== id) };
}

/**
 * Rappels à envoyer maintenant : tâches du jour avec une heure passée depuis moins de 2 h, pas encore faites, pas
 * encore rappelées aujourd'hui. Renvoie les tâches et les données avec ces rappels notés comme envoyés.
 */
export function dueReminders(d: RoutineData, now: number): { items: RoutineItem[]; data: RoutineData } {
  const day = todayISO(now);
  const date = new Date(now);
  const nowMin = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const sent = new Set(d.sent.filter((k) => k.startsWith(`${day}|`)));
  const items = itemsForDay(d, now).filter((i) => {
    if (!i.time || isDone(d, i.id, now) || sent.has(`${day}|${i.id}`)) return false;
    const late = (nowMin - minutesOf(i.time)) * 60_000;
    return late >= 0 && late < LATE_WINDOW;
  });
  for (const i of items) sent.add(`${day}|${i.id}`);
  return { items, data: { ...d, sent: [...sent] } };
}

/** Jours d'affilée (jusqu'à hier, plus aujourd'hui si tout est fait) où toutes les tâches prévues ont été faites. */
export function streak(d: RoutineData, now: number): number {
  let n = 0;
  const base = new Date(now);
  const todayAll = itemsForDay(d, now);
  const todayComplete = todayAll.length > 0 && todayAll.every((i) => isDone(d, i.id, now));
  for (let k = 1; k <= KEEP_DAYS; k++) {
    const t = new Date(base.getFullYear(), base.getMonth(), base.getDate() - k, 12).getTime();
    const planned = itemsForDay(d, t).filter((i) => i.created <= t + 12 * 3_600_000);
    if (!planned.length) { if (k > 7 && n === 0) break; continue; }
    const doneSet = new Set(d.done[todayISO(t)] ?? []);
    if (planned.every((i) => doneSet.has(i.id))) n++; else break;
  }
  return n + (todayComplete ? 1 : 0);
}

function prune(d: RoutineData, now: number): RoutineData {
  const limit = todayISO(now - KEEP_DAYS * 86_400_000);
  const done: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(d.done)) if (k >= limit && v.length) done[k] = v;
  return { ...d, done, sent: d.sent.filter((k) => k.startsWith(todayISO(now))) };
}
