// Mails de la fac partagés à la main (texte collé ou fichier .eml enregistré depuis le webmail Partage) :
// lecture du message, puis recherche de ce qui touche les journées (salle, annulation, report, examen, devoir).
// Rien n'est appliqué ici : ces fonctions produisent des propositions que Rayan valide ou ignore.
// Fonctions pures, sans accès réseau : l'analyse se fait sur l'ordinateur, avec des règles simples.

import { slot, type Course } from "./ics.ts";

export interface MailInfo {
  from: string;
  subject: string;
  /** Date d'envoi si elle a pu être lue, sinon null. */
  date: number | null;
  body: string;
}

export type ProposalKind = "salle" | "annulation" | "horaire" | "examen" | "devoir";
export type ProposalStatus = "a-valider" | "deja-a-jour" | "appliquee" | "ignoree";

export interface Proposal {
  id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  /** Ce que le mail annonce, en une phrase. */
  summary: string;
  courseUid?: string;
  courseTitle?: string;
  courseStart?: number;
  /** Valeur actuelle dans ADE et valeur annoncée par le mail. */
  before?: string;
  after?: string;
  newRoom?: string;
  newStart?: number;
  newEnd?: number;
  deadlineAt?: number;
  deadlineTitle?: string;
}

// ----- Lecture du message ----------------------------------------------------------------------------

function decodeBytes(bytes: Uint8Array, charset = "utf-8"): string {
  try { return new TextDecoder(charset.toLowerCase().replace(/^"|"$/g, ""), { fatal: false }).decode(bytes); } catch { return new TextDecoder().decode(bytes); }
}
const b64 = (s: string) => Uint8Array.from(atob(s.replace(/[^A-Za-z0-9+/=]/g, "")), (c) => c.charCodeAt(0));
function qp(s: string, header = false): Uint8Array {
  const src = (header ? s.replace(/_/g, " ") : s).replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(src.slice(i + 1, i + 3))) { out.push(parseInt(src.slice(i + 1, i + 3), 16)); i += 2; }
    else { const enc = new TextEncoder().encode(src[i]); out.push(...enc); }
  }
  return Uint8Array.from(out);
}
/** En-tête encodé (=?utf-8?Q?Changement_de_salle?=). */
export function decodeHeader(v: string): string {
  return v.replace(/\?=\s+=\?/g, "?==?").replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_, cs: string, enc: string, txt: string) =>
    decodeBytes(enc.toUpperCase() === "B" ? b64(txt) : qp(txt, true), cs));
}

function splitHeaders(raw: string): { headers: Record<string, string>; body: string } {
  const text = raw.replace(/\r\n?/g, "\n");
  const cut = text.indexOf("\n\n");
  const head = cut < 0 ? text : text.slice(0, cut);
  const headers: Record<string, string> = {};
  let last = "";
  for (const line of head.split("\n")) {
    if (/^[ \t]/.test(line) && last) { headers[last] += ` ${line.trim()}`; continue; }
    const m = /^([\w-]+):\s*(.*)$/.exec(line);
    if (m) { last = m[1].toLowerCase(); headers[last] = headers[last] ?? m[2]; }
  }
  return { headers, body: cut < 0 ? "" : text.slice(cut + 2) };
}
const param = (h: string | undefined, name: string) => new RegExp(`${name}="?([^";]+)"?`, "i").exec(h ?? "")?.[1];

const stripHtml = (h: string) => h.replace(/<(style|script)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(+n))
  .replace(/&([aeiouc])(acute|grave|circ|uml|cedil);/gi, (_, l: string, k: string) => `${l}${{ acute: "́", grave: "̀", circ: "̂", uml: "̈", cedil: "̧" }[k.toLowerCase()]}`.normalize("NFC"));

/** Texte d'une partie MIME (texte brut de préférence, sinon HTML sans balises). */
function partText(raw: string, depth = 0): { text: string; html: boolean } | null {
  const { headers, body } = splitHeaders(raw);
  const type = (headers["content-type"] ?? "text/plain").toLowerCase();
  if (type.startsWith("multipart/") && depth < 5) {
    const boundary = param(headers["content-type"], "boundary");
    if (!boundary) return null;
    const parts = body.split(`--${boundary}`).slice(1).filter((p) => !p.startsWith("--")).map((p) => partText(p.replace(/^\n/, ""), depth + 1)).filter((p) => p !== null);
    return parts.find((p) => !p.html) ?? parts[0] ?? null;
  }
  if (!type.startsWith("text/")) return null;
  const enc = (headers["content-transfer-encoding"] ?? "").toLowerCase();
  const cs = param(headers["content-type"], "charset") ?? "utf-8";
  const bytes = enc === "base64" ? b64(body) : enc === "quoted-printable" ? qp(body) : new TextEncoder().encode(body);
  const text = enc === "base64" || enc === "quoted-printable" || cs.toLowerCase() !== "utf-8" ? decodeBytes(bytes, cs) : body;
  return type.startsWith("text/html") ? { text: stripHtml(text), html: true } : { text, html: false };
}

