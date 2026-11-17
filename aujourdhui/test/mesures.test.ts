import { test } from "node:test";
import assert from "node:assert/strict";
import { chronoParJour, journalParJour, mesures, revisionParJour } from "../src/core/mesures.ts";

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();

test("cartes révisées et temps de Chrono par journée (de 4 h à 4 h)", () => {
  const rev = revisionParJour({ reviews: [{ ts: at(17, 9) }, { ts: at(17, 23) }, { ts: at(18, 2) }, { ts: at(18, 5) }] });
  assert.deepEqual(rev, { "2026-11-17": 3, "2026-11-18": 1 });
  assert.equal(revisionParJour({}), undefined);
  const ch = chronoParJour({ entries: [{ start: at(17, 10), end: at(17, 10, 25) }, { start: at(17, 14), end: at(17, 14, 50) }, { start: at(17, 15), end: at(17, 14) }] });
  assert.deepEqual(ch, { "2026-11-17": 75 });
});

test("résumé de Rayan's Journal : jeux et dernière activité, journées non suivies ignorées", () => {
  const j = journalParJour({ version: 1, jours: [
    { jour: "2026-11-16", ecranMs: 3_600_000, jeuxMs: 1_800_000, derniereMs: at(17, 0, 30) },
    { jour: "2026-11-17", ecranMs: 0, jeuxMs: 0, derniereMs: null },
  ] });
  assert.deepEqual(j.jeuxMin, { "2026-11-16": 30 });
  assert.deepEqual(j.coucherMin, { "2026-11-16": 1470 }); // 0 h 30 le lendemain
  const m = mesures({ journal: { jours: [] }, counts: [{ id: "revision", total: 12, detail: "", missing: false, error: null }, { id: "hifz", total: null, detail: "", missing: true, error: null }] });
  assert.equal(m.revisionRestantes, 12);
  assert.equal(m.hifzRestantes, undefined);
});
