// Données « Fac » d'Aujourd'hui : emploi du temps ADE, changements repérés, mails partagés, propositions,
// corrections validées et échéances. Fonctions pures : le processus principal s'occupe du réseau et du fichier.

import { diffCourses, mergeChanges, slot, type Course, type CourseChange } from "./ics.ts";
import { analyzeMail, excerpt, sameRoom, senderAddress, senderAllowed, type MailInfo, type Proposal } from "./mail.ts";

/** Mail partagé : seul ce qui sert à retrouver le message est gardé, pas son texte complet. */
export interface SharedMail {
  id: string;
  from: string;
  subject: string;
  date: number | null;
  addedAt: number;
  excerpt: string;
  /** Expéditeur absent de la liste choisie dans les réglages. */
  unknownSender: boolean;
  proposals: Proposal[];
  /** Lu automatiquement dans la boîte mail (IMAP), et non partagé à la main. */
  imap?: boolean;
  /** Propositions appliquées sans validation (expéditeur autorisé, cours reconnu). */
  auto?: boolean;
}

/** Correction validée par Rayan d'après un mail. `adeBefore` : la valeur d'ADE au moment de la validation. */
export interface Override {
  courseUid: string;
  mailId: string;
  proposalId: string;
  kind: "salle" | "annulation" | "horaire";
  room?: string;
  start?: number;
  end?: number;
  cancelled?: boolean;
  adeBefore: string;
  /** ADE a changé depuis, vers une autre valeur que celle du mail : à trancher. */
  conflict?: string;
}

export interface Deadline {
  id: string;
  title: string;
  at: number;
  kind: "examen" | "devoir";
  mailId: string;
}

export interface FacData {
  icsUrl: string;
  allowedSenders: string[];
  courses: Course[];
  changes: CourseChange[];
  lastFetch: number;
  lastError: string | null;
  mails: SharedMail[];
  overrides: Override[];
  deadlines: Deadline[];
  /**
   * Groupes gardés (noms tels qu'ADE les écrit dans la description des cours). Vide : tout le flux est gardé.
   * Utile quand le lien ADE couvre tout un parcours : on ne garde que ses propres groupes et le tronc commun.
   */
  groups: string[];
  /** Groupes trouvés dans le dernier téléchargement, avec leur nombre de cours, pour les réglages. */
  availableGroups: { name: string; count: number }[];
}

export const EMPTY_FAC: FacData = { icsUrl: "", allowedSenders: [], courses: [], changes: [], lastFetch: 0, lastError: null, mails: [], overrides: [], deadlines: [], groups: [], availableGroups: [] };

