// Les données de Rayan's Lecture (un seul fichier JSON, synchronisé avec l'iPhone).
import { EXOS, NIVEAU_MAX, NIVEAU_MIN, startLevel, type ExoId, type Level } from "./niveaux.ts";
import type { Niveau } from "./types.ts";

export type SorteResultat = ExoId | "test" | "rsvp";

/** Un exercice fait (jamais modifié ensuite : les résultats s'additionnent à la fusion). */
export interface Resultat {
  id: string;
  exo: SorteResultat;
  texteId: string;
  niveau: Niveau;
  at: number;
  /** Lecture chronométrée et tests : mots du texte, durée de lecture (ms) et mots par minute. RSVP : vitesse imposée. */
  mots?: number;
  ms?: number;
  mpm?: number;
  /** Questions (ou points) réussies sur le total ; `part` entre 0 et 1. */
  bonnes: number;
  total: number;
  part: number;
  /** Fait dans la séance du jour. */
  seance?: boolean;
  /** Test de départ ou de suivi hebdomadaire. */
  test?: "depart" | "suivi";
  /** « Ce que je sais déjà », noté avant de lire. */
  dejaSu?: string;
}

/** Résumé écrit de mémoire, avec les idées clés cochées. */
export interface Resume {
  id: string;
  texteId: string;
  at: number;
  texte: string;
  /** Indices des idées clés présentes (confirmées par toi). */
  idees: number[];
  total: number;
}

/** Notes prises sur un texte (modifiables : la version la plus récente gagne). */
export interface Note {
  id: string;
  texteId: string;
  texte: string;
  at: number;
  maj: number;
  supprime?: boolean;
}

export interface Reglages {
  /** Durée de la séance du jour, en minutes. */
  minutes: 5 | 10 | 15 | 20;
  /** L'heure à laquelle un nouveau jour commence (série et séance). */
  heureJour: number;
  /** La présentation du premier lancement a été vue. */
  accueilVu: boolean;
  maj: number;
}

export interface Db {
  format: "rayans-lecture";
  version: 1;
  niveaux: Record<ExoId, Level>;
  resultats: Resultat[];
  resumes: Resume[];
  notes: Note[];
  /** Séances par jour (AAAA-MM-JJ) : étapes terminées. */
  seances: Record<string, { etapes: string[]; fin?: number }>;
  reglages: Reglages;
}

export const REGLAGES_DEFAUT: Reglages = { minutes: 10, heureJour: 4, accueilVu: false, maj: 0 };

export function emptyDb(): Db {
  const niveaux = {} as Record<ExoId, Level>;
  for (const e of EXOS) niveaux[e.id] = startLevel();
  return { format: "rayans-lecture", version: 1, niveaux, resultats: [], resumes: [], notes: [], seances: {}, reglages: { ...REGLAGES_DEFAUT } };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, d: number): number => (typeof x === "number" && Number.isFinite(x) ? x : d);
const str = (x: unknown, d = ""): string => (typeof x === "string" ? x : d);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const niveau = (x: unknown): Niveau => borne(Math.round(num(x, 1)), NIVEAU_MIN, NIVEAU_MAX) as Niveau;
const SORTES: SorteResultat[] = ["lecture", "plan", "survol", "notes", "test", "rsvp"];
const estJour = (k: string) => /^\d{4}-\d\d-\d\d$/.test(k);

/** Lit le fichier de données, en complétant ce qui manque. Lève une erreur si ce n'est pas un fichier Lecture. */
export function parseDb(text: string): Db {
  const raw: unknown = JSON.parse(text);
  if (!isObj(raw) || raw.format !== "rayans-lecture") throw new Error("Ce n'est pas un fichier de Rayan's Lecture.");
  return normaliserDb(raw);
}

