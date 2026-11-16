// Routine (processus principal) : fichier routine.json, rappels Windows vérifiés chaque minute, actions de la fenêtre.
import { ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { todayISO } from "../core/counts.ts";
import { addItem, dueReminders, EMPTY_ROUTINE, isDone, itemsForDay, removeItem, sanitizeRoutine, streak, toggleDone, updateItem, type RoutineData } from "../core/routine.ts";
import type { RoutineView } from "../renderer/api-types.ts";

interface Ctx {
  dataDir: string;
  clock: () => number;
  notify: (title: string, body: string) => void;
  changed: () => void;
}

let ctx: Ctx;
let data: RoutineData = { ...EMPTY_ROUTINE };
const file = () => path.join(ctx.dataDir, "routine.json");

function load() {
  try { data = sanitizeRoutine(JSON.parse(fs.readFileSync(file(), "utf8"))); } catch { data = { ...EMPTY_ROUTINE, done: {}, sent: [] }; }
}
function save() {
  fs.mkdirSync(ctx.dataDir, { recursive: true });
  const tmp = `${file()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file());
}
function commit(next: RoutineData) {
  data = next;
  try { save(); } catch (e) { console.error(e); }
  ctx.changed();
}

/** Appelé chaque minute : envoie les rappels de l'heure. */
export function checkRoutine() {
  const now = ctx.clock();
  const { items, data: next } = dueReminders(data, now);
  if (!items.length) return;
  commit(next);
  for (const i of items) ctx.notify(`Rappel : ${i.title}`, `Prévu à ${i.time.replace(":", " h ")}. Coche-le dans Rayan's Aujourd'hui quand c'est fait.`);
}

export function routineView(): RoutineView {
  const now = ctx.clock();
  const today = itemsForDay(data, now);
  return {
    items: data.items,
    today: today.map((i) => ({ ...i, done: isDone(data, i.id, now) })),
    streak: streak(data, now),
    day: todayISO(now),
  };
}

export function setupRoutine(c: Ctx) {
  ctx = c;
  load();
  const h = <A extends unknown[]>(name: string, fn: (...a: A) => RoutineData) =>
    ipcMain.handle(name, (_e, ...a: unknown[]) => { commit(fn(...(a as A))); return routineView(); });
  h("routine-ajouter", (title: string, time: string, days: number[]) => addItem(data, String(title ?? ""), String(time ?? ""), Array.isArray(days) ? days : [], ctx.clock()));
  h("routine-modifier", (id: string, patch: { title?: string; time?: string; days?: number[] }) => updateItem(data, String(id), patch ?? {}));
  h("routine-supprimer", (id: string) => removeItem(data, String(id)));
  h("routine-cocher", (id: string) => toggleDone(data, String(id), ctx.clock()));
}

export const routineInternals = { get data() { return data; }, file };

/** Pour la synchronisation avec l'iPhone : texte actuel, et remplacement par la version fusionnée. */
export const routineText = () => JSON.stringify(data);
export function applyRoutineText(text: string) { commit(sanitizeRoutine(JSON.parse(text))); }
