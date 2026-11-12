import { test } from "node:test";
import assert from "node:assert/strict";
import { createData } from "../src/core/engine.ts";
import { summarize, startOfWeek, startOfDay, addDays, formatDuration, formatClock, weekLabel, dayLabel } from "../src/core/summary.ts";
import { entriesCsv, csvCell } from "../src/core/csv.ts";
import type { AppData } from "../src/core/types.ts";

const MIN = 60_000;
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime(); // novembre 2026

function sample(): AppData {
  const d = createData({ now: at(9, 8), newId: () => "p0" });
  d.projects.push({ id: "p1", name: "Client ; A", color: "#3BA776", archived: false, createdAt: 0 });
  d.tasks.push({ id: "t1", projectId: "p1", name: "Maquette", done: false, createdAt: 0 });
  d.entries.push(
    { id: "a", projectId: "p0", taskId: null, start: at(9, 9), end: at(9, 9, 25), source: "pomodoro", note: "" },
    { id: "b", projectId: "p1", taskId: "t1", start: at(9, 10), end: at(9, 11, 30), source: "chrono", note: '=SOMME("x")' },
    // À cheval sur minuit (mardi 10 -> mercredi 11).
    { id: "c", projectId: "p1", taskId: null, start: at(10, 23, 30), end: at(11, 0, 45), source: "manuel", note: "" },
    // Semaine suivante.
    { id: "d", projectId: "p0", taskId: null, start: at(16, 9), end: at(16, 10), source: "pomodoro", note: "" },
  );
  return d;
}

test("semaine du lundi au dimanche", () => {
  assert.equal(new Date(startOfWeek(at(12, 15))).getDate(), 9); // jeudi 12 -> lundi 9
  assert.equal(new Date(startOfWeek(at(15, 23))).getDate(), 9); // dimanche 15 -> lundi 9
  assert.equal(new Date(startOfWeek(at(16, 0))).getDate(), 16);
  assert.equal(weekLabel(startOfWeek(at(12, 15))), "Semaine du 9 au 15 novembre 2026");
  assert.equal(dayLabel(at(12, 15)), "jeudi 12 novembre 2026");
});

test("résumé de la semaine par projet, tâche et jour", () => {
  const d = sample();
  const from = startOfWeek(at(12, 12));
  const s = summarize(d, from, addDays(from, 7));
  assert.equal(s.days.length, 7);
  assert.equal(s.ms, (25 + 90 + 75) * MIN);
  assert.deepEqual(s.projects.map((p) => [p.name, p.ms / MIN]), [["Client ; A", 165], ["Général", 25]]);
  assert.deepEqual(s.projects[0].tasks.map((t) => [t.name, t.ms / MIN]), [["Maquette", 90], ["Sans tâche", 75]]);
  assert.deepEqual(s.days.slice(0, 3).map((x) => x.ms / MIN), [115, 30, 45]);
  assert.equal(s.days[1].byProject.p1, 30 * MIN);
});

test("résumé d'un jour : l'entrée à cheval sur minuit est coupée", () => {
  const d = sample();
  const day = startOfDay(at(11, 12));
  const s = summarize(d, day, addDays(day, 1));
  assert.equal(s.ms, 45 * MIN);
  assert.equal(s.days.length, 1);
});

test("le segment en cours est ajouté aux totaux", () => {
  const d = sample();
  const day = startOfDay(at(16, 12));
  const live = { id: "en-cours", projectId: "p1", taskId: null, start: at(16, 11), end: at(16, 11, 10), source: "chrono" as const, note: "" };
  assert.equal(summarize(d, day, addDays(day, 1), [live]).ms, 70 * MIN);
});

test("formats de durée", () => {
  assert.equal(formatDuration(0), "0 min");
  assert.equal(formatDuration(59 * MIN + 59_000), "59 min");
  assert.equal(formatDuration(65 * MIN), "1 h 05");
  assert.equal(formatClock(25 * MIN), "25:00");
  assert.equal(formatClock(1500), "00:02");
  assert.equal(formatClock(3723_000), "1:02:03");
});

test("CSV pour Excel français", () => {
  const csv = entriesCsv(sample());
  assert.ok(csv.startsWith("﻿Date;Début;Fin;Durée (min);Durée (h:mm);Projet;Tâche;Source;Note\r\n"));
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 5);
  assert.equal(lines[1], "2026-11-09;09:00;09:25;25,0;0:25;Général;;Pomodoro;");
  assert.equal(lines[2], `2026-11-09;10:00;11:30;90,0;1:30;"Client ; A";Maquette;Chrono;"'=SOMME(""x"")"`);
});

test("CSV d'une période : les entrées qui débordent sont coupées", () => {
  const day = startOfDay(at(11, 12));
  const lines = entriesCsv(sample(), day, addDays(day, 1)).trim().split("\r\n");
  assert.equal(lines.length, 2);
  assert.equal(lines[1], '2026-11-11;00:00;00:45;45,0;0:45;"Client ; A";;Saisie manuelle;');
  assert.equal(csvCell("a\nb"), '"a\nb"');
});
