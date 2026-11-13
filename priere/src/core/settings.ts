// Réglages enregistrés (priere.json), avec valeurs par défaut et réparation des valeurs invalides.
import { METHODS, type AsrSchool, type CalcParams, type HighLatRule, type MethodId, type PrayerId } from "./praytimes.ts";

export type NotifiedPrayer = Exclude<PrayerId, "lever">;
export const NOTIFIED: NotifiedPrayer[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export interface Place { name: string; lat: number; lng: number; tz: string }

export interface Settings {
  /** null tant que l'utilisateur n'a pas choisi de lieu (premier lancement). */
  place: Place | null;
  method: MethodId;
  customFajr: number;
  customIsha: number;
  asr: AsrSchool;
  highLat: HighLatRule;
  offsets: Record<PrayerId, number>;
  /** Notification à l'heure de chaque prière. */
  atTime: Record<NotifiedPrayer, boolean>;
  /** Rappel N minutes avant (0 = pas de rappel). */
  before: number;
  /** Rappel avant la fin du temps de Fajr (lever du soleil), en minutes (0 = aucun). */
  sunriseWarning: number;
  sound: boolean;
  /** Notifications suspendues jusqu'à cet instant (ms), ou null. */
  pausedUntil: number | null;
  startWithWindows: boolean;
  closeToTray: boolean;
  /** Ajustement du calendrier hégirien en jours (-2..2). */
  hijriAdjust: number;
}

export interface AppData { version: 1; settings: Settings }

export const DEFAULT_SETTINGS: Settings = {
  place: null,
  method: "uoif",
  customFajr: 15,
  customIsha: 15,
  asr: "shafii",
  highLat: "angle",
  offsets: { fajr: 0, lever: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  atTime: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  before: 10,
  sunriseWarning: 0,
  sound: true,
  pausedUntil: null,
  startWithWindows: true,
  closeToTray: true,
  hijriAdjust: 0,
};

const num = (v: unknown, def: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v * 100) / 100)) : def;
const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
const oneOf = <T extends string>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def);

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const d = DEFAULT_SETTINGS;
  let place: Place | null = null;
  const p = r.place;
  if (p && typeof p === "object" && typeof p.name === "string" && Number.isFinite(p.lat) && Number.isFinite(p.lng) && typeof p.tz === "string") {
    const coord = (v: number, lim: number) => Math.min(lim, Math.max(-lim, Math.round(v * 1e5) / 1e5));
    try { new Intl.DateTimeFormat("fr", { timeZone: p.tz }); place = { name: p.name.slice(0, 80), lat: coord(p.lat, 89.9), lng: coord(p.lng, 180), tz: p.tz }; } catch { place = null; }
  }
  const offsets = { ...d.offsets };
  for (const k of Object.keys(offsets) as PrayerId[]) offsets[k] = num(r.offsets?.[k], 0, -60, 60);
  const atTime = { ...d.atTime };
  for (const k of NOTIFIED) atTime[k] = bool(r.atTime?.[k], true);
  return {
    place,
    method: oneOf(r.method, METHODS.map((m) => m.id), d.method),
    customFajr: num(r.customFajr, d.customFajr, 5, 25),
    customIsha: num(r.customIsha, d.customIsha, 5, 25),
    asr: oneOf(r.asr, ["shafii", "hanafi"] as const, d.asr),
    highLat: oneOf(r.highLat, ["angle", "milieu", "septieme", "aucune"] as const, d.highLat),
    offsets,
    atTime,
    before: num(r.before, d.before, 0, 60),
    sunriseWarning: num(r.sunriseWarning, d.sunriseWarning, 0, 60),
    sound: bool(r.sound, d.sound),
    pausedUntil: typeof r.pausedUntil === "number" ? r.pausedUntil : null,
    startWithWindows: bool(r.startWithWindows, d.startWithWindows),
    closeToTray: bool(r.closeToTray, d.closeToTray),
    hijriAdjust: num(r.hijriAdjust, 0, -2, 2),
  };
}

export function normalizeData(raw: unknown): AppData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { version: 1, settings: normalizeSettings(r.settings) };
}

export function calcParams(s: Settings): CalcParams | null {
  if (!s.place) return null;
  return {
    lat: s.place.lat, lng: s.place.lng, timeZone: s.place.tz, method: s.method,
    customFajr: s.customFajr, customIsha: s.customIsha, asr: s.asr, highLat: s.highLat, offsets: s.offsets,
  };
}
