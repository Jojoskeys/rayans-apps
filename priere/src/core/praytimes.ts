// Calcul astronomique des horaires de prière, sans connexion : position du soleil, angles de l'aube (Fajr) et de la
// nuit (Isha), ombre pour Asr, correction des hautes latitudes. Méthode classique de PrayTimes.org (Hamid Zarrabi-Zadeh),
// la même que celle d'Aladhan : les tests comparent les résultats aux horaires d'Aladhan à la minute près.

export type MethodId = "uoif" | "mwl" | "isna" | "egypte" | "ummalqura" | "karachi" | "france15" | "perso";
export type AsrSchool = "shafii" | "hanafi";
export type HighLatRule = "angle" | "milieu" | "septieme" | "aucune";
export type PrayerId = "fajr" | "lever" | "dhuhr" | "asr" | "maghrib" | "isha";

/** Angle sous l'horizon en degrés, ou nombre de minutes après le coucher (Isha « 90 min »). */
export type AngleOrMinutes = { angle: number } | { minutes: number };

export interface Method {
  id: MethodId;
  name: string;
  detail: string;
  fajr: number;
  isha: AngleOrMinutes;
}

export const METHODS: Method[] = [
  { id: "uoif", name: "UOIF (France, 12°)", detail: "Fajr 12°, Isha 12°. Très utilisée par les mosquées de France.", fajr: 12, isha: { angle: 12 } },
  { id: "france15", name: "France 15°", detail: "Fajr 15°, Isha 15°. Compromis souvent proposé en France.", fajr: 15, isha: { angle: 15 } },
  { id: "mwl", name: "Ligue islamique mondiale (18°)", detail: "Fajr 18°, Isha 17°. Europe, Extrême-Orient.", fajr: 18, isha: { angle: 17 } },
  { id: "isna", name: "ISNA (Amérique du Nord)", detail: "Fajr 15°, Isha 15°.", fajr: 15, isha: { angle: 15 } },
  { id: "egypte", name: "Autorité égyptienne", detail: "Fajr 19,5°, Isha 17,5°. Afrique, Moyen-Orient.", fajr: 19.5, isha: { angle: 17.5 } },
  { id: "ummalqura", name: "Umm al-Qura (La Mecque)", detail: "Fajr 18,5°, Isha 90 min après Maghrib.", fajr: 18.5, isha: { minutes: 90 } },
  { id: "karachi", name: "Université de Karachi", detail: "Fajr 18°, Isha 18°. Pakistan, Inde, Bangladesh.", fajr: 18, isha: { angle: 18 } },
  { id: "perso", name: "Personnalisée", detail: "Vos propres angles pour Fajr et Isha.", fajr: 15, isha: { angle: 15 } },
];

export const PRAYERS: { id: PrayerId; name: string; arabic: string; isPrayer: boolean }[] = [
  { id: "fajr", name: "Fajr", arabic: "الفجر", isPrayer: true },
  { id: "lever", name: "Lever du soleil", arabic: "الشروق", isPrayer: false },
  { id: "dhuhr", name: "Dhuhr", arabic: "الظهر", isPrayer: true },
  { id: "asr", name: "Asr", arabic: "العصر", isPrayer: true },
  { id: "maghrib", name: "Maghrib", arabic: "المغرب", isPrayer: true },
  { id: "isha", name: "Isha", arabic: "العشاء", isPrayer: true },
];

export interface CalcParams {
  lat: number;
  lng: number;
  /** Fuseau horaire IANA du lieu (ex. « Europe/Paris »). */
  timeZone: string;
  method: MethodId;
  /** Angles utilisés quand method = « perso ». */
  customFajr?: number;
  customIsha?: number;
  asr: AsrSchool;
  highLat: HighLatRule;
  /** Décalages en minutes, par prière, pour coller au calendrier de sa mosquée. */
  offsets?: Partial<Record<PrayerId, number>>;
}

export type DayTimes = Record<PrayerId, number>; // instants en millisecondes (UTC)

// ----- Trigonométrie en degrés -------------------------------------------------------------------

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const sin = (d: number) => Math.sin(rad(d));
const cos = (d: number) => Math.cos(rad(d));
const tan = (d: number) => Math.tan(rad(d));
const arcsin = (x: number) => deg(Math.asin(x));
const arccos = (x: number) => deg(Math.acos(x));
const arctan2 = (y: number, x: number) => deg(Math.atan2(y, x));
const arccot = (x: number) => deg(Math.atan(1 / x));
const fix = (a: number, b: number) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
const fixAngle = (a: number) => fix(a, 360);
const fixHour = (h: number) => fix(h, 24);
const timeDiff = (t1: number, t2: number) => fixHour(t2 - t1);

