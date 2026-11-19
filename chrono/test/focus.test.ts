import { test } from "node:test";
import assert from "node:assert/strict";
import { etatFocus, motTrouve, travailDuJour } from "../src/core/focus.ts";
import { createData, normalizeSettings } from "../src/core/engine.ts";
import type { AppData } from "../src/core/types.ts";

const now = new Date(2026, 10, 19, 15, 0).getTime();
const base = (): AppData => createData({ now, newId: (() => { let i = 0; return () => `id${++i}`; })() });
const avec = (d: AppData, settings: object, timer: object): AppData => ({ ...d, settings: { ...d.settings, ...settings }, timer: { ...d.timer, ...timer } });

test("réglages : valeurs par défaut sûres, mots nettoyés", () => {
  const s = normalizeSettings({ objectifMin: 5, motsBloques: [" YouTube ", "x", "YouTube", 3] });
  assert.equal(s.pauseForcee, false);
  assert.equal(s.bloquer, false);
  assert.equal(s.objectifMin, 15);
  assert.deepEqual(s.motsBloques, ["YouTube"]);
  assert.ok(normalizeSettings({}).motsBloques.includes("Instagram"));
});

test("écran de pause : seulement en pause du Pomodoro, report une seule fois par pause", () => {
  const fin = now + 4 * 60_000;
  const d = avec(base(), { pauseForcee: true }, { mode: "pomodoro", phase: "pause", status: "marche", endsAt: fin });
  assert.equal(etatFocus(d, now, null).ecranPause, true);
  const r = { pause: fin, jusqua: now + 5 * 60_000 };
  assert.equal(etatFocus(d, now + 1000, r).ecranPause, false);
  assert.equal(etatFocus(d, now + 1000, r).reportPossible, false);
  assert.equal(etatFocus(d, now + 6 * 60_000, r).ecranPause, true); // report écoulé
  assert.equal(etatFocus(avec(d, {}, { phase: "travail" }), now, null).ecranPause, false);
  assert.equal(etatFocus(avec(d, { pauseForcee: false }, {}), now, null).ecranPause, false);
  assert.equal(etatFocus(avec(d, {}, { status: "pause" }), now, null).ecranPause, false);
});

test("blocage : pendant le travail en marche seulement", () => {
  const d = avec(base(), { bloquer: true }, { mode: "pomodoro", phase: "travail", status: "marche" });
  assert.equal(etatFocus(d, now, null).bloquer, true);
  assert.equal(etatFocus(avec(d, {}, { phase: "pause" }), now, null).bloquer, false);
  assert.equal(etatFocus(avec(d, {}, { status: "arret" }), now, null).bloquer, false);
  assert.equal(etatFocus(avec(d, {}, { mode: "chrono", phase: "pause" }), now, null).bloquer, true);
  assert.equal(etatFocus(avec(d, { motsBloques: [] }, {}), now, null).bloquer, false);
});

test("mots bloqués : sans accents ni majuscules, jamais Chrono lui-même", () => {
  assert.equal(motTrouve("(3) Vidéo drôle - YouTube - Google Chrome", ["Instagram", "youtube"]), "youtube");
  assert.equal(motTrouve("Réseau TÉLÉ", ["tele"]), "tele");
  assert.equal(motTrouve("Rayan's Chrono — YouTube", ["YouTube"]), null);
  assert.equal(motTrouve("Cours de stats.pdf", ["YouTube"]), null);
});

test("barre : temps du jour (segment en cours compris) divisé par l'objectif", () => {
  let d = avec(base(), { barreTemps: true, objectifMin: 120 }, { mode: "chrono", status: "marche", segmentStart: now - 30 * 60_000 });
  d = { ...d, entries: [{ id: "e", projectId: d.selection.projectId, taskId: null, start: now - 3 * 3_600_000, end: now - 2.5 * 3_600_000, source: "chrono", note: "" }] };
  assert.equal(travailDuJour(d, now), 60 * 60_000);
  assert.equal(etatFocus(d, now, null).ratio, 0.5);
  assert.equal(etatFocus(avec(d, { barreTemps: false }, {}), now, null).ratio, 0);
});
