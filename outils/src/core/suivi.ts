// Petites listes de Rayan's Outils, enregistrées dans suivi.json : échéances et abonnements (echeance), liens à lire
// plus tard (garde), entretien irrégulier (fait) et textes récurrents (colle). Fonctions pures, sans accès au disque.
import { fold } from "./commands.ts";

export type Recurrence = "aucune" | "mensuelle" | "annuelle";

export interface Deadline {
  id: string;
  name: string;
  /** Date de l'échéance (renouvellement, paiement, date limite), « AAAA-MM-JJ ». */
  date: string;
  /** Date limite pour résilier, ou null. */
  cancelBy: string | null;
  recurrence: Recurrence;
  amount: string;
  note: string;
  /** Rappels déjà envoyés (clé « type:date »). */
  notified: string[];
}

export interface Bookmark { id: string; url: string; reason: string; addedAt: number; readAt: number | null }

export interface Chore {
  id: string;
  name: string;
  /** Au-delà de ce nombre de jours sans le faire, la tâche passe en rouge. */
  intervalDays: number;
  /** Dates où la tâche a été faite (ms), la plus récente en dernier. */
  done: number[];
}

export interface Snippet { id: string; name: string; text: string }

export interface Suivi { deadlines: Deadline[]; bookmarks: Bookmark[]; chores: Chore[]; snippets: Snippet[] }

export const KEEP_DAYS = 30;
export const ALERT_DAYS = 3;
const DAY = 86_400_000;

export const emptySuivi = (): Suivi => ({ deadlines: [], bookmarks: [], chores: [], snippets: [] });

// ----- Dates « AAAA-MM-JJ » (jour civil local) ----------------------------------------------------