function julian(year: number, month: number, day: number) {
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = arctan2(cos(e) * sin(L), cos(L)) / 15;
  return { declination: arcsin(sin(e) * sin(L)), equation: q / 15 - fixHour(RA) };
}

/** Décalage du fuseau (en heures) pour ce jour, à midi local : gère l'heure d'été. */
export function tzOffsetHours(timeZone: string, year: number, month: number, day: number): number {
  const probe = Date.UTC(year, month - 1, day, 12);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(probe));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return (asUtc - probe) / 3_600_000;
}

export function methodOf(p: CalcParams): Method {
  const m = METHODS.find((x) => x.id === p.method) ?? METHODS[0];
  if (m.id !== "perso") return m;
  return { ...m, fajr: p.customFajr ?? m.fajr, isha: { angle: p.customIsha ?? 15 } };
}

/**
 * Horaires du jour civil (année, mois 1-12, jour) au lieu donné. Les instants sont arrondis à la minute la plus proche.
 * Une valeur NaN signifie que l'horaire n'existe pas ce jour-là (cas extrêmes près des pôles, règle « aucune »).
 */
export function computeDay(p: CalcParams, year: number, month: number, day: number): DayTimes {
  const m = methodOf(p);
  const { lat, lng } = p;
  const jDate = julian(year, month, day) - lng / (15 * 24);
  const riseSet = 0.833; // réfraction + demi-diamètre du soleil, au niveau de la mer

  const midDay = (t: number) => fixHour(12 - sunPosition(jDate + t).equation);
  const sunAngleTime = (angle: number, time: number, ccw = false) => {
    const decl = sunPosition(jDate + time).declination;
    const noon = midDay(time);
    const t = arccos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return noon + (ccw ? -t : t);
  };
  const asrTime = (factor: number, time: number) => {
    const decl = sunPosition(jDate + time).declination;
    const angle = -arccot(factor + tan(Math.abs(lat - decl)));
    return sunAngleTime(angle, time);
  };

  // Une itération à partir d'heures approchées (fractions de jour), comme PrayTimes.
  const t = {
    fajr: sunAngleTime(m.fajr, 5 / 24, true),
    lever: sunAngleTime(riseSet, 6 / 24, true),
    dhuhr: midDay(12 / 24),
    asr: asrTime(p.asr === "hanafi" ? 2 : 1, 13 / 24),
    coucher: sunAngleTime(riseSet, 18 / 24),
    isha: "angle" in m.isha ? sunAngleTime(m.isha.angle, 18 / 24) : NaN,
  };

  const tz = tzOffsetHours(p.timeZone, year, month, day);
  const shift = tz - lng / 15;
  for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += shift;

  if (p.highLat !== "aucune") {
    const night = timeDiff(t.coucher, t.lever);
    const portion = (angle: number) => (p.highLat === "milieu" ? 1 / 2 : p.highLat === "septieme" ? 1 / 7 : angle / 60) * night;
    const fp = portion(m.fajr);
    if (Number.isNaN(t.fajr) || timeDiff(t.fajr, t.lever) > fp) t.fajr = t.lever - fp;
    if ("angle" in m.isha) {
      const ip = portion(m.isha.angle);
      if (Number.isNaN(t.isha) || timeDiff(t.coucher, t.isha) > ip) t.isha = t.coucher + ip;
    }
  }
  if ("minutes" in m.isha) t.isha = t.coucher + m.isha.minutes / 60;

  const hours: Record<PrayerId, number> = { fajr: t.fajr, lever: t.lever, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.coucher, isha: t.isha };
  const base = Date.UTC(year, month - 1, day) - tz * 3_600_000;
  const out = {} as DayTimes;
  for (const id of Object.keys(hours) as PrayerId[]) {
    const h = hours[id];
    if (Number.isNaN(h)) { out[id] = NaN; continue; }
    const ms = base + h * 3_600_000 + (p.offsets?.[id] ?? 0) * 60_000;
    out[id] = Math.round(ms / 60_000) * 60_000;
  }
  return out;
}

/** Date civile (année, mois, jour) d'un instant dans un fuseau. */
export function civilDate(ms: number, timeZone: string): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return [n("year"), n("month"), n("day")];
}

/** Direction de la Qibla (degrés depuis le nord, sens horaire). */
export function qibla(lat: number, lng: number): number {
  const kLat = 21.4225, kLng = 39.8262;
  const dl = kLng - lng;
  return fixAngle(arctan2(sin(dl), cos(lat) * tan(kLat) - sin(lat) * cos(dl)));
}
