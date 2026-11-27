// Les données de Rayan's Échecs Vision (un seul fichier JSON, synchronisé avec l'iPhone).
// N'importe que d'autres fichiers .ts de src/core sans dépendance (le dépôt mobile charge ce fichier avec
// node --test) : surtout pas chess.js ici.
import { EXOS, estExo, startLevel, type ExoId, type Level } from "./niveaux.ts";

/** Une manche (une position à reconstruire, une question de vision, une tactique). */
export interface Resultat {
  id: string;
  exo: ExoId;
  at: number;
  niveau: number;
  score: number;
  max: number;
  reussi: boolean;
  /** Position ou tactique concernée. */
  ref?: string;
  /** Temps de réponse (ms). */
  ms?: number;
}

/** État de révision d'une tactique (révision espacée). */
export interface Carte {
  /** Étape dans ETAPES_JOURS (0 = revoir demain). */
  etape: number;
  /** Prochaine révision (ms), ou null quand la tactique est acquise. */
  due: number | null;
  essais: number;
  reussites: number;
  maj: number;
}

export interface QuizResultat { id: string; at: number; justes: number; total: number }

export interface Reglages {
  /** L'heure à laquelle un nouveau jour commence (pour la série et la séance). */
  heureJour: number;
  sons: boolean;
  /** Coordonnées (a–h, 1–8) au bord de l'échiquier. */
  coordonnees: boolean;
  /** Présentation du premier lancement déjà vue. */
  introVue: boolean;
  maj: number;
}

export interface Db {
  format: "rayans-echecs-vision";
  version: 1;
  niveaux: Record<ExoId, Level>;
  resultats: Resultat[];
  /** Tactiques déjà vues : id de la tactique → état de révision. */
  cartes: Record<string, Carte>;
  quiz: QuizResultat[];
  /** Séances guidées faites, par jour (AAAA-MM-JJ) : étapes terminées. */
  seances: Record<string, { etapes: string[]; fin?: number }>;
  reglages: Reglages;
}

export function emptyDb(): Db {
  const niveaux = {} as Record<ExoId, Level>;
  for (const g of EXOS) niveaux[g.id] = startLevel(g.id);
  return {
    format: "rayans-echecs-vision",
    version: 1,
    niveaux,
    resultats: [],
    cartes: {},
    quiz: [],
    seances: {},
    reglages: { heureJour: 4, sons: true, coordonnees: true, introVue: false, maj: 0 },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, d: number): number => (typeof x === "number" && Number.isFinite(x) ? x : d);
const str = (x: unknown, d = ""): string => (typeof x === "string" ? x : d);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

/** Lit le fichier de données, en complétant ce qui manque. Lève une erreur si ce n'est pas un fichier Échecs Vision. */
export function parseDb(text: string): Db {
  const raw: unknown = JSON.parse(text);
  if (!isObj(raw) || raw.format !== "rayans-echecs-vision") throw new Error("Ce n'est pas un fichier de Rayan's Échecs Vision.");
  return normaliserDb(raw);
}

export function normaliserDb(raw: Record<string, unknown>): Db {
  const d = emptyDb();
  if (isObj(raw.niveaux))
    for (const g of EXOS) {
      const l = raw.niveaux[g.id];
      if (isObj(l))
        d.niveaux[g.id] = {
          level: Math.min(g.max, Math.max(g.min, Math.round(num(l.level, g.depart)))),
          streak: num(l.streak, 0), best: num(l.best, 0), maj: num(l.maj, 0),
        };
    }
  d.resultats = arr(raw.resultats).filter(isObj).filter((r) => estExo(str(r.exo))).map((r) => ({
    id: str(r.id), exo: str(r.exo) as ExoId, at: num(r.at, 0), niveau: num(r.niveau, 0),
    score: num(r.score, 0), max: num(r.max, 0), reussi: r.reussi === true,
    ...(typeof r.ref === "string" && r.ref ? { ref: r.ref } : {}),
    ...(typeof r.ms === "number" ? { ms: r.ms } : {}),
  })).filter((r) => r.id);
  if (isObj(raw.cartes))
    for (const [k, c] of Object.entries(raw.cartes))
      if (k && isObj(c))
        d.cartes[k] = {
          etape: Math.max(0, Math.round(num(c.etape, 0))), due: typeof c.due === "number" ? c.due : null,
          essais: num(c.essais, 0), reussites: num(c.reussites, 0), maj: num(c.maj, 0),
        };
  d.quiz = arr(raw.quiz).filter(isObj).map((q) => ({ id: str(q.id), at: num(q.at, 0), justes: num(q.justes, 0), total: num(q.total, 0) })).filter((q) => q.id);
  if (isObj(raw.seances))
    for (const [k, v] of Object.entries(raw.seances))
      if (/^\d{4}-\d\d-\d\d$/.test(k) && isObj(v)) d.seances[k] = { etapes: arr(v.etapes).map((e) => str(e)).filter(Boolean), ...(typeof v.fin === "number" ? { fin: v.fin } : {}) };
  if (isObj(raw.reglages)) {
    const r = raw.reglages;
    d.reglages = {
      heureJour: Math.min(12, Math.max(0, num(r.heureJour, 4))), sons: r.sons !== false, coordonnees: r.coordonnees !== false,
      introVue: r.introVue === true, maj: num(r.maj, 0),
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
// Résultats et quiz : union par id. Niveaux, cartes de révision (une par tactique), réglages : le plus récent (`maj`).
// Séances du jour : union des étapes faites.

function union<T extends { id: string }>(a: T[], b: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of [...a, ...b]) if (!m.has(x.id)) m.set(x.id, x);
  return [...m.values()];
}

export function fusionner(local: Db, distant: Db): Db {
  const out = emptyDb();
  for (const g of EXOS) out.niveaux[g.id] = local.niveaux[g.id].maj >= distant.niveaux[g.id].maj ? local.niveaux[g.id] : distant.niveaux[g.id];
  out.resultats = union(local.resultats, distant.resultats).sort((x, y) => x.at - y.at);
  out.quiz = union(local.quiz, distant.quiz).sort((x, y) => x.at - y.at);
  for (const k of new Set([...Object.keys(local.cartes), ...Object.keys(distant.cartes)])) {
    const a = local.cartes[k];
    const b = distant.cartes[k];
    out.cartes[k] = !b || (a && a.maj >= b.maj) ? a : b;
  }
  out.reglages = local.reglages.maj >= distant.reglages.maj ? local.reglages : distant.reglages;
  for (const k of new Set([...Object.keys(local.seances), ...Object.keys(distant.seances)])) {
    const a = local.seances[k];
    const b = distant.seances[k];
    const etapes = [...new Set([...(a?.etapes ?? []), ...(b?.etapes ?? [])])];
    const fin = a?.fin ?? b?.fin;
    out.seances[k] = { etapes, ...(fin !== undefined ? { fin } : {}) };
  }
  return out;
}

/** Fusion au format texte, pour la synchronisation de Rayan's Mobile et de Rayan's Aujourd'hui. */
export function fusionnerTexte(local: string | null, distant: string | null): string | null {
  if (distant === null) return local;
  if (local === null) return distant;
  if (local === distant) return local;
  const lire = (t: string): Db | null => { try { return parseDb(t); } catch { return null; } };
  const a = lire(local);
  const b = lire(distant);
  if (!a) return distant;
  if (!b) return local;
  return JSON.stringify(fusionner(a, b));
}
