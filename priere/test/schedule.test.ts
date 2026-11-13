import { test } from "node:test";
import assert from "node:assert/strict";
import { currentPrayer, due, nextPrayer, prayerName, reminders } from "../src/core/schedule.ts";
import { DEFAULT_SETTINGS, normalizeData, normalizeSettings, type Settings } from "../src/core/settings.ts";

const s: Settings = { ...DEFAULT_SETTINGS, place: { name: "Paris", lat: 48.8566, lng: 2.3522, tz: "Europe/Paris" } };
const at = (iso: string) => Date.parse(iso);

test("prochaine prière : Asr après Dhuhr, Fajr du lendemain après Isha", () => {
  // 13/11/2026 à Paris (UOIF) : Dhuhr 12:35, Asr 14:52, Isha ~18:20.
  assert.equal(nextPrayer(s, at("2026-11-13T13:00:00+01:00"))!.id, "asr");
  const n = nextPrayer(s, at("2026-11-13T22:00:00+01:00"))!;
  assert.equal(n.id, "fajr");
  assert.deepEqual(n.date, [2026, 11, 14]);
});

test("prière en cours", () => {
  assert.equal(currentPrayer(s, at("2026-11-13T13:00:00+01:00")), "dhuhr");
  assert.equal(currentPrayer(s, at("2026-11-13T03:00:00+01:00")), "isha");
  assert.equal(currentPrayer(s, at("2026-11-13T10:00:00+01:00")), null); // entre le lever et Dhuhr
});

test("vendredi : Dhuhr devient Joumoua", () => {
  assert.equal(prayerName("dhuhr", [2026, 11, 13]), "Dhuhr (Joumoua)");
  assert.equal(prayerName("dhuhr", [2026, 11, 14]), "Dhuhr");
});

test("rappels : 10 min avant et à l'heure, une seule fois, pas de rattrapage tardif", () => {
  const asr = reminders(s, at("2026-11-13T12:00:00+01:00")).filter((r) => r.prayer === "asr" && r.key.startsWith("2026-11-13"));
  assert.deepEqual(asr.map((r) => r.kind), ["avant", "heure"]);
  assert.equal(asr[1].at - asr[0].at, 10 * 60_000);

  const sent = new Set<string>();
  const now = asr[1].at + 30_000;
  const d1 = due(s, now, sent);
  assert.deepEqual(d1.map((r) => r.key), [asr[1].key]); // le rappel « avant » est trop vieux (10 min)
  for (const r of d1) sent.add(r.key);
  assert.equal(due(s, now + 1000, sent).length, 0);
  assert.equal(due(s, asr[1].at + 5 * 60_000, new Set()).length, 0);
});

test("notifications suspendues et prière désactivée", () => {
  const t = reminders(s, at("2026-11-13T12:00:00+01:00")).find((r) => r.prayer === "asr" && r.kind === "heure")!;
  assert.equal(due({ ...s, pausedUntil: t.at + 60_000 }, t.at + 1000, new Set()).length, 0);
  const off = { ...s, atTime: { ...s.atTime, asr: false }, before: 0 };
  assert.ok(!reminders(off, t.at).some((r) => r.prayer === "asr"));
});

test("réglages : valeurs invalides réparées", () => {
  const r = normalizeSettings({ method: "inconnue", before: 999, place: { name: "X", lat: 1, lng: 2, tz: "Pas/Un_Fuseau" }, offsets: { dhuhr: 5 } });
  assert.equal(r.method, "uoif");
  assert.equal(r.before, 60);
  assert.equal(r.place, null);
  assert.equal(r.offsets.dhuhr, 5);
  assert.equal(normalizeData(null).settings.place, null);
  // Les coordonnées gardent leur précision (0,01° de longitude ≈ 2 s d'écart sur les horaires, mais on ne perd rien).
  assert.deepEqual(normalizeSettings({ place: { name: "Paris", lat: 48.8566, lng: 2.3522, tz: "Europe/Paris" } }).place, { name: "Paris", lat: 48.8566, lng: 2.3522, tz: "Europe/Paris" });
});
