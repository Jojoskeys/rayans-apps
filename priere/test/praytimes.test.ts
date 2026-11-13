// Horaires comparés à ceux d'Aladhan (api.aladhan.com, relevés le 13/11/2026, correction des hautes latitudes
// « angle »). Tolérance : 1 minute (arrondis différents).
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDay, qibla, tzOffsetHours, type CalcParams, type PrayerId } from "../src/core/praytimes.ts";

const hhmm = (ms: number, tz: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
const minutes = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

function check(p: CalcParams, date: [number, number, number], ref: Record<PrayerId, string>) {
  const r = computeDay(p, ...date);
  for (const id of Object.keys(ref) as PrayerId[]) {
    const got = hhmm(r[id], p.timeZone);
    let d = Math.abs(minutes(got) - minutes(ref[id]));
    d = Math.min(d, 1440 - d);
    assert.ok(d <= 1, `${id} : ${got} au lieu de ${ref[id]}`);
  }
}

const paris = { lat: 48.8566, lng: 2.3522, timeZone: "Europe/Paris", highLat: "angle" } as const;

test("Paris, UOIF 12°, en été (heure d'été)", () => {
  check({ ...paris, method: "uoif", asr: "shafii" }, [2026, 6, 21],
    { fajr: "04:13", lever: "05:47", dhuhr: "13:52", asr: "18:10", maghrib: "21:58", isha: "23:32" });
});

test("Paris, MWL 18° en juin : correction des hautes latitudes", () => {
  check({ ...paris, method: "mwl", asr: "shafii" }, [2026, 6, 21],
    { fajr: "03:26", lever: "05:47", dhuhr: "13:52", asr: "18:10", maghrib: "21:58", isha: "00:11" });
});

test("Paris, MWL, Asr hanafite, en hiver", () => {
  check({ ...paris, method: "mwl", asr: "hanafi" }, [2026, 11, 13],
    { fajr: "06:07", lever: "07:56", dhuhr: "12:35", asr: "15:28", maghrib: "17:13", isha: "18:56" });
});

test("Lyon, UOIF", () => {
  check({ lat: 45.764, lng: 4.8357, timeZone: "Europe/Paris", highLat: "angle", method: "uoif", asr: "shafii" }, [2026, 11, 13],
    { fajr: "06:29", lever: "07:37", dhuhr: "12:25", asr: "14:51", maghrib: "17:12", isha: "18:20" });
});

test("New York, ISNA", () => {
  check({ lat: 40.7128, lng: -74.006, timeZone: "America/New_York", highLat: "angle", method: "isna", asr: "shafii" }, [2027, 1, 1],
    { fajr: "05:58", lever: "07:20", dhuhr: "12:00", asr: "14:21", maghrib: "16:39", isha: "18:01" });
});

test("La Mecque, Umm al-Qura (Isha 90 min après Maghrib)", () => {
  check({ lat: 21.4225, lng: 39.8262, timeZone: "Asia/Riyadh", highLat: "angle", method: "ummalqura", asr: "shafii" }, [2026, 11, 13],
    { fajr: "05:11", lever: "06:30", dhuhr: "12:05", asr: "15:17", maghrib: "17:39", isha: "19:09" });
});

test("décalages manuels en minutes", () => {
  const base = computeDay({ ...paris, method: "uoif", asr: "shafii" }, 2026, 11, 13);
  const dec = computeDay({ ...paris, method: "uoif", asr: "shafii", offsets: { dhuhr: 5, isha: -3 } }, 2026, 11, 13);
  assert.equal(dec.dhuhr - base.dhuhr, 5 * 60_000);
  assert.equal(dec.isha - base.isha, -3 * 60_000);
  assert.equal(dec.fajr, base.fajr);
});

test("fuseau : heure d'été et d'hiver", () => {
  assert.equal(tzOffsetHours("Europe/Paris", 2026, 7, 1), 2);
  assert.equal(tzOffsetHours("Europe/Paris", 2026, 12, 1), 1);
  assert.equal(tzOffsetHours("Asia/Kolkata", 2026, 12, 1), 5.5);
});

test("Qibla depuis Paris ≈ 119°", () => {
  assert.ok(Math.abs(qibla(48.8566, 2.3522) - 119.2) < 0.5, String(qibla(48.8566, 2.3522)));
});
