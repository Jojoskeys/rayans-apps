// Les données de Rayan's Focus (un seul fichier JSON, synchronisé avec l'iPhone).
// N'importe que d'autres fichiers .ts de src/core (le dépôt mobile charge ce fichier avec node --test).
import { EXOS, estExo, startLevel, type ExoId, type Level } from "./niveaux.ts";
import { PALIERS, TYPES_DISTRACTION, type EtatTravail, type Issue, type TypeDistraction } from "./travail.ts";

/** Une manche d'exercice. */
export interface Resultat {
  id: string;
  exo: ExoId;
  at: number;
  niveau: number;
  score: number;
  max: number;
  reussi: boolean;
  /** Temps de réponse moyen (réponses justes), en ms. */
  ms?: number;
  /** Écart de temps (ms) : pièges − sans piège (flèches, couleurs) ou changement − répétition (coût du changement). */
  cout?: number;
  detail?: string;
}

/** Test de départ ou de suivi : toujours les mêmes conditions (niveau fixe, 1 min de chaque). */
export interface TestResultat {
  id: string;
  at: number;
  sorte: "depart" | "suivi";
  recherche: { justes: number; total: number; ms: number | null };
  flanker: { justes: number; total: number; ms: number | null; cout: number | null };
}

/** Un bloc de travail profond. */
export interface SeanceTravail {
  id: string;
  debut: number;
  fin: number;
  /** Durée prévue (min). */
  minutes: number;
  /** Minutes réellement faites. */
  faites: number;
  objectif: string;
  intention: string;
  issue: Issue;
  distractions: number;
  /** Faite à la durée du palier actuel (compte pour monter ou descendre). */
  auPalier: boolean;
}

export interface Distraction {
  id: string;
  at: number;
  type: TypeDistraction;
  note?: string;
  seanceId?: string;
}

export interface Reglages {
  /** L'heure à laquelle un nouveau jour commence (pour la série et la séance). */
  heureJour: number;
  sons: boolean;
  /** Durée de la séance guidée, en minutes. */
  minutes: 5 | 10 | 15 | 20;
  /** Présentation du premier lancement déjà vue. */
  introVue: boolean;
  maj: number;
}

export interface Db {
  format: "rayans-focus";
  version: 1;
  niveaux: Record<ExoId, Level>;
  resultats: Resultat[];
  tests: TestResultat[];
  travaux: SeanceTravail[];
  distractions: Distraction[];
  travail: EtatTravail;
  /** Séances guidées faites, par jour (AAAA-MM-JJ) : étapes terminées. */
  seances: Record<string, { etapes: string[]; fin?: number }>;
  reglages: Reglages;
}