/** Une ligne de description ADE est-elle un enseignant (« NOM Prénom ») ou une mention technique ? */
const notGroup = (l: string) => /^\(?(updated|export)/i.test(l) || /^[A-ZÀ-ÖØ-Þ' -]{2,} [A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]/.test(l) || l.length > 60;
/** Groupes cités dans la description d'un cours. */
export const courseGroups = (c: Course) => c.details.split("\n").map((l) => l.trim()).filter((l) => l && !notGroup(l));

/** Créneaux qui ne sont pas des cours (pause méridienne). */
const NOT_A_COURSE = /^pause\b/i;

/** Cours gardés : hors pauses, et, si des groupes sont choisis, ceux d'au moins un de ces groupes. */
export function filterCourses(all: Course[], groups: string[]): Course[] {
  const set = new Set(groups);
  return all.filter((c) => !NOT_A_COURSE.test(c.title) && (!set.size || courseGroups(c).some((g) => set.has(g))));
}

export function listGroups(all: Course[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const c of all) for (const g of courseGroups(c)) m.set(g, (m.get(g) ?? 0) + 1);
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

const DAY = 86_400_000;
/** Durée de conservation des mails partagés et des cours passés. */
export const KEEP_MAILS_DAYS = 30;
export const KEEP_PAST_COURSES_DAYS = 1;

/** Valeur d'ADE comparée à une correction. */
function adeValue(c: Course, kind: Override["kind"]): string {
  return kind === "salle" ? c.room : kind === "horaire" ? `${c.start}-${c.end}` : "existe";
}

/**
 * Nouveau téléchargement ADE : changements repérés, et corrections revues. Une correction disparaît quand ADE
 * donne la même valeur que le mail ; elle passe en conflit quand ADE change vers une troisième valeur.
 */
export function applyFetch(d: FacData, all: Course[], now: number): FacData {
  const next = filterCourses(all, d.groups);
  const fresh = diffCourses(d.courses, next, now);
  const by = new Map(next.map((c) => [c.uid, c]));
  const overrides: Override[] = [];
  for (const o of d.overrides) {
    const c = by.get(o.courseUid);
    if (!c) {
      // Cours retiré d'ADE : une annulation validée est confirmée, le reste n'a plus d'objet.
      continue;
    }
    if (o.kind === "salle" && c.room && sameRoom(o.room ?? "", c.room)) continue;
    if (o.kind === "horaire" && c.start === o.start && c.end === o.end) continue;
    const v = adeValue(c, o.kind);
    if (v !== o.adeBefore && o.kind !== "annulation") overrides.push({ ...o, conflict: o.kind === "salle" ? c.room || "sans salle" : slot(c.start, c.end) });
    else overrides.push(o);
  }
  return { ...d, courses: next.filter((c) => c.end > now - KEEP_PAST_COURSES_DAYS * DAY), changes: mergeChanges(d.changes, fresh, now), lastFetch: now, lastError: null, overrides, availableGroups: listGroups(all) };
}

export interface DisplayCourse extends Course {
  /** Valeurs d'ADE remplacées par une correction validée. */
  ade?: { room?: string; slot?: string };
  corrected?: Override["kind"];
  cancelled?: boolean;
  conflict?: string;
  mailId?: string;
  changes: CourseChange[];
}

/** Emploi du temps affiché : ADE, puis les corrections validées par-dessus. */
export function displayCourses(d: FacData): DisplayCourse[] {
  const ov = new Map<string, Override[]>();
  for (const o of d.overrides) ov.set(o.courseUid, [...(ov.get(o.courseUid) ?? []), o]);
  const ch = new Map<string, CourseChange[]>();
  for (const c of d.changes) ch.set(c.uid, [...(ch.get(c.uid) ?? []), c]);
  const out: DisplayCourse[] = d.courses.map((c) => {
    const r: DisplayCourse = { ...c, changes: (ch.get(c.uid) ?? []).filter((x) => x.kind !== "suppression") };
    for (const o of ov.get(c.uid) ?? []) {
      r.corrected = o.kind;
      r.mailId = o.mailId;
      if (o.conflict) r.conflict = o.conflict;
      if (o.kind === "salle" && o.room) { r.ade = { ...r.ade, room: c.room }; r.room = o.room; }
      if (o.kind === "horaire" && o.start !== undefined && o.end !== undefined) { r.ade = { ...r.ade, slot: slot(c.start, c.end) }; r.start = o.start; r.end = o.end; }
      if (o.kind === "annulation") r.cancelled = true;
    }
    return r;
  });
  return out.sort((a, b) => a.start - b.start);
}

/** Cours retirés d'ADE (pas encore passés) : affichés barrés dans la journée concernée. */
export function removedCourses(d: FacData): CourseChange[] {
  return d.changes.filter((c) => c.kind === "suppression");
}

/** Ajoute un mail partagé et ses propositions. */
export function addMail(d: FacData, mail: MailInfo, now: number): { data: FacData; mail: SharedMail } {
  const ref = mail.date ?? now;
  const courses = displayCourses(d).filter((c) => !c.cancelled);
  const proposals = analyzeMail(mail, courses, ref);
  const id = `m${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const shared: SharedMail = {
    id, from: mail.from, subject: mail.subject, date: mail.date, addedAt: now,
    excerpt: excerpt(mail.body, proposals.find((p) => p.status === "a-valider")?.kind ?? proposals[0]?.kind ?? null),
    unknownSender: !senderAllowed(mail.from, d.allowedSenders),
    proposals,
  };
  return { data: { ...d, mails: [shared, ...d.mails] }, mail: shared };
}

/** Rayan valide une proposition : correction du cours ou nouvelle échéance. */
export function acceptProposal(d: FacData, mailId: string, proposalId: string): FacData {
  const mail = d.mails.find((m) => m.id === mailId);
  const p = mail?.proposals.find((x) => x.id === proposalId);
  if (!mail || !p) throw new Error("proposition introuvable");
  if (p.status !== "a-valider") return d;
  let overrides = d.overrides;
  let deadlines = d.deadlines;
  if (p.kind === "examen" || p.kind === "devoir") {
    if (p.deadlineAt === undefined) throw new Error("date manquante");
    deadlines = [...deadlines.filter((x) => !(x.title === p.deadlineTitle && x.at === p.deadlineAt)), { id: p.id, title: p.deadlineTitle ?? "Échéance", at: p.deadlineAt, kind: p.kind, mailId }].sort((a, b) => a.at - b.at);
  } else {
    const c = d.courses.find((x) => x.uid === p.courseUid);
    if (!c) throw new Error("ce cours n'est plus dans l'emploi du temps");
    const o: Override = { courseUid: c.uid, mailId, proposalId: p.id, kind: p.kind, adeBefore: adeValue(c, p.kind) };
    if (p.kind === "salle") o.room = p.newRoom;
    if (p.kind === "horaire") { o.start = p.newStart; o.end = p.newEnd; }
    if (p.kind === "annulation") o.cancelled = true;
    overrides = [...overrides.filter((x) => !(x.courseUid === c.uid && x.kind === p.kind)), o];
  }
  return { ...d, overrides, deadlines, mails: setStatus(d.mails, mailId, proposalId, "appliquee") };
}

/**
 * Mail d'un expéditeur autorisé : applique directement chaque proposition qui vise un cours précis (ou une échéance
 * datée). Les autres restent à valider. Renvoie les propositions appliquées (pour la notification).
 */
export function appliquerAutomatiquement(d: FacData, mailId: string): { data: FacData; appliquees: Proposal[] } {
  const mail = d.mails.find((m) => m.id === mailId);
  if (!mail || mail.unknownSender) return { data: d, appliquees: [] };
  let data = d;
  const appliquees: Proposal[] = [];
  for (const p of mail.proposals) {
    if (p.status !== "a-valider") continue;
    const sur = p.kind === "examen" || p.kind === "devoir" ? p.deadlineAt !== undefined : !!p.courseUid && d.courses.some((c) => c.uid === p.courseUid);
    if (!sur) continue;
    try {
      data = acceptProposal(data, mailId, p.id);
      appliquees.push(p);
    } catch { /* cours disparu entre-temps : laissé à valider */ }
  }
  if (appliquees.length) data = { ...data, mails: data.mails.map((m) => (m.id === mailId ? { ...m, auto: true } : m)) };
  return { data, appliquees };
}

export function ignoreProposal(d: FacData, mailId: string, proposalId: string): FacData {
  return { ...d, mails: setStatus(d.mails, mailId, proposalId, "ignoree") };
}

/** Conflit tranché : `keep` = "ade" retire la correction, "mail" la garde en prenant la nouvelle valeur d'ADE comme référence. */
export function resolveConflict(d: FacData, courseUid: string, keep: "ade" | "mail"): FacData {
  const c = d.courses.find((x) => x.uid === courseUid);
  return {
    ...d,
    overrides: keep === "ade" ? d.overrides.filter((o) => o.courseUid !== courseUid)
      : d.overrides.map((o) => (o.courseUid === courseUid && c ? { ...o, conflict: undefined, adeBefore: adeValue(c, o.kind) } : o)),
  };
}

/** Annule une correction validée (le cours reprend les valeurs d'ADE). */
export function removeOverride(d: FacData, courseUid: string): FacData {
  const removed = d.overrides.filter((o) => o.courseUid === courseUid);
  return { ...d, overrides: d.overrides.filter((o) => o.courseUid !== courseUid), mails: removed.reduce((m, o) => setStatus(m, o.mailId, o.proposalId, "a-valider"), d.mails) };
}

export function removeDeadline(d: FacData, id: string): FacData {
  const x = d.deadlines.find((v) => v.id === id);
  return { ...d, deadlines: d.deadlines.filter((v) => v.id !== id), mails: x ? setStatus(d.mails, x.mailId, x.id, "a-valider") : d.mails };
}

export function removeMail(d: FacData, mailId: string): FacData {
  return { ...d, mails: d.mails.filter((m) => m.id !== mailId) };
}

function setStatus(mails: SharedMail[], mailId: string, proposalId: string, status: Proposal["status"]): SharedMail[] {
  return mails.map((m) => (m.id !== mailId ? m : { ...m, proposals: m.proposals.map((p) => (p.id === proposalId ? { ...p, status } : p)) }));
}

/** Ménage : mails de plus de 30 jours, échéances passées depuis un jour, changements de cours terminés. */
export function prune(d: FacData, now: number): FacData {
  const used = new Set([...d.overrides.map((o) => o.mailId), ...d.deadlines.filter((x) => x.at > now - DAY).map((x) => x.mailId)]);
  return {
    ...d,
    mails: d.mails.filter((m) => m.addedAt > now - KEEP_MAILS_DAYS * DAY || used.has(m.id)),
    deadlines: d.deadlines.filter((x) => x.at > now - DAY),
    changes: d.changes.filter((c) => c.start > now - DAY),
  };
}

/** Relit le fichier en ignorant ce qui n'a pas la bonne forme. */
export function sanitizeFac(raw: unknown): FacData {
  const r = (raw ?? {}) as Partial<FacData>;
  const arr = <T>(v: unknown, ok: (x: any) => boolean): T[] => (Array.isArray(v) ? v.filter(ok) : []);
  return {
    icsUrl: typeof r.icsUrl === "string" ? r.icsUrl : "",
    allowedSenders: arr<string>(r.allowedSenders, (x) => typeof x === "string"),
    courses: arr<Course>(r.courses, (x) => x && typeof x.uid === "string" && Number.isFinite(x.start) && Number.isFinite(x.end)),
    changes: arr<CourseChange>(r.changes, (x) => x && typeof x.uid === "string" && typeof x.kind === "string"),
    lastFetch: Number.isFinite(r.lastFetch) ? (r.lastFetch as number) : 0,
    lastError: typeof r.lastError === "string" ? r.lastError : null,
    mails: arr<SharedMail>(r.mails, (x) => x && typeof x.id === "string" && Array.isArray(x.proposals)),
    overrides: arr<Override>(r.overrides, (x) => x && typeof x.courseUid === "string"),
    deadlines: arr<Deadline>(r.deadlines, (x) => x && typeof x.id === "string" && Number.isFinite(x.at)),
    groups: arr<string>(r.groups, (x) => typeof x === "string"),
    availableGroups: arr<{ name: string; count: number }>(r.availableGroups, (x) => x && typeof x.name === "string" && Number.isFinite(x.count)),
  };
}

export { senderAddress };
