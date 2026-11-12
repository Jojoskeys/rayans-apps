import { test } from "node:test";
import assert from "node:assert/strict";
import { createData, normalizeData, reduce, remaining, phaseMs, liveEntry } from "../src/core/engine.ts";
import type { Action, AppData, ChronoEvent } from "../src/core/types.ts";

const MIN = 60_000;
const T0 = new Date(2026, 10, 12, 9, 0, 0).getTime();

function harness(patch: Partial<AppData["settings"]> = {}) {
  let n = 0;
  const newId = () => `id${++n}`;
  let data = createData({ now: T0, newId });
  let now = T0;
  const events: ChronoEvent[] = [];
  const h = {
    get data() { return data; },
    get now() { return now; },
    at(t: number) { now = t; return h; },
    after(ms: number) { now += ms; return h; },
    do(a: Action) {
      const r = reduce(data, a, { now, newId });
      data = r.data;
      events.push(...r.events);
      return r;
    },
    events,
  };
  if (Object.keys(patch).length) h.do({ type: "settings", patch });
  return h;
}

test("un cycle Pomodoro complet enregistre le travail et enchaîne la pause", () => {
  const h = harness({ autoStartBreaks: true, autoStartWork: false });
  h.do({ type: "start" });
  assert.equal(h.data.timer.status, "marche");
  assert.equal(remaining(h.data.timer, h.now), 25 * MIN);
  h.after(25 * MIN + 500).do({ type: "tick" });
  assert.equal(h.data.entries.length, 1);
  assert.equal(h.data.entries[0].end - h.data.entries[0].start, 25 * MIN);
  assert.equal(h.data.entries[0].source, "pomodoro");
  assert.equal(h.data.timer.phase, "pause");
  assert.equal(h.data.timer.status, "marche", "la pause démarre seule");
  assert.deepEqual(h.events.find((e) => e.type === "phaseEnd"), { type: "phaseEnd", from: "travail", to: "pause", autoStarted: true });
  // Fin de la pause : le travail ne redémarre pas seul.
  h.after(5 * MIN).do({ type: "tick" });
  assert.equal(h.data.timer.phase, "travail");
  assert.equal(h.data.timer.status, "arret");
  assert.equal(h.data.timer.remainingMs, 25 * MIN);
  assert.equal(h.data.entries.length, 1, "la pause n'est pas comptée comme du travail");
});

test("longue pause après le nombre de pomodoros réglé", () => {
  const h = harness({ longEvery: 2, autoStartBreaks: true, autoStartWork: true, workMin: 10, shortBreakMin: 2, longBreakMin: 7 });
  h.do({ type: "start" });
  const phases: string[] = [];
  for (let i = 0; i < 4; i++) {
    h.at(h.data.timer.endsAt!).do({ type: "tick" });
    phases.push(h.data.timer.phase);
  }
  assert.deepEqual(phases, ["pause", "travail", "longue", "travail"]);
  assert.equal(h.data.timer.cycle, 0);
  assert.equal(h.data.timer.completed, 2);
  assert.equal(h.data.entries.length, 2);
});

test("pause puis reprise : deux segments, temps restant conservé", () => {
  const h = harness();
  h.do({ type: "start" });
  h.after(10 * MIN).do({ type: "pause" });
  assert.equal(h.data.timer.status, "pause");
  assert.equal(h.data.timer.remainingMs, 15 * MIN);
  h.after(3 * MIN).do({ type: "start" });
  assert.equal(remaining(h.data.timer, h.now), 15 * MIN);
  h.after(15 * MIN).do({ type: "tick" });
  const total = h.data.entries.reduce((n, e) => n + e.end - e.start, 0);
  assert.equal(h.data.entries.length, 2);
  assert.equal(total, 25 * MIN);
});

test("passer une phase n'augmente pas le compteur et enregistre le travail déjà fait", () => {
  const h = harness();
  h.do({ type: "start" });
  h.after(7 * MIN).do({ type: "skip" });
  assert.equal(h.data.timer.phase, "pause");
  assert.equal(h.data.timer.completed, 0);
  assert.equal(h.data.entries[0].end - h.data.entries[0].start, 7 * MIN);
});

test("réveil après une longue veille : pas de démarrage automatique de la phase suivante", () => {
  const h = harness({ autoStartBreaks: true });
  h.do({ type: "start" });
  h.after(3 * 60 * MIN).do({ type: "tick" });
  assert.equal(h.data.entries[0].end - h.data.entries[0].start, 25 * MIN, "le travail s'arrête à la fin prévue");
  assert.equal(h.data.timer.phase, "pause");
  assert.equal(h.data.timer.status, "arret");
});

test("changer de tâche en cours de route répartit le temps", () => {
  const h = harness();
  const pid = h.data.selection.projectId;
  h.do({ type: "addTask", projectId: pid, name: "Rédaction" });
  h.do({ type: "addTask", projectId: pid, name: "Relecture" });
  const [t1, t2] = h.data.tasks;
  h.do({ type: "select", projectId: pid, taskId: t1.id });
  h.do({ type: "setMode", mode: "chrono" });
  h.do({ type: "start" });
  h.after(20 * MIN).do({ type: "select", projectId: pid, taskId: t2.id });
  assert.equal(h.data.timer.status, "marche");
  h.after(10 * MIN).do({ type: "pause" });
  assert.deepEqual(h.data.entries.map((e) => [e.taskId, (e.end - e.start) / MIN, e.source]), [[t1.id, 20, "chrono"], [t2.id, 10, "chrono"]]);
});