export function emptyDb(): Db {
  const niveaux = {} as Record<ExoId, Level>;
  for (const g of EXOS) niveaux[g.id] = startLevel(g.id);
  return {
    format: "rayans-focus",
    version: 1,
    niveaux,
    resultats: [],
    tests: [],
    travaux: [],
    distractions: [],
    travail: { palier: 0, serie: 0, maj: 0 },
    seances: {},
    reglages: { heureJour: 4, sons: true, minutes: 10, introVue: false, maj: 0 },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, d: number): number => (typeof x === "number" && Number.isFinite(x) ? x : d);
const numOuNull = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const str = (x: unknown, d = ""): string => (typeof x === "string" ? x : d);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const ISSUES: Issue[] = ["reussie", "distraite", "abandonnee"];

/** Lit le fichier de données, en complétant ce qui manque. Lève une erreur si ce n'est pas un fichier Focus. */
export function parseDb(text: string): Db {
  const raw: unknown = JSON.parse(text);
  if (!isObj(raw) || raw.format !== "rayans-focus") throw new Error("Ce n'est pas un fichier de Rayan's Focus.");
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
    ...(typeof r.ms === "number" ? { ms: r.ms } : {}),
    ...(typeof r.cout === "number" ? { cout: r.cout } : {}),
    ...(typeof r.detail === "string" ? { detail: r.detail } : {}),
  })).filter((r) => r.id);
  d.tests = arr(raw.tests).filter(isObj).map((t) => {
    const re = isObj(t.recherche) ? t.recherche : {};
    const fl = isObj(t.flanker) ? t.flanker : {};
    return {
      id: str(t.id), at: num(t.at, 0), sorte: (t.sorte === "depart" ? "depart" : "suivi") as TestResultat["sorte"],
      recherche: { justes: num(re.justes, 0), total: num(re.total, 0), ms: numOuNull(re.ms) },
      flanker: { justes: num(fl.justes, 0), total: num(fl.total, 0), ms: numOuNull(fl.ms), cout: numOuNull(fl.cout) },
    };
  }).filter((t) => t.id);
  d.travaux = arr(raw.travaux).filter(isObj).map((s) => ({
    id: str(s.id), debut: num(s.debut, 0), fin: num(s.fin, 0), minutes: num(s.minutes, 0), faites: num(s.faites, 0),
    objectif: str(s.objectif), intention: str(s.intention),
    issue: (ISSUES.includes(s.issue as Issue) ? s.issue : "abandonnee") as Issue,
    distractions: num(s.distractions, 0), auPalier: s.auPalier === true,
  })).filter((s) => s.id);
  const types = TYPES_DISTRACTION.map((t) => t.id) as string[];
  d.distractions = arr(raw.distractions).filter(isObj).filter((x) => types.includes(str(x.type))).map((x) => ({
    id: str(x.id), at: num(x.at, 0), type: str(x.type) as TypeDistraction,
    ...(typeof x.note === "string" && x.note ? { note: x.note } : {}),
    ...(typeof x.seanceId === "string" && x.seanceId ? { seanceId: x.seanceId } : {}),
  })).filter((x) => x.id);
  if (isObj(raw.travail))
    d.travail = {
      palier: Math.min(PALIERS.length - 1, Math.max(0, Math.round(num(raw.travail.palier, 0)))),
      serie: Math.max(0, num(raw.travail.serie, 0)), maj: num(raw.travail.maj, 0),
    };
  if (isObj(raw.seances))
    for (const [k, v] of Object.entries(raw.seances))
      if (/^\d{4}-\d\d-\d\d$/.test(k) && isObj(v)) d.seances[k] = { etapes: arr(v.etapes).map((e) => str(e)).filter(Boolean), ...(typeof v.fin === "number" ? { fin: v.fin } : {}) };
  if (isObj(raw.reglages)) {
    const r = raw.reglages;
    const m = num(r.minutes, 10);
    d.reglages = {
      heureJour: Math.min(12, Math.max(0, num(r.heureJour, 4))), sons: r.sons !== false,
      minutes: (m === 5 || m === 15 || m === 20 ? m : 10) as Reglages["minutes"],
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
// Résultats, tests, blocs de travail et distractions : union par id. Niveaux, palier, réglages : le plus récent (`maj`).

function union<T extends { id: string }>(a: T[], b: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of [...a, ...b]) if (!m.has(x.id)) m.set(x.id, x);
  return [...m.values()];
}

export function fusionner(local: Db, distant: Db): Db {
  const out = emptyDb();
  for (const g of EXOS) out.niveaux[g.id] = local.niveaux[g.id].maj >= distant.niveaux[g.id].maj ? local.niveaux[g.id] : distant.niveaux[g.id];
  out.resultats = union(local.resultats, distant.resultats).sort((x, y) => x.at - y.at);
  out.tests = union(local.tests, distant.tests).sort((x, y) => x.at - y.at);
  out.travaux = union(local.travaux, distant.travaux).sort((x, y) => x.debut - y.debut);
  out.distractions = union(local.distractions, distant.distractions).sort((x, y) => x.at - y.at);
  out.travail = local.travail.maj >= distant.travail.maj ? local.travail : distant.travail;
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