const looksLikeEml = (t: string) => /^(Return-Path|Received|From|Date|Subject|Message-ID|MIME-Version|Delivered-To|To):/im.test(t.slice(0, 2000)) && /^(From|Subject):/im.test(t.slice(0, 4000)) && /\r?\n\r?\n/.test(t);

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Message collé depuis le webmail (lignes « De : », « Objet : », « Date : » si présentes) ou fichier .eml. */
export function parseMailInput(input: string): MailInfo {
  const raw = input.replace(/^﻿/, "");
  if (!raw.trim()) throw new Error("message vide");
  if (looksLikeEml(raw)) {
    const { headers } = splitHeaders(raw);
    const part = partText(raw);
    const d = headers.date ? Date.parse(headers.date) : NaN;
    return { from: decodeHeader(headers.from ?? ""), subject: decodeHeader(headers.subject ?? ""), date: Number.isFinite(d) ? d : null, body: (part?.text ?? "").trim() };
  }
  // Texte collé : on reconnaît les lignes d'en-tête du webmail en tête du message.
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  let from = "", subject = "", date: number | null = null, i = 0;
  for (; i < Math.min(lines.length, 12); i++) {
    const m = /^\s*(De|From|Expéditeur|Objet|Subject|Date|Envoyé|À|A|To|Cc)\s*:\s*(.*)$/i.exec(lines[i]);
    if (!m) { if (lines[i].trim() === "" && (from || subject)) continue; if (from || subject) break; else continue; }
    const k = m[1].toLowerCase();
    if (k === "de" || k === "from" || k === "expéditeur") from = m[2].trim();
    else if (k === "objet" || k === "subject") subject = m[2].trim();
    else if (k === "date" || k === "envoyé") date = parseFrenchDateTime(m[2]) ?? (Number.isFinite(Date.parse(m[2])) ? Date.parse(m[2]) : null);
  }
  const body = from || subject ? lines.slice(i).join("\n").trim() : raw.trim();
  return { from, subject, date, body };
}

/** « mar. 17 nov. 2026 08:02 », « 17/11/2026 08:02 » : date d'un en-tête collé. */
function parseFrenchDateTime(s: string): number | null {
  const t = norm(s);
  let m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\D+(\d{1,2})[:h](\d{2}))?/.exec(t);
  if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0)).getTime();
  m = /(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})(?:\D+(\d{1,2})[:h](\d{2}))?/.exec(t);
  if (m) { const mo = monthIndex(m[2]); if (mo >= 0) return new Date(+m[3], mo, +m[1], +(m[4] ?? 0), +(m[5] ?? 0)).getTime(); }
  return null;
}

/** Adresse de l'expéditeur, en minuscules (« Scolarité <scol@univ-rennes.fr> » → scol@univ-rennes.fr). */
export function senderAddress(from: string): string {
  return (/<([^>]+)>/.exec(from)?.[1] ?? /[\w.+-]+@[\w.-]+/.exec(from)?.[0] ?? from).trim().toLowerCase();
}

/** L'expéditeur fait-il partie de la liste (adresse exacte, ou domaine écrit « @domaine ») ? */
export function senderAllowed(from: string, allowed: string[]): boolean {
  const a = senderAddress(from);
  if (!a) return false;
  return allowed.some((x) => { const v = x.trim().toLowerCase(); return v && (v.startsWith("@") ? a.endsWith(v) : a === v); });
}

// ----- Recherche des informations ---------------------------------------------------------------------

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'");
const MOIS_N = MOIS.map(norm);
const monthIndex = (w: string) => MOIS_N.findIndex((m) => m.startsWith(w.replace(/\.$/, "")) && w.length >= 3);
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const DAY = 86_400_000;
const midnight = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

interface Found { day: number; index: number }

