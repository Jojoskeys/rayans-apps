// Emploi du temps de l'Université de Rennes : lecture de l'abonnement iCalendar généré par ADE
// (Partager → Agenda → URL), et comparaison de deux téléchargements pour repérer ce qui a changé.
// Fonctions pures : le texte du flux est passé en paramètre.

export interface Course {
  /** Identifiant donné par ADE : il ne change pas quand le cours est modifié, ce qui évite les doublons. */
  uid: string;
  start: number;
  end: number;
  title: string;
  room: string;
  /** Description d'ADE (groupes, enseignant), sans la ligne « Exporté le » qui change à chaque téléchargement. */
  details: string;
}

export type ChangeKind = "salle" | "horaire" | "ajout" | "suppression";

export interface CourseChange {
  uid: string;
  kind: ChangeKind;
  title: string;
  /** Début du cours après le changement (ou avant, pour un cours supprimé). */
  start: number;
  before: string;
  after: string;
  detectedAt: number;
}

const unescape = (v: string) => v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));

/** Lignes logiques du fichier : une ligne qui commence par un espace ou une tabulation continue la précédente. */
function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) out[out.length - 1] += line.slice(1);
    else if (line) out.push(line);
  }
  return out;
}

/** Date iCalendar : 20261117T091500Z (UTC, ce qu'ADE envoie), 20261117T101500 (heure locale) ou 20261117 (journée). */
export function parseIcsDate(v: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", z] = m;
  const args = [+y, +mo - 1, +d, +h, +mi, +s] as const;
  return z ? Date.UTC(...args) : new Date(...args).getTime();
}

function cleanDetails(desc: string): string {
  return desc.split("\n").map((l) => l.trim()).filter((l) => l && !/^\(?export[ée] le/i.test(l)).join("\n");
}

/** Cours du flux, un seul par identifiant (si ADE en répète un, la version au SEQUENCE le plus haut est gardée). */
export function parseIcs(text: string): Course[] {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("ce n'est pas un calendrier iCalendar");
  const byUid = new Map<string, { c: Course; seq: number }>();
  let cur: Record<string, string> | null = null;
  for (const line of unfold(text)) {
    if (/^BEGIN:VEVENT$/i.test(line)) { cur = {}; continue; }
    if (/^END:VEVENT$/i.test(line)) {
      if (cur) {
        const start = parseIcsDate(cur.DTSTART ?? "");
        const end = parseIcsDate(cur.DTEND ?? "") ?? start;
        const uid = cur.UID?.trim();
        if (uid && start !== null && end !== null) {
          const c: Course = { uid, start, end, title: unescape(cur.SUMMARY ?? "").trim() || "Cours", room: unescape(cur.LOCATION ?? "").trim(), details: cleanDetails(unescape(cur.DESCRIPTION ?? "")) };
          const seq = Number(cur.SEQUENCE) || 0;
          const prev = byUid.get(uid);
          if (!prev || seq >= prev.seq) byUid.set(uid, { c, seq });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).split(";")[0].toUpperCase();
    if (!(name in cur)) cur[name] = line.slice(colon + 1);
  }
  return [...byUid.values()].map((v) => v.c).sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}

const hm = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (t: number) => new Date(t).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
export const slot = (start: number, end: number) => `${dayLabel(start)} ${hm(start)}–${hm(end)}`;

/**
 * Ce qui a changé entre deux téléchargements, pour les cours pas encore terminés. Un cours absent du nouveau flux
 * n'est compté comme supprimé que s'il tombe dans la période couverte par ce flux (sinon il en est simplement sorti).
 */
export function diffCourses(prev: Course[], next: Course[], now: number): CourseChange[] {
  if (!prev.length) return [];
  const out: CourseChange[] = [];
  const nextBy = new Map(next.map((c) => [c.uid, c]));
  const prevBy = new Map(prev.map((c) => [c.uid, c]));
  const first = next.length ? next[0].start : Infinity;
  const last = next.length ? Math.max(...next.map((c) => c.start)) : -Infinity;
  const base = { detectedAt: now };
  for (const n of next) {
    if (n.end < now) continue;
    const p = prevBy.get(n.uid);
    if (!p) { out.push({ ...base, uid: n.uid, kind: "ajout", title: n.title, start: n.start, before: "", after: `${slot(n.start, n.end)}${n.room ? ` · ${n.room}` : ""}` }); continue; }
    if (p.start !== n.start || p.end !== n.end) out.push({ ...base, uid: n.uid, kind: "horaire", title: n.title, start: n.start, before: slot(p.start, p.end), after: slot(n.start, n.end) });
    if (p.room !== n.room) out.push({ ...base, uid: n.uid, kind: "salle", title: n.title, start: n.start, before: p.room || "sans salle", after: n.room || "sans salle" });
  }
  for (const p of prev) {
    if (p.end < now || nextBy.has(p.uid) || p.start < first || p.start > last) continue;
    out.push({ ...base, uid: p.uid, kind: "suppression", title: p.title, start: p.start, before: `${slot(p.start, p.end)}${p.room ? ` · ${p.room}` : ""}`, after: "" });
  }
  return out;
}

/** Garde les changements des cours pas encore passés, en remplaçant ceux du même cours et du même type. */
export function mergeChanges(old: CourseChange[], fresh: CourseChange[], now: number): CourseChange[] {
  const key = (c: CourseChange) => `${c.uid}|${c.kind === "suppression" || c.kind === "ajout" ? "existence" : c.kind}`;
  const m = new Map<string, CourseChange>();
  for (const c of old) if (c.start > now - 86_400_000) m.set(key(c), c);
  for (const c of fresh) {
    const k = key(c);
    const prev = m.get(k);
    // Un changement annulé ensuite (retour à la salle d'origine) disparaît.
    if (prev && prev.before === c.after && c.kind !== "ajout" && c.kind !== "suppression") { m.delete(k); continue; }
    if (prev && ((prev.kind === "ajout" && c.kind === "suppression") || (prev.kind === "suppression" && c.kind === "ajout"))) { m.delete(k); continue; }
    m.set(k, prev && c.kind !== "ajout" && c.kind !== "suppression" ? { ...c, before: prev.before } : c);
  }
  return [...m.values()].sort((a, b) => a.start - b.start);
}

/** Vérifie l'adresse avant de la télécharger : https seulement. */
export function checkIcsUrl(raw: string): string {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new Error("adresse invalide : colle l'URL donnée par ADE (Partager → Agenda)"); }
  if (u.protocol !== "https:") throw new Error("l'adresse doit commencer par https://");
  return u.toString();
}

/** Adresse raccourcie pour l'affichage : elle donne accès au planning sans connexion, on n'en montre pas la fin. */
export function maskUrl(raw: string): string {
  try { const u = new URL(raw); return `${u.host}/…${u.pathname.slice(-4)}`; } catch { return "…"; }
}
