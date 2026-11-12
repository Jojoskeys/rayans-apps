// Export CSV pensé pour Excel en français : séparateur « ; », décimales avec virgule, UTF-8 avec BOM.
import type { AppData, Entry } from "./types.ts";
import { dayKey, formatTime, overlap } from "./summary.ts";

const SOURCE: Record<Entry["source"], string> = { pomodoro: "Pomodoro", chrono: "Chrono", manuel: "Saisie manuelle" };

export function csvCell(v: string): string {
  // Neutralise les formules (=, +, -, @) qu'Excel exécuterait à l'ouverture.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function hhmm(ms: number): string {
  const min = Math.round(ms / 60_000);
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}

/** Une ligne par entrée (coupée à la période [from, to[ si elle la déborde). */
export function entriesCsv(d: AppData, from = -Infinity, to = Infinity): string {
  const header = ["Date", "Début", "Fin", "Durée (min)", "Durée (h:mm)", "Projet", "Tâche", "Source", "Note"];
  const proj = new Map(d.projects.map((p) => [p.id, p.name]));
  const task = new Map(d.tasks.map((t) => [t.id, t.name]));
  const rows = d.entries
    .filter((e) => e.end > from && e.start < to)
    .sort((a, b) => a.start - b.start)
    .map((e) => {
      const start = Math.max(e.start, from);
      const end = Math.min(e.end, to);
      const ms = overlap(e, from, to);
      return [
        dayKey(start), formatTime(start), formatTime(end),
        (ms / 60_000).toFixed(1).replace(".", ","), hhmm(ms),
        proj.get(e.projectId) ?? "", e.taskId ? task.get(e.taskId) ?? "" : "", SOURCE[e.source], e.note,
      ];
    });
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