export function normaliserDb(raw: Record<string, unknown>): Db {
  const d = emptyDb();
  if (isObj(raw.niveaux))
    for (const e of EXOS) {
      const l = raw.niveaux[e.id];
      if (isObj(l)) d.niveaux[e.id] = { level: niveau(l.level), streak: borne(Math.round(num(l.streak, 0)), 0, 1), best: niveau(l.best), maj: num(l.maj, 0) };
    }
  d.resultats = arr(raw.resultats).filter(isObj).map((r): Resultat => ({
    id: str(r.id), exo: (SORTES.includes(r.exo as SorteResultat) ? r.exo : "lecture") as SorteResultat, texteId: str(r.texteId),
    niveau: niveau(r.niveau), at: num(r.at, 0),
    ...(typeof r.mots === "number" ? { mots: num(r.mots, 0) } : {}),
    ...(typeof r.ms === "number" ? { ms: num(r.ms, 0) } : {}),
    ...(typeof r.mpm === "number" ? { mpm: num(r.mpm, 0) } : {}),
    bonnes: Math.max(0, num(r.bonnes, 0)), total: Math.max(0, num(r.total, 0)), part: borne(num(r.part, 0), 0, 1),
    ...(r.seance === true ? { seance: true } : {}),
    ...(r.test === "depart" || r.test === "suivi" ? { test: r.test } : {}),
    ...(typeof r.dejaSu === "string" && r.dejaSu ? { dejaSu: r.dejaSu.slice(0, 300) } : {}),
  })).filter((r) => r.id && r.texteId);
  d.resumes = arr(raw.resumes).filter(isObj).map((r) => ({
    id: str(r.id), texteId: str(r.texteId), at: num(r.at, 0), texte: str(r.texte).slice(0, 5000),
    idees: [...new Set(arr(r.idees).map((x) => Math.round(num(x, -1))).filter((x) => x >= 0))], total: Math.max(0, num(r.total, 0)),
  })).filter((r) => r.id && r.texteId);
  d.notes = arr(raw.notes).filter(isObj).map((n) => ({
    id: str(n.id), texteId: str(n.texteId), texte: str(n.texte).slice(0, 20000), at: num(n.at, 0), maj: num(n.maj, 0),
    ...(n.supprime === true ? { supprime: true } : {}),
  })).filter((n) => n.id && n.texteId);
  if (isObj(raw.seances))
    for (const [k, v] of Object.entries(raw.seances))
      if (estJour(k) && isObj(v)) d.seances[k] = { etapes: [...new Set(arr(v.etapes).map((e) => str(e)).filter(Boolean))], ...(typeof v.fin === "number" ? { fin: v.fin } : {}) };
  if (isObj(raw.reglages)) {
    const r = raw.reglages;
    const m = num(r.minutes, 10);
    d.reglages = {
      minutes: (m === 5 || m === 15 || m === 20 ? m : 10) as Reglages["minutes"],
      heureJour: borne(Math.round(num(r.heureJour, 4)), 0, 12),
      accueilVu: r.accueilVu === true,
      maj: num(r.maj, 0),
    };
  }
  return d;
}

/** Le jour (AAAA-MM-JJ, heure locale) d'un horodatage, sachant que la journée commence à `heureJour`. */
export function dayKey(ts: number, heureJour = 4): string {
  const d = new Date(ts - heureJour * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Nombre de jours entiers entre deux jours (AAAA-MM-JJ). */
export function joursEntre(a: string, b: string): number {
  const t = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86400_000);
}

// ---------------------------------------------------------------------------------------------------------------
// Fusion de deux versions (PC et iPhone modifiés chacun de leur côté) : rien n'est perdu.

function parId<T extends { id: string }>(a: T[], b: T[], date: (x: T) => number): T[] {
  const m = new Map<string, T>();
  for (const x of a) m.set(x.id, x);
  for (const x of b) {
    const y = m.get(x.id);
    if (!y || date(x) > date(y)) m.set(x.id, x);
  }
  return [...m.values()];
}

export function fusionner(local: Db, distant: Db): Db {
  const out = emptyDb();
  for (const e of EXOS) out.niveaux[e.id] = local.niveaux[e.id].maj >= distant.niveaux[e.id].maj ? local.niveaux[e.id] : distant.niveaux[e.id];
  out.resultats = parId(local.resultats, distant.resultats, () => 0).sort((x, y) => x.at - y.at);
  out.resumes = parId(local.resumes, distant.resumes, () => 0).sort((x, y) => x.at - y.at);
  out.notes = parId(local.notes, distant.notes, (n) => n.maj);
  for (const k of new Set([...Object.keys(local.seances), ...Object.keys(distant.seances)])) {
    const a = local.seances[k];
    const b = distant.seances[k];
    const etapes = [...new Set([...(a?.etapes ?? []), ...(b?.etapes ?? [])])];
    const fin = a?.fin ?? b?.fin;
    out.seances[k] = { etapes, ...(fin !== undefined ? { fin } : {}) };
  }
  out.reglages = local.reglages.maj >= distant.reglages.maj ? local.reglages : distant.reglages;
  return out;
}

function lireTexte(t: string | null): Db | null {
  if (t === null) return null;
  try { return parseDb(t); } catch { return null; }
}

/** Fusion au format texte, pour la synchronisation de Rayan's Mobile et de Rayan's Aujourd'hui. */
export function fusionnerTexte(local: string | null, distant: string | null): string | null {
  const a = lireTexte(local);
  const b = lireTexte(distant);
  if (!a && !b) return local ?? distant;
  if (!a) return JSON.stringify(b);
  if (!b) return JSON.stringify(a);
  return JSON.stringify(fusionner(a, b));
}