test("chrono libre : le segment en cours apparaît en direct", () => {
  const h = harness();
  h.do({ type: "setMode", mode: "chrono" });
  h.do({ type: "start" });
  h.after(90_000);
  const live = liveEntry(h.data, h.now);
  assert.equal(live?.end! - live?.start!, 90_000);
  h.do({ type: "reset" });
  assert.equal(h.data.entries.length, 1);
  assert.equal(liveEntry(h.data, h.now), null);
});

test("les segments de moins d'une seconde sont ignorés", () => {
  const h = harness();
  h.do({ type: "start" });
  h.after(400).do({ type: "pause" });
  assert.equal(h.data.entries.length, 0);
});

test("on ne démarre pas sur un projet archivé, on n'archive pas le dernier projet actif", () => {
  const h = harness();
  const pid = h.data.selection.projectId;
  assert.equal(h.do({ type: "updateProject", id: pid, archived: true }).changed, false);
  h.do({ type: "addProject", name: "Client A" });
  const other = h.data.projects[1];
  assert.notEqual(other.color, h.data.projects[0].color);
  h.do({ type: "updateProject", id: pid, archived: true });
  assert.equal(h.data.selection.projectId, other.id);
});

test("supprimer un projet supprime ses tâches et son temps ; supprimer une tâche garde le temps", () => {
  const h = harness();
  h.do({ type: "addProject", name: "B" });
  const b = h.data.projects[1];
  h.do({ type: "addTask", projectId: b.id, name: "T" });
  const t = h.data.tasks[0];
  h.do({ type: "addEntry", projectId: b.id, taskId: t.id, start: T0, end: T0 + 30 * MIN });
  h.do({ type: "deleteTask", id: t.id });
  assert.equal(h.data.entries[0].taskId, null);
  h.do({ type: "deleteProject", id: b.id });
  assert.equal(h.data.entries.length, 0);
  assert.equal(h.data.projects.length, 1);
  assert.equal(h.do({ type: "deleteProject", id: h.data.projects[0].id }).changed, false, "le dernier projet reste");
});

test("saisie et modification manuelles validées", () => {
  const h = harness();
  const pid = h.data.selection.projectId;
  assert.equal(h.do({ type: "addEntry", projectId: pid, taskId: null, start: T0, end: T0 }).changed, false);
  h.do({ type: "addEntry", projectId: pid, taskId: null, start: T0, end: T0 + MIN, note: "  appel  " });
  const e = h.data.entries[0];
  assert.equal(e.note, "appel");
  assert.equal(h.do({ type: "updateEntry", id: e.id, end: T0 - MIN }).changed, false);
  h.do({ type: "updateEntry", id: e.id, end: T0 + 2 * MIN });
  assert.equal(h.data.entries[0].end, T0 + 2 * MIN);
  h.do({ type: "deleteEntry", id: e.id });
  assert.equal(h.data.entries.length, 0);
});

test("les réglages s'appliquent à une phase arrêtée et sont bornés", () => {
  const h = harness();
  h.do({ type: "settings", patch: { workMin: 50 } });
  assert.equal(h.data.timer.remainingMs, 50 * MIN);
  h.do({ type: "settings", patch: { workMin: -3, longEvery: 99 } });
  assert.equal(h.data.settings.workMin, 1);
  assert.equal(h.data.settings.longEvery, 12);
  assert.equal(phaseMs(h.data.settings, "longue"), 15 * MIN);
});

test("l'action est sans effet sur l'état d'origine (fonction pure)", () => {
  const h = harness();
  const before = JSON.stringify(h.data);
  reduce(h.data, { type: "start" }, { now: T0, newId: () => "x" });
  assert.equal(JSON.stringify(h.data), before);
});

test("lecture d'un fichier abîmé : données invalides écartées, reste conservé", () => {
  let n = 0;
  const ctx = { now: T0, newId: () => `n${++n}` };
  const d = normalizeData({
    projects: [{ id: "p1", name: "Projet", color: "rouge" }, { id: "", name: "x" }, "n'importe quoi"],
    tasks: [{ id: "t1", projectId: "p1", name: "Tâche" }, { id: "t2", projectId: "absent", name: "Orpheline" }],
    entries: [
      { id: "e1", projectId: "p1", taskId: "t1", start: T0, end: T0 + MIN, source: "pomodoro" },
      { id: "e2", projectId: "p1", start: T0 + MIN, end: T0 },
      { id: "e3", projectId: "absent", start: T0, end: T0 + MIN },
    ],
    settings: { workMin: "vingt", shortBreakMin: 3 },
    timer: { mode: "chrono", status: "marche" },
    selection: { projectId: "absent" },
  }, ctx);
  assert.equal(d.projects.length, 1);
  assert.match(d.projects[0].color, /^#/);
  assert.deepEqual(d.tasks.map((t) => t.id), ["t1"]);
  assert.deepEqual(d.entries.map((e) => e.id), ["e1"]);
  assert.equal(d.settings.workMin, 25);
  assert.equal(d.settings.shortBreakMin, 3);
  assert.equal(d.timer.status, "arret", "chrono « en marche » sans début : arrêté");
  assert.equal(d.selection.projectId, "p1");
  assert.equal(normalizeData(null, ctx).projects[0].name, "Général");
});
