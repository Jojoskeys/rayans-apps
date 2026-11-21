// Les données de Rayan's Mémoire (un seul fichier JSON, synchronisé avec l'iPhone).
import { GAMES, startLevel, type GameId, type Level } from "./niveaux.ts";

/** Un lieu (locus) d'un palais : un endroit précis, dans l'ordre de la visite. */
export interface Lieu {
  id: string;
  nom: string;
  /** Détail qui le rend unique (« le pied gauche du canapé, côté fenêtre »). */
  detail?: string;
}

export interface Palais {
  id: string;
  nom: string;
  lieux: Lieu[];
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

/** Une liste rangée dans un palais, révisée ensuite à intervalles de plus en plus longs. */
export interface Liste {
  id: string;
  titre: string;
  /** Pourquoi cette liste : exercice du jour, cours, liste perso… */
  sorte: "exercice" | "perso" | "test";
  palaisId: string | null;
  elements: string[];
  /** Repères propres à la liste (mots-crochets, mots anglais…) quand elle n'est pas dans un palais. */
  reperes?: string[];
  /** L'image inventée pour chaque élément (même indice). */
  images: string[];
  createdAt: number;
  updatedAt: number;
  /** Prochaine révision (horodatage), null = plus de révision prévue. */
  due: number | null;
  /** Étape de l'espacement (0 = demain, puis 3 j, 7 j…). */
  etape: number;
  /** Historique des rappels : part retrouvée entre 0 et 1. */
  rappels: { at: number; part: number }[];
  deleted?: boolean;
}

export interface Resultat {
  id: string;
  /** Un jeu, ou « test » pour les tests de départ et de suivi. */
  jeu: GameId | "test-mots" | "test-chiffres" | "palais" | "major" | "quiz";
  at: number;
  niveau: number;
  score: number;
  max: number;
  reussi: boolean;
  detail?: string;
}

export interface Reglages {
  /** L'heure à laquelle un nouveau jour commence (pour la série et la séance). */
  heureJour: number;
  sons: boolean;
  /** Durée de la séance guidée, en minutes. */
  minutes: 5 | 15 | 30;
  updatedAt: number;
}

export interface Db {
  format: "rayans-memoire";
  version: 1;
  /** Premier jour du programme de 6 semaines (horodatage), null tant qu'il n'a pas commencé. */
  debutProgramme: number | null;
  niveaux: Record<GameId, Level>;
  resultats: Resultat[];
  palais: Palais[];
  listes: Liste[];
  /** Mots du système Major choisis par Rayan (clé « 00 » à « 99 ») ; `connus` : combien de nombres sont appris (0 à 100). */
  major: { mots: Record<string, string>; connus: number; updatedAt: number };
  /** Séances faites, par jour (AAAA-MM-JJ) : étapes terminées. */
  seances: Record<string, { etapes: string[]; fin?: number }>;
  reglages: Reglages;
}

export function emptyDb(): Db {
  const niveaux = {} as Record<GameId, Level>;
  for (const g of GAMES) niveaux[g.id] = startLevel(g.id);
  return {
    format: "rayans-memoire",
    version: 1,
    debutProgramme: null,
    niveaux,
    resultats: [],
    palais: [],
    listes: [],
    major: { mots: {}, connus: 0, updatedAt: 0 },
    seances: {},
    reglages: { heureJour: 4, sons: true, minutes: 15, updatedAt: 0 },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, d: number): number => (typeof x === "number" && Number.isFinite(x) ? x : d);
const str = (x: unknown, d = ""): string => (typeof x === "string" ? x : d);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

/** Lit le fichier de données, en complétant ce qui manque. Lève une erreur si ce n'est pas un fichier Mémoire. */
export function parseDb(text: string): Db {
  const raw: unknown = JSON.parse(text);
  if (!isObj(raw) || raw.format !== "rayans-memoire") throw new Error("Ce n'est pas un fichier de Rayan's Mémoire.");
  return normaliserDb(raw);
}

export function normaliserDb(raw: Record<string, unknown>): Db {
  const d = emptyDb();
  d.debutProgramme = typeof raw.debutProgramme === "number" ? raw.debutProgramme : null;
  if (isObj(raw.niveaux))
    for (const g of GAMES) {
      const l = raw.niveaux[g.id];
      if (isObj(l))
        d.niveaux[g.id] = {
          level: Math.min(g.max, Math.max(g.min, num(l.level, g.depart))),
          streak: num(l.streak, 0),
          best: num(l.best, 0),
          updatedAt: num(l.updatedAt, 0),
        };
    }
  d.resultats = arr(raw.resultats).filter(isObj).map((r) => ({
    id: str(r.id), jeu: str(r.jeu) as Resultat["jeu"], at: num(r.at, 0), niveau: num(r.niveau, 0),
    score: num(r.score, 0), max: num(r.max, 0), reussi: r.reussi === true, ...(typeof r.detail === "string" ? { detail: r.detail } : {}),
  })).filter((r) => r.id);
  d.palais = arr(raw.palais).filter(isObj).map((p) => ({
    id: str(p.id), nom: str(p.nom, "Palais"), createdAt: num(p.createdAt, 0), updatedAt: num(p.updatedAt, 0),
    lieux: arr(p.lieux).filter(isObj).map((l) => ({ id: str(l.id), nom: str(l.nom), ...(typeof l.detail === "string" && l.detail ? { detail: l.detail } : {}) })).filter((l) => l.id && l.nom),
    ...(p.deleted === true ? { deleted: true } : {}),
  })).filter((p) => p.id);
  d.listes = arr(raw.listes).filter(isObj).map((l) => {
    const elements = arr(l.elements).map((e) => str(e));
    const images = arr(l.images).map((e) => str(e));
    return {
      id: str(l.id), titre: str(l.titre, "Liste"), sorte: (["exercice", "perso", "test"].includes(str(l.sorte)) ? l.sorte : "perso") as Liste["sorte"],
      palaisId: typeof l.palaisId === "string" ? l.palaisId : null, elements,
      images: elements.map((_, i) => images[i] ?? ""),
      ...(Array.isArray(l.reperes) ? { reperes: elements.map((_, i) => str((l.reperes as unknown[])[i])) } : {}),
      createdAt: num(l.createdAt, 0), updatedAt: num(l.updatedAt, 0),
      due: typeof l.due === "number" ? l.due : null, etape: num(l.etape, 0),
      rappels: arr(l.rappels).filter(isObj).map((r) => ({ at: num(r.at, 0), part: num(r.part, 0) })),
      ...(l.deleted === true ? { deleted: true } : {}),
    };
  }).filter((l) => l.id);
  if (isObj(raw.major)) {
    const mots: Record<string, string> = {};
    if (isObj(raw.major.mots)) for (const [k, v] of Object.entries(raw.major.mots)) if (/^\d\d$/.test(k) && typeof v === "string" && v.trim()) mots[k] = v.trim();
    d.major = { mots, connus: Math.min(100, Math.max(0, Math.floor(num(raw.major.connus, 0) / 10) * 10)), updatedAt: num(raw.major.updatedAt, 0) };
  }
  if (isObj(raw.seances))
    for (const [k, v] of Object.entries(raw.seances))
      if (/^\d{4}-\d\d-\d\d$/.test(k) && isObj(v)) d.seances[k] = { etapes: arr(v.etapes).map((e) => str(e)).filter(Boolean), ...(typeof v.fin === "number" ? { fin: v.fin } : {}) };
  if (isObj(raw.reglages)) {
    const r = raw.reglages;
    const m = num(r.minutes, 15);
    d.reglages = {
      heureJour: Math.min(12, Math.max(0, num(r.heureJour, 4))), sons: r.sons !== false,
      minutes: (m === 5 || m === 30 ? m : 15) as Reglages["minutes"], updatedAt: num(r.updatedAt, 0),
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

function parId<T extends { id: string; updatedAt?: number }>(a: T[], b: T[], dateDe: (x: T) => number): T[] {
  const m = new Map<string, T>();
  for (const x of a) m.set(x.id, x);
  for (const x of b) {
    const y = m.get(x.id);
    if (!y || dateDe(x) > dateDe(y)) m.set(x.id, x);
  }
  return [...m.values()];
}

export function fusionner(local: Db, distant: Db): Db {
  const out = emptyDb();
  out.debutProgramme =
    local.debutProgramme === null ? distant.debutProgramme : distant.debutProgramme === null ? local.debutProgramme : Math.min(local.debutProgramme, distant.debutProgramme);
  for (const g of GAMES) out.niveaux[g.id] = local.niveaux[g.id].updatedAt >= distant.niveaux[g.id].updatedAt ? local.niveaux[g.id] : distant.niveaux[g.id];
  out.resultats = parId(local.resultats, distant.resultats, () => 0).sort((x, y) => x.at - y.at);
  out.palais = parId(local.palais, distant.palais, (p) => p.updatedAt);
  out.listes = parId(local.listes, distant.listes, (l) => l.updatedAt);
  out.major = local.major.updatedAt >= distant.major.updatedAt ? local.major : distant.major;
  out.reglages = local.reglages.updatedAt >= distant.reglages.updatedAt ? local.reglages : distant.reglages;
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
export function fusionnerTexte(local: unknown, distant: unknown): Db {
  const lire = (x: unknown) => (isObj(x) && x.format === "rayans-memoire" ? normaliserDb(x) : emptyDb());
  return fusionner(lire(local), lire(distant));
}