/** Jours cités dans le texte (« mardi 18 novembre », « 18/11 », « demain »…), dans l'ordre d'apparition. */
export function findDays(text: string, ref: number): Found[] {
  const t = norm(text);
  const out: Found[] = [];
  const base = midnight(ref);
  const withYear = (d: number, mo: number, y?: number) => {
    if (y !== undefined) return new Date(y < 100 ? 2000 + y : y, mo, d).getTime();
    const yr = new Date(ref).getFullYear();
    // L'année la plus proche après la date de référence (moins une semaine) : un mail de décembre peut parler de janvier.
    const c = [yr - 1, yr, yr + 1].map((yy) => new Date(yy, mo, d).getTime()).filter((x) => x >= base - 7 * DAY);
    return Math.min(...c);
  };
  for (const m of t.matchAll(/(?:\b(?:lun|mar|mer|jeu|ven|sam|dim)[a-z]*\.?\s+)?\b(\d{1,2})(?:er)?\s+([a-z]{3,9})\.?(?:\s+(\d{4}))?/g)) {
    const mo = monthIndex(m[2]);
    if (mo >= 0 && +m[1] >= 1 && +m[1] <= 31) out.push({ day: withYear(+m[1], mo, m[3] ? +m[3] : undefined), index: m.index! });
  }
  for (const m of t.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    if (+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) out.push({ day: withYear(+m[1], +m[2] - 1, m[3] ? +m[3] : undefined), index: m.index! });
  }
  for (const m of t.matchAll(/\b(aujourd'hui|demain|apres-demain)\b/g)) {
    out.push({ day: base + (m[1] === "demain" ? DAY : m[1] === "apres-demain" ? 2 * DAY : 0), index: m.index! });
  }
  for (const m of t.matchAll(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b(?!\s+\d)/g)) {
    if (out.some((f) => Math.abs(f.index - m.index!) < 4)) continue;
    const target = JOURS.indexOf(m[1]);
    let d = base;
    for (let k = 0; k < 7 && new Date(d).getDay() !== target; k++) d += DAY;
    out.push({ day: midnight(d + 3 * 3_600_000), index: m.index! });
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Heures citées (« 10h15 », « 10 h », « 14:00 »), en minutes depuis minuit. */
export function findTimes(text: string): { minutes: number; index: number }[] {
  const out: { minutes: number; index: number }[] = [];
  for (const m of norm(text).matchAll(/\b([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?\b/g)) out.push({ minutes: +m[1] * 60 + +(m[2] ?? 0), index: m.index! });
  return out;
}

/** Salles citées (« salle 004 », « amphi B », « salle B12 du bâtiment 14 »), dans l'ordre d'apparition. */
export function findRooms(text: string): { room: string; index: number }[] {
  const out: { room: string; index: number }[] = [];
  const re = /\b(salle|amphi(?:th[ée]âtre|theatre)?|amphithéâtre)\s+(?:n°\s*|no\s*)?([A-Za-z0-9][\w.\-/]*)(?:[ ,]+(?:du |dans le |au )?(b[âa]t(?:iment|\.)?)\s*([A-Za-z0-9][\w.-]*))?/gi;
  for (const m of text.matchAll(re)) {
    const kind = /^amphi/i.test(m[1]) ? "Amphi" : "Salle";
    if (/^(de|du|des|le|la|les|en|a|à|est|sera|informatique|habituelle|prevue|prévue)$/i.test(m[2])) continue;
    out.push({ room: `${kind} ${m[2].replace(/[.,]$/, "")}${m[4] ? ` (bât. ${m[4].replace(/[.,]$/, "")})` : ""}`, index: m.index! });
  }
  return out;
}

/** Code de salle sans le décor, pour comparer « Salle 004 (bât. 14) » et « B14-004 » d'ADE. */
export const roomKey = (r: string) => norm(r).replace(/\b(salle|amphi\w*|bat\w*|batiment)\b/g, " ").match(/[a-z0-9]+/g)?.join(" ") ?? "";
export function sameRoom(mail: string, ade: string): boolean {
  const code = norm(mail).match(/^(?:salle|amphi)\s+([a-z0-9.\-/]+)/)?.[1];
  if (!code) return roomKey(mail) === roomKey(ade);
  const a = roomKey(ade);
  return a === roomKey(mail) || a.split(" ").includes(code) || new RegExp(`(^|[^a-z0-9])${code.replace(/[.\-/]/g, "\\$&")}($|[^a-z0-9])`).test(norm(ade));
}

const STOP = new Set(["cours", "salle", "amphi", "groupe", "groupes", "seance", "avec", "pour", "dans", "sera", "aura", "lieu", "demain", "semaine", "change", "changement", "annule", "annulation", "report", "examen", "etudiants", "bonjour", "cordialement", "merci", "information", "informations", "licence", "master", "universite", "rennes"]);
const tokens = (s: string) => new Set((norm(s).match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !STOP.has(w) && !/^\d+$/.test(w)));
const TYPES = ["cm", "td", "tp"];

/** Cours dont parle le mail : mots du titre retrouvés dans l'objet ou le texte, jour et heure s'ils sont cités. */
export function matchCourse(courses: Course[], mail: MailInfo, ref: number): Course | null {
  const text = `${mail.subject}\n${mail.body}`;
  const words = tokens(text);
  const typesInMail = new Set((norm(text).match(/\b(cm|td|tp)\b/g) ?? []));
  const days = findDays(text, ref).map((f) => f.day);
  const times = findTimes(text).map((f) => f.minutes);
  let best: { c: Course; score: number } | null = null;
  for (const c of courses) {
    if (c.end < ref - DAY || c.start > ref + 60 * DAY) continue;
    const tw = tokens(c.title);
    let score = [...tw].filter((w) => words.has(w)).length * 3;
    const ct = (norm(c.title).match(/\b(cm|td|tp)\b/) ?? [])[1];
    if (ct && TYPES.includes(ct) && typesInMail.size) score += typesInMail.has(ct) ? 1 : -2;
    const onDay = days.includes(midnight(c.start));
    const d = new Date(c.start);
    const atTime = times.includes(d.getHours() * 60 + d.getMinutes());
    if (days.length) score += onDay ? 3 : -1;
    if (atTime) score += 2;
    if (score <= 0) continue;
    // Sans jour cité, le prochain cours qui correspond l'emporte.
    if (!days.length && c.start < ref - 2 * 3_600_000) continue;
    if (!best || score > best.score || (score === best.score && Math.abs(c.start - ref) < Math.abs(best.c.start - ref))) best = { c, score };
  }
  // Un seul mot du titre ne suffit pas sans jour ni heure : trop d'erreurs possibles.
  if (best && best.score < 4 && !days.length && !times.length) return null;
  return best?.c ?? null;
}

/** Phrase(s) du message autour de l'information, pour l'extrait gardé dans l'app (280 caractères au plus). */
export function excerpt(body: string, kind: ProposalKind | null): string {
  const flat = body.replace(/\s+/g, " ").trim();
  const re = kind ? RE[kind] : /salle|annul|report|examen|rendre/;
  const at = norm(flat).search(re);
  const dot = at < 0 ? -1 : flat.lastIndexOf(". ", at);
  const from = dot < 0 ? 0 : dot + 2;
  // La phrase de l'information (et la suivante si elle est très courte), sans les formules de politesse.
  let end = flat.indexOf(". ", Math.max(at, from));
  if (end >= 0 && end - from < 60) { const next = flat.indexOf(". ", end + 2); end = next < 0 ? flat.length : next; }
  let s = flat.slice(from, end < 0 ? flat.length : end + 1).replace(/\s*\b(cordialement|bien (?:à vous|cordialement)|bonne (?:journée|soirée)|merci)\b[\s\S]*$/i, "").trim();
  if (s.length > 280) s = `${s.slice(0, 279).trimEnd()}…`;
  return s;
}

const RE = {
  annulation: /\b(annul\w*|n'aura pas lieu|ne pourra pas (?:avoir lieu|assurer)|supprim\w*|pas cours)\b/,
  horaire: /\b(report\w*|decal\w*|avance\w*|deplace\w* (?:au|a|le)|reprogramm\w*|aura lieu (?:le|a)|commencera)\b/,
  salle: /\b(salle|amphi\w*|batiment|bat\.)\b/,
  examen: /\b(examen\w*|partiel\w*|controle continu|controle|cc\d?|ds|rattrapage\w*|convocation\w*|epreuve\w*|soutenance\w*|oral|interrogation)\b/,
  devoir: /\b(a rendre|rendu\w*|depot|deposer|a deposer|date limite|deadline|a remettre|remise)\b/,
};

let counter = 0;
const newId = (now: number) => `p${now.toString(36)}${(counter++).toString(36)}`;

/**
 * Propositions tirées d'un mail. `courses` est l'emploi du temps actuel (ADE, corrections comprises) ; `ref` est la
 * date du mail (ou maintenant). Une proposition déjà vraie dans l'emploi du temps est marquée « déjà à jour ».
 */
export function analyzeMail(mail: MailInfo, courses: Course[], ref: number): Proposal[] {
  const text = `${mail.subject}\n${mail.body}`;
  const t = norm(text);
  const out: Proposal[] = [];
  const course = matchCourse(courses, mail, ref);
  const base = (kind: ProposalKind): Proposal => ({ id: newId(ref), kind, status: "a-valider", summary: "", ...(course ? { courseUid: course.uid, courseTitle: course.title, courseStart: course.start } : {}) });

  if (course && RE.annulation.test(t)) {
    out.push({ ...base("annulation"), summary: `${course.title} du ${slot(course.start, course.end)} est annulé.`, before: slot(course.start, course.end), after: "Annulé" });
    return out;
  }

  if (course && RE.horaire.test(t)) {
    const days = findDays(text, ref).map((f) => f.day);
    const times = findTimes(text).map((f) => f.minutes);
    const cd = new Date(course.start);
    const curMin = cd.getHours() * 60 + cd.getMinutes();
    const newMin = times.find((m) => m !== curMin);
    const newDay = days.find((d) => d !== midnight(course.start)) ?? midnight(course.start);
    if (newMin !== undefined || newDay !== midnight(course.start)) {
      const start = newDay + (newMin ?? curMin) * 60_000;
      const end = start + (course.end - course.start);
      if (start !== course.start) out.push({ ...base("horaire"), summary: `${course.title} passe au ${slot(start, end)}.`, before: slot(course.start, course.end), after: slot(start, end), newStart: start, newEnd: end });
    }
  }

  if (course && RE.salle.test(t)) {
    const rooms = findRooms(text);
    if (rooms.length) {
      // « au lieu de la salle B12 », « de la salle B12 vers… » : l'ancienne salle, à écarter.
      const old = (r: { room: string; index: number }) => {
        const before = norm(text.slice(Math.max(0, r.index - 30), r.index));
        const after = norm(text.slice(r.index, r.index + r.room.length + 25));
        return /(au lieu de|initialement|habituel\w*|ancienne|plutot que|et non|prevu\w*)\s*(?:en |dans |a )?(?:la |l')?$/.test(before)
          || /^\S+(?:\s+\S+){0,4}?\s+(vers|->|→|est remplace)/.test(after) || /\bde (?:la )?$/.test(before);
      };
      const fresh = rooms.filter((r) => !old(r));
      const target = (fresh.length ? fresh : rooms).at(-1)!;
      if (!course.room || !sameRoom(target.room, course.room)) out.push({ ...base("salle"), summary: `${course.title} du ${slot(course.start, course.end)} a lieu en ${target.room}.`, before: course.room || "sans salle", after: target.room, newRoom: target.room });
      else out.push({ ...base("salle"), status: "deja-a-jour", summary: `${course.title} : la salle du mail (${target.room}) est déjà celle d'ADE.`, before: course.room, after: course.room });
    }
  }

  for (const kind of ["examen", "devoir"] as const) {
    const m = RE[kind].exec(t);
    if (!m) continue;
    const days = findDays(text, ref);
    if (!days.length) continue;
    // Le jour cité le plus près du mot-clé.
    const day = days.reduce((a, b) => (Math.abs(b.index - m.index) < Math.abs(a.index - m.index) ? b : a));
    const time = findTimes(text).filter((x) => x.index > day.index - 40).sort((a, b) => Math.abs(a.index - day.index) - Math.abs(b.index - day.index))[0];
    const at = day.day + (time ? time.minutes : kind === "devoir" ? 23 * 60 + 59 : 0) * 60_000;
    // L'objet du mail décrit mieux l'épreuve que le titre du cours (« Partiel d'analyse » plutôt que « TD Analyse »).
    const what = mail.subject.replace(/^((re|tr|fwd?)\s*:\s*)+/i, "").trim() || course?.title || (kind === "examen" ? "Examen" : "Devoir");
    const title = kind === "examen" ? `Examen : ${what}` : `À rendre : ${what}`;
    const when = new Date(at).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", ...(time || kind === "devoir" ? { hour: "2-digit", minute: "2-digit" } : {}) });
    out.push({ ...base(kind), summary: `${title}, ${when}.`, after: when, deadlineAt: at, deadlineTitle: title });
  }
  return out;
}
