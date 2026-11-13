// Ce qui est affiché (prochaine prière, prière en cours) et ce qui doit être notifié, à partir des réglages.
import { civilDate, computeDay, PRAYERS, type DayTimes, type PrayerId } from "./praytimes.ts";
import { calcParams, NOTIFIED, type Settings } from "./settings.ts";

export interface DayView { date: [number, number, number]; times: DayTimes }

export interface Reminder {
  /** Clé unique (jour + prière + type) pour ne notifier qu'une fois. */
  key: string;
  at: number;
  prayer: PrayerId;
  kind: "avant" | "heure" | "fin-fajr";
  title: string;
  body: string;
}

const DAY = 86_400_000;

export function dayAt(s: Settings, ms: number): DayView | null {
  const p = calcParams(s);
  if (!p) return null;
  const date = civilDate(ms, p.timeZone);
  return { date, times: computeDay(p, ...date) };
}

/** Jours civils successifs à partir de celui qui contient « ms » (count jours). */
export function days(s: Settings, ms: number, count: number): DayView[] {
  const p = calcParams(s);
  if (!p) return [];
  const [y, m, d] = civilDate(ms, p.timeZone);
  const out: DayView[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const date: [number, number, number] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
    out.push({ date, times: computeDay(p, ...date) });
  }
  return out;
}

export const prayerName = (id: PrayerId, date?: [number, number, number]) => {
  // Le vendredi, Dhuhr est la prière du Joumoua.
  if (id === "dhuhr" && date && new Date(Date.UTC(date[0], date[1] - 1, date[2])).getUTCDay() === 5) return "Dhuhr (Joumoua)";
  return PRAYERS.find((p) => p.id === id)!.name;
};

/** Prochaine prière (hors lever du soleil) après « now », en regardant aujourd'hui et demain. */
export function nextPrayer(s: Settings, now: number): { id: PrayerId; at: number; date: [number, number, number] } | null {
  for (const v of days(s, now - DAY, 3)) {
    for (const id of NOTIFIED) {
      const at = v.times[id];
      if (Number.isFinite(at) && at > now) return { id, at, date: v.date };
    }
  }
  return null;
}

/** Prière dont le temps est en cours (la dernière commencée), ou null avant Fajr / entre le lever et Dhuhr. */
export function currentPrayer(s: Settings, now: number): PrayerId | null {
  const v = dayAt(s, now);
  if (!v) return null;
  const order: PrayerId[] = ["fajr", "lever", "dhuhr", "asr", "maghrib", "isha"];
  let cur: PrayerId | null = null;
  for (const id of order) if (Number.isFinite(v.times[id]) && v.times[id] <= now) cur = id;
  // Après minuit, avant Fajr : le temps d'Isha de la veille continue.
  if (cur === null) return "isha";
  return cur === "lever" ? null : cur;
}

const hm = (ms: number, tz: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(ms));

/** Tous les rappels prévus d'hier à demain (selon les réglages). */
export function reminders(s: Settings, now: number): Reminder[] {
  if (!s.place) return [];
  const tz = s.place.tz;
  const out: Reminder[] = [];
  for (const v of days(s, now - DAY, 3)) {
    const k = v.date.join("-");
    for (const id of NOTIFIED) {
      const at = v.times[id];
      if (!Number.isFinite(at)) continue;
      const name = prayerName(id, v.date);
      if (s.before > 0) out.push({ key: `${k}-${id}-avant`, at: at - s.before * 60_000, prayer: id, kind: "avant", title: `${name} dans ${s.before} min`, body: `${name} à ${hm(at, tz)} (${s.place.name}).` });
      if (s.atTime[id as keyof typeof s.atTime]) out.push({ key: `${k}-${id}-heure`, at, prayer: id, kind: "heure", title: `C'est l'heure de ${name}`, body: `${name} : ${hm(at, tz)} (${s.place.name}).` });
    }
    if (s.sunriseWarning > 0 && Number.isFinite(v.times.lever)) {
      out.push({ key: `${k}-lever-fin`, at: v.times.lever - s.sunriseWarning * 60_000, prayer: "fajr", kind: "fin-fajr", title: `Fin de Fajr dans ${s.sunriseWarning} min`, body: `Lever du soleil à ${hm(v.times.lever, tz)}.` });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Rappels à envoyer maintenant : échus depuis moins de « grace » ms et pas encore envoyés. Un rappel manqué de
 * plus longtemps (PC en veille, application fermée) n'est pas envoyé en retard.
 */
export function due(s: Settings, now: number, sent: ReadonlySet<string>, grace = 3 * 60_000): Reminder[] {
  if (s.pausedUntil && now < s.pausedUntil) return [];
  return reminders(s, now).filter((r) => r.at <= now && now - r.at < grace && !sent.has(r.key));
}
