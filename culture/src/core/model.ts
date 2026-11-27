// Les données de Rayan's Culture (un seul fichier JSON, synchronisé avec l'iPhone).
// N'importe que d'autres fichiers .ts de src/core (le dépôt mobile peut charger ce fichier avec node --test).
import { estQuestion, type Question } from "./questions.ts";

/** Une question entrée en révision espacée. Questions de la banque : `q` absent (texte lu dans la banque).
 *  Questions d'actualité : `q` garde le texte, car le fichier d'actu ne garde que quelques jours. */
export interface Carte {
  id: string;
  q?: Question;
  /** Jour de l'édition d'actu d'où vient la question (AAAA-MM-JJ). */
  jour?: string;
  /** Étape de révision (0 = J+1, 1 = J+3, …) ; voir espacement.ts. */
  etape: number;
  /** Prochaine révision (horodatage), ou null : pas encore vue, ou apprise. */
  due: number | null;
  vues: number;
  justes: number;
  ajoutee: number;
  /** Dernière modification (horodatage) : sert à la fusion PC ↔ iPhone. */
  maj: number;
}

export interface Reponse {
  id: string;
  carte: string;
  at: number;
  juste: boolean;
  /** Niveau au moment de la réponse. */
  niveau: number;
}

export interface Niveau { level: number; streak: number; best: number; maj: number }

export interface SeanceJour {
  /** Questions de la séance (ids de cartes ou de la banque), fixées au premier lancement du jour. */
  ids: string[];
  faites: string[];
  fin?: number;
}

export interface Reglages {
  /** L'heure à laquelle un nouveau jour commence (pour la série et la séance). */
  heureJour: number;
  sons: boolean;
  /** Questions par séance : 6 (3 min), 10 (5 min, conseillé), 14 (7 min). */
  questions: 6 | 10 | 14;
  /** Questions tirées de l'actualité, au plus, par séance. */
  actuParSeance: number;
  introVue: boolean;
  /** Fichier d'actualité choisi à la main (PC) ; vide = emplacement habituel. */
  cheminActu: string;
  maj: number;
}

export interface Db {
  format: "rayans-culture";
  version: 1;
  niveau: Niveau;
  cartes: Carte[];
  reponses: Reponse[];
  /** Séances par jour (AAAA-MM-JJ). */
  seances: Record<string, SeanceJour>;
  /** Éditions d'actu déjà transformées en questions (jours AAAA-MM-JJ). */
  actuJours: string[];
  reglages: Reglages;
}

export const NIVEAU_MIN = 1;
export const NIVEAU_MAX = 3;