export function iso(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const isIso = (s: unknown): s is string => typeof s === "string" && ISO_RE.test(s) && !Number.isNaN(toUtc(s));
const toUtc = (s: string) => { const [y, m, d] = s.split("-").map(Number); const t = Date.UTC(y, m - 1, d); return new Date(t).getUTCDate() === d ? t : NaN; };
/** Jours de `from` à `to` (positif si `to` est après). */
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY);
export function addDays(s: string, n: number): string {
  const d = new Date(toUtc(s) + n * DAY);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
/** Ajoute des mois en restant au même jour, ou au dernier jour du mois s'il est plus court (31 janvier + 1 mois = 28 février). */
export function addMonths(s: string, n: number, day = Number(s.slice(8))): string {
  const [y, m] = s.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12), nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

/**
 * Date tapée : « 15/12 », « 15/12/2026 », « 15-12-26 », « 2026-12-15 », « 15 décembre », « 15 dec 2026 »,
 * « demain », « dans 10 jours », « dans 2 mois ». Sans année, la prochaine occurrence (aujourd'hui compris).
 */
export function parseDate(text: string, now: number): string | null {
  const t = fold(text).replace(/\s+/g, " ").replace(/^le /, "");
  const today = iso(now);
  if (t === "aujourd'hui" || t === "aujourdhui") return today;
  if (t === "demain") return addDays(today, 1);
  let m = /^dans (\d{1,3}) (jours?|j|semaines?|mois|ans?)$/.exec(t);
  if (m) {
    const n = Number(m[1]);
    if (m[2].startsWith("j")) return addDays(today, n);
    if (m[2].startsWith("s")) return addDays(today, n * 7);
    if (m[2] === "mois") return addMonths(today, n);
    return addMonths(today, n * 12);
  }
  if (ISO_RE.test(t)) return isIso(t) ? t : null;
  let day: number, month: number, year: number | null = null;
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(t);
  if (m) { day = +m[1]; month = +m[2]; if (m[3]) year = m[3].length === 2 ? 2000 + +m[3] : +m[3]; }
  else {
    m = /^(\d{1,2})(?:er)? ([a-z]+)\.?(?: (\d{4}))?$/.exec(t);
    if (!m) return null;
    const i = MONTHS.findIndex((x) => m![2].length >= 3 && x.startsWith(m![2]));
    if (i < 0) return null;
    day = +m[1]; month = i + 1; if (m[3]) year = +m[3];
  }
  const make = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const y0 = Number(today.slice(0, 4));
  const s = make(year ?? y0);
  if (!isIso(s)) return null;
  return year === null && s < today ? (isIso(make(y0 + 1)) ? make(y0 + 1) : null) : s;
}

/** « echeance Netflix 15/12 » : le nom puis la date à la fin (1 à 3 mots). */
export function splitNameDate(arg: string, now: number): { name: string; date: string | null } {
  const words = arg.trim().split(/\s+/).filter(Boolean);
  for (let k = Math.min(3, words.length - 1); k >= 1; k--) {
    const date = parseDate(words.slice(-k).join(" "), now);
    if (date) return { name: words.slice(0, -k).join(" "), date };
  }
  return { name: arg.trim(), date: null };
}

export function formatDay(s: string, now?: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const sameYear = now === undefined || y === new Date(now).getFullYear();
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
}

export function inDays(n: number): string {
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  return n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`;
}

// ----- Normalisation --------------------------------------------------------------------------------

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
const id = (v: unknown) => str(v, 64) || null;

export function normalizeSuivi(raw: unknown): Suivi {
  const r = (raw ?? {}) as Partial<Suivi>;
  const arr = <T>(v: unknown) => (Array.isArray(v) ? (v as T[]).filter((x) => x && typeof x === "object") : []);
  const s = emptySuivi();
  for (const d of arr<Deadline>(r.deadlines)) {
    if (!id(d.id) || !str(d.name).trim() || !isIso(d.date)) continue;
    s.deadlines.push({
      id: d.id, name: str(d.name, 120).trim(), date: d.date, cancelBy: isIso(d.cancelBy) ? d.cancelBy : null,
      recurrence: d.recurrence === "mensuelle" || d.recurrence === "annuelle" ? d.recurrence : "aucune",
      amount: str(d.amount, 40), note: str(d.note, 1000), notified: Array.isArray(d.notified) ? d.notified.filter((x) => typeof x === "string").slice(-20) : [],
    });
  }
  for (const b of arr<Bookmark>(r.bookmarks)) {
    if (!id(b.id) || !/^https?:\/\//i.test(str(b.url, 4000)) || !Number.isFinite(b.addedAt)) continue;
    s.bookmarks.push({ id: b.id, url: str(b.url, 4000), reason: str(b.reason, 500), addedAt: b.addedAt, readAt: Number.isFinite(b.readAt) ? b.readAt : null });
  }
  for (const c of arr<Chore>(r.chores)) {
    if (!id(c.id) || !str(c.name).trim()) continue;
    const interval = Number(c.intervalDays);
    s.chores.push({
      id: c.id, name: str(c.name, 120).trim(), intervalDays: Number.isInteger(interval) && interval >= 1 && interval <= 3650 ? interval : 30,
      done: Array.isArray(c.done) ? c.done.filter((x) => Number.isFinite(x)).sort((a, b) => a - b).slice(-20) : [],
    });
  }
  for (const n of arr<Snippet>(r.snippets)) {
    if (!id(n.id) || !str(n.name).trim()) continue;
    s.snippets.push({ id: n.id, name: str(n.name, 60).trim(), text: str(n.text, 20000) });
  }
  return s;
}

// ----- Recherche par nom ----------------------------------------------------------------------------

/** Élément dont le nom correspond : exact (sans accents ni majuscules), sinon le seul qui commence ainsi. */
export function byName<T extends { name: string }>(list: T[], query: string): T | null {
  const q = fold(query);
  if (!q) return null;
  const exact = list.find((x) => fold(x.name) === q);
  if (exact) return exact;
  const starts = list.filter((x) => fold(x.name).startsWith(q));
  return starts.length === 1 ? starts[0] : null;
}

// ----- Actions ---------------------------------------------------------------------------------------

export type SuiviAction =
  | { type: "deadline-save"; deadline: Omit<Deadline, "notified"> & { notified?: string[] } }
  | { type: "deadline-delete"; id: string }
  | { type: "bookmark-add"; id: string; url: string; reason: string }
  | { type: "bookmark-read"; id: string; read: boolean }
  | { type: "bookmark-delete"; id: string }
  | { type: "chore-done"; id: string; name: string }
  | { type: "chore-undo"; id: string }
  | { type: "chore-save"; chore: Omit<Chore, "done"> & { done?: number[] } }
  | { type: "chore-delete"; id: string }
  | { type: "snippet-save"; snippet: Snippet }
  | { type: "snippet-delete"; id: string };

/** Applique une action (les éléments créés reçoivent l'id fourni par l'action). */
export function reduceSuivi(s: Suivi, a: SuiviAction, now: number): Suivi {
  switch (a.type) {
    case "deadline-save": {
      const old = s.deadlines.find((d) => d.id === a.deadline.id);
      // Dates changées : les rappels déjà envoyés pour les anciennes dates ne comptent plus.
      const d: Deadline = { ...a.deadline, notified: old && old.date === a.deadline.date && old.cancelBy === a.deadline.cancelBy ? old.notified : [] };
      const deadlines = old ? s.deadlines.map((x) => (x.id === d.id ? d : x)) : [...s.deadlines, d];
      return normalizeSuivi({ ...s, deadlines });
    }
    case "deadline-delete": return { ...s, deadlines: s.deadlines.filter((d) => d.id !== a.id) };
    case "bookmark-add": {
      if (s.bookmarks.some((b) => b.url === a.url && !b.readAt)) {
        return { ...s, bookmarks: s.bookmarks.map((b) => (b.url === a.url && !b.readAt ? { ...b, reason: a.reason || b.reason } : b)) };
      }
      return normalizeSuivi({ ...s, bookmarks: [...s.bookmarks, { id: a.id, url: a.url, reason: a.reason, addedAt: now, readAt: null }] });
    }
    case "bookmark-read": return { ...s, bookmarks: s.bookmarks.map((b) => (b.id === a.id ? { ...b, readAt: a.read ? now : null } : b)) };
    case "bookmark-delete": return { ...s, bookmarks: s.bookmarks.filter((b) => b.id !== a.id) };
    case "chore-done": {
      const c = s.chores.find((x) => x.id === a.id) ?? byName(s.chores, a.name);
      if (c) return { ...s, chores: s.chores.map((x) => (x.id === c.id ? { ...x, done: [...x.done, now].slice(-20) } : x)) };
      if (!a.name.trim()) return s;
      return { ...s, chores: [...s.chores, { id: a.id, name: a.name.trim().slice(0, 120), intervalDays: 30, done: [now] }] };
    }
    case "chore-undo": return { ...s, chores: s.chores.map((x) => (x.id === a.id ? { ...x, done: x.done.slice(0, -1) } : x)) };
    case "chore-save": {
      const old = s.chores.find((x) => x.id === a.chore.id);
      const c = { ...a.chore, done: a.chore.done ?? old?.done ?? [] };
      return normalizeSuivi({ ...s, chores: old ? s.chores.map((x) => (x.id === c.id ? c : x)) : [...s.chores, c] });
    }
    case "chore-delete": return { ...s, chores: s.chores.filter((x) => x.id !== a.id) };
    case "snippet-save": {
      const exists = s.snippets.some((x) => x.id === a.snippet.id);
      return normalizeSuivi({ ...s, snippets: exists ? s.snippets.map((x) => (x.id === a.snippet.id ? a.snippet : x)) : [...s.snippets, a.snippet] });
    }
    case "snippet-delete": return { ...s, snippets: s.snippets.filter((x) => x.id !== a.id) };
  }
}

// ----- Échéances : renouvellement et rappels ---------------------------------------------------------

/** Abonnements : une échéance passée avance à la prochaine période (la date de résiliation suit du même écart). */
export function rollDeadline(d: Deadline, today: string): Deadline {
  if (d.recurrence === "aucune" || d.date >= today) return d;
  const step = d.recurrence === "mensuelle" ? 1 : 12;
  const gap = d.cancelBy ? daysBetween(d.cancelBy, d.date) : null;
  const day = Number(d.date.slice(8));
  let n = 0, date = d.date;
  while (date < today && n < 1200) { n += step; date = addMonths(d.date, n, day); }
  return { ...d, date, cancelBy: gap === null ? null : addDays(date, -gap), notified: [] };
}

export interface Alert { deadlineId: string; key: string; title: string; body: string }

/** Rappels à envoyer maintenant : 3 jours avant (ou moins si l'échéance vient d'être ajoutée), une seule fois. */
export function dueAlerts(deadlines: Deadline[], now: number): Alert[] {
  const today = iso(now);
  const out: Alert[] = [];
  for (const d of deadlines) {
    const targets: [string, string][] = [];
    if (d.cancelBy) targets.push(["resilier", d.cancelBy]);
    targets.push(["echeance", d.date]);
    for (const [kind, date] of targets) {
      const left = daysBetween(today, date);
      const key = `${kind}:${date}`;
      if (left < 0 || left > ALERT_DAYS || d.notified.includes(key)) continue;
      out.push({
        deadlineId: d.id, key,
        title: kind === "resilier" ? `Résilier ${d.name} : ${inDays(left)}` : `${d.name} : ${inDays(left)}`,
        body: kind === "resilier"
          ? `Date limite de résiliation : ${formatDay(date)}.${d.amount ? ` ${d.amount}.` : ""}`
          : `Échéance le ${formatDay(date)}.${d.amount ? ` ${d.amount}.` : ""}${d.note ? ` ${d.note}` : ""}`,
      });
    }
  }
  return out;
}

/** Date à surveiller en premier : la limite de résiliation si elle n'est pas passée, sinon l'échéance. */
export const nextDate = (d: Deadline, today: string) => (d.cancelBy && d.cancelBy >= today ? d.cancelBy : d.date);

export function sortDeadlines(list: Deadline[], today: string): Deadline[] {
  return [...list].sort((a, b) => nextDate(a, today).localeCompare(nextDate(b, today)) || a.name.localeCompare(b.name, "fr"));
}

// ----- Export .ics (agenda du téléphone) -------------------------------------------------------------

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utf8 = new TextEncoder();
/** Lignes de 75 octets au plus (RFC 5545), coupées sans casser un caractère UTF-8. */
function fold75(line: string): string {
  const out: string[] = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const b = utf8.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}
const icsDate = (s: string) => s.replace(/-/g, "");
const stamp = (now: number) => new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

/** Calendrier .ics : un événement d'une journée par échéance et par date de résiliation, rappel 3 jours avant. */
export function toIcs(deadlines: Deadline[], now: number): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rayan//Rayan's Outils//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Échéances"];
  for (const d of deadlines) {
    const events: [string, string, string][] = [["echeance", d.date, d.name]];
    if (d.cancelBy) events.push(["resilier", d.cancelBy, `Résilier : ${d.name}`]);
    for (const [kind, date, summary] of events) {
      const desc = [d.amount, d.note, kind === "resilier" ? `Échéance le ${formatDay(d.date)}` : ""].filter(Boolean).join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${d.id}-${kind}@rayans-outils`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART;VALUE=DATE:${icsDate(date)}`,
        `DTEND;VALUE=DATE:${icsDate(addDays(date, 1))}`,
        `SUMMARY:${icsText(summary)}`,
        ...(desc ? [`DESCRIPTION:${icsText(desc)}`] : []),
        ...(d.recurrence !== "aucune" ? [`RRULE:FREQ=${d.recurrence === "mensuelle" ? "MONTHLY" : "YEARLY"}`] : []),
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(summary)}`, `TRIGGER:-P${ALERT_DAYS}D`, "END:VALARM",
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold75).join("\r\n") + "\r\n";
}

// ----- À lire plus tard ------------------------------------------------------------------------------

/** Liens ajoutés il y a plus de 30 jours : supprimés (lus ou non). */
export function purgeBookmarks(list: Bookmark[], now: number): Bookmark[] {
  return list.filter((b) => now - b.addedAt < KEEP_DAYS * DAY);
}

export const daysLeft = (b: Bookmark, now: number) => Math.max(0, KEEP_DAYS - Math.floor((now - b.addedAt) / DAY));

/** « garde exemple.fr/article pour le mémoire » → lien (https:// ajouté) et raison. */
export function parseBookmark(arg: string): { url: string | null; reason: string } {
  const [first = "", ...rest] = arg.trim().split(/\s+/);
  const url = normalizeUrl(first);
  if (!url) return { url: null, reason: arg.trim() };
  return { url, reason: rest.join(" ").replace(/^(pour|car|:|-)\s+/i, "") };
}

export function normalizeUrl(input: string): string | null {
  let s = input.trim().replace(/^<|>$/g, "");
  if (!s || /\s/.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) {
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#:].*)?$/i.test(s)) return null;
    s = `https://${s}`;
  }
  try {
    const u = new URL(s);
    return u.hostname.includes(".") || u.hostname === "localhost" ? u.toString() : null;
  } catch { return null; }
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

// ----- Entretien irrégulier --------------------------------------------------------------------------

export interface ChoreStatus { last: number | null; days: number | null; late: boolean; soon: boolean }

export function choreStatus(c: Chore, now: number): ChoreStatus {
  const last = c.done.at(-1) ?? null;
  if (last === null) return { last, days: null, late: true, soon: false };
  // (horloge de l'ordinateur reculée : jamais de « il y a -3 jours »)
  const days = Math.max(0, daysBetween(iso(last), iso(now)));
  return { last, days, late: days > c.intervalDays, soon: days > c.intervalDays * 0.8 && days <= c.intervalDays };
}

/** Les tâches en retard d'abord (les plus en retard en premier), puis celles qui approchent. */
export function sortChores(list: Chore[], now: number): Chore[] {
  const ratio = (c: Chore) => { const s = choreStatus(c, now); return s.days === null ? Infinity : s.days / c.intervalDays; };
  return [...list].sort((a, b) => ratio(b) - ratio(a) || a.name.localeCompare(b.name, "fr"));
}

export function sinceText(days: number | null): string {
  if (days === null) return "jamais fait";
  if (days === 0) return "fait aujourd'hui";
  if (days === 1) return "fait hier";
  if (days < 60) return `il y a ${days} jours`;
  if (days < 730) return `il y a ${Math.round(days / 30.4)} mois`;
  return `il y a ${Math.floor(days / 365)} ans`;
}

// ----- Fichiers récents ------------------------------------------------------------------------------

export interface RecentFile { path: string; name: string; folder: string; created: number; size: number }

/** Les `n` fichiers les plus récemment créés. */
export function latest(files: RecentFile[], n = 20): RecentFile[] {
  return [...files].sort((a, b) => b.created - a.created).slice(0, n);
}

/** Fichiers ignorés : téléchargements en cours, fichiers cachés ou système. */
export const ignoredFile = (name: string) => /^(\.|~\$|desktop\.ini$|thumbs\.db$)/i.test(name) || /\.(crdownload|part|tmp|partial|download)$/i.test(name);