export function emptyDb(): Db {
  return {
    format: "rayans-culture",
    version: 1,
    niveau: { level: 1, streak: 0, best: 1, maj: 0 },
    cartes: [],
    reponses: [],
    seances: {},
    actuJours: [],
    reglages: { heureJour: 4, sons: true, questions: 10, actuParSeance: 3, introVue: false, cheminActu: "", maj: 0 },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, d: number): number => (typeof x === "number" && Number.isFinite(x) ? x : d);
const str = (x: unknown, d = ""): string => (typeof x === "string" ? x : d);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const JOUR = /^\d{4}-\d\d-\d\d$/;
const borne = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Lit le fichier de données, en complétant ce qui manque. Lève une erreur si ce n'est pas un fichier Culture. */
export function parseDb(text: string): Db {
  const raw: unknown = JSON.parse(text);
  if (!isObj(raw) || raw.format !== "rayans-culture") throw new Error("Ce n'est pas un fichier de Rayan's Culture.");
  return normaliserDb(raw);
}

export function normaliserDb(raw: Record<string, unknown>): Db {
  const d = emptyDb();
  if (isObj(raw.niveau)) {
    const n = raw.niveau;
    d.niveau = { level: borne(Math.round(num(n.level, 1)), NIVEAU_MIN, NIVEAU_MAX), streak: Math.max(0, num(n.streak, 0)), best: borne(Math.round(num(n.best, 1)), NIVEAU_MIN, NIVEAU_MAX), maj: num(n.maj, 0) };
  }
  d.cartes = arr(raw.cartes).filter(isObj).map((c): Carte => ({
    id: str(c.id),
    ...(estQuestion(c.q) ? { q: c.q } : {}),
    ...(typeof c.jour === "string" && JOUR.test(c.jour) ? { jour: c.jour } : {}),
    etape: Math.max(0, Math.round(num(c.etape, 0))),
    due: typeof c.due === "number" && Number.isFinite(c.due) ? c.due : null,
    vues: Math.max(0, num(c.vues, 0)), justes: Math.max(0, num(c.justes, 0)),
    ajoutee: num(c.ajoutee, 0), maj: num(c.maj, 0),
  })).filter((c) => c.id);
  d.reponses = arr(raw.reponses).filter(isObj).map((r) => ({
    id: str(r.id), carte: str(r.carte), at: num(r.at, 0), juste: r.juste === true, niveau: num(r.niveau, 1),
  })).filter((r) => r.id && r.carte);
  if (isObj(raw.seances))
    for (const [k, v] of Object.entries(raw.seances))
      if (JOUR.test(k) && isObj(v)) {
        const ids = arr(v.ids).map((e) => str(e)).filter(Boolean);
        d.seances[k] = { ids, faites: arr(v.faites).map((e) => str(e)).filter(Boolean), ...(typeof v.fin === "number" ? { fin: v.fin } : {}) };
      }
  d.actuJours = arr(raw.actuJours).map((x) => str(x)).filter((x) => JOUR.test(x));
  if (isObj(raw.reglages)) {
    const r = raw.reglages;
    const q = num(r.questions, 10);
    d.reglages = {
      heureJour: borne(num(r.heureJour, 4), 0, 12), sons: r.sons !== false,
      questions: (q === 6 || q === 14 ? q : 10) as Reglages["questions"],
      actuParSeance: borne(Math.round(num(r.actuParSeance, 3)), 0, 6),
      introVue: r.introVue === true, cheminActu: str(r.cheminActu).slice(0, 1000), maj: num(r.maj, 0),
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
// Cartes : la plus récente (`maj`) par id. Réponses : union par id. Niveau, réglages : le plus récent (`maj`).
// Séances : les questions faites des deux côtés. Éditions d'actu importées : union.

function union<T extends { id: string }>(a: T[], b: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of [...a, ...b]) if (!m.has(x.id)) m.set(x.id, x);
  return [...m.values()];
}

export function fusionner(local: Db, distant: Db): Db {
  const out = emptyDb();
  out.niveau = local.niveau.maj >= distant.niveau.maj ? local.niveau : distant.niveau;
  out.reglages = local.reglages.maj >= distant.reglages.maj ? local.reglages : distant.reglages;
  const cartes = new Map<string, Carte>();
  for (const c of [...local.cartes, ...distant.cartes]) {
    const deja = cartes.get(c.id);
    if (!deja || c.maj > deja.maj || (c.maj === deja.maj && c.vues > deja.vues)) cartes.set(c.id, c);
  }
  out.cartes = [...cartes.values()].sort((x, y) => x.ajoutee - y.ajoutee || (x.id < y.id ? -1 : 1));
  out.reponses = union(local.reponses, distant.reponses).sort((x, y) => x.at - y.at);
  for (const k of new Set([...Object.keys(local.seances), ...Object.keys(distant.seances)])) {
    const a = local.seances[k];
    const b = distant.seances[k];
    const ids = [...new Set([...(a?.ids ?? []), ...(b?.ids ?? [])])];
    const faites = [...new Set([...(a?.faites ?? []), ...(b?.faites ?? [])])];
    const fins = [a?.fin, b?.fin].filter((x): x is number => typeof x === "number");
    out.seances[k] = { ids, faites, ...(fins.length ? { fin: Math.min(...fins) } : {}) };
  }
  out.actuJours = [...new Set([...local.actuJours, ...distant.actuJours])].sort();
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
