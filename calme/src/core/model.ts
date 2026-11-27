// Les données de Rayan's Calme (un seul fichier JSON, synchronisé avec l'iPhone).
// Le journal est sensible : il reste sur l'appareil (et dans la synchronisation privée de Rayan's Apps), jamais ailleurs.
import { niveauDepart, type Niveau } from "./niveaux.ts";
import { borne010, type Test } from "./questionnaire.ts";
import type { CleReeval } from "./emotions.ts";
import type { RythmeId } from "./respiration.ts";
import type { DureeSeance } from "./seance.ts";
import { dayKey, estJour } from "./temps.ts";

export { dayKey };
export type { Test };

/** Une respiration guidée (faite seule, dans la séance du jour ou avant un examen). */
export interface Respiration {
  id: string;
  at: number;
  jour: string;
  rythme: RythmeId;
  /** Durée choisie (minutes). */
  dureeMin: number;
  /** Secondes réellement faites. */
  secondes: number;
  terminee: boolean;
  /** Ressenti 1 (très tendu) à 10 (très calme), facultatif. */
  avant?: number;
  apres?: number;
}

/** Une entrée « Nommer et réévaluer ». */
export interface Entree {
  id: string;
  at: number;
  jour: string;
  famille: string;
  nuance: string;
  intensite: number;
  situation: string;
  pensee: string;
  reponses: Partial<Record<CleReeval, string>>;
  equilibree: string;
  apres: number | null;
  ideesNoires: boolean;
  maj: number;
  supprime?: boolean;
}

export interface Gratitude {
  id: string;
  at: number;
  jour: string;
  choses: { quoi: string; pourquoi: string }[];
  maj: number;
  supprime?: boolean;
}

/** Routine « avant l'examen » terminée ; l'écrit n'est gardé que si tu l'as choisi. */
export interface Preparation {
  id: string;
  at: number;
  jour: string;
  texte?: string;
  maj: number;
  supprime?: boolean;
}

/** Activité courte sans contenu (relaxation, séance du jour terminée). */
export interface Activite {
  id: string;
  at: number;
  jour: string;
  type: "relaxation" | "seance";
  dureeMin?: number;
}

export interface Reglages {
  dureeSeance: DureeSeance;
  rythme: RythmeId;
  son: boolean;
  vibration: boolean;
  /** Rappel de gratitude (dans l'app, le soir) : désactivé par défaut. */
  rappelGratitude: boolean;
  heureRappel: number;
  heureJour: number;
  accueilVu: boolean;
  maj: number;
}

export interface Db {
  format: "rayans-calme";
  version: 1;
  respirations: Respiration[];
  entrees: Entree[];
  gratitudes: Gratitude[];
  preparations: Preparation[];
  activites: Activite[];
  tests: Test[];
  niveaux: { respiration: Niveau };
  reglages: Reglages;
}

export const REGLAGES_DEFAUT: Reglages = {
  dureeSeance: 10, rythme: "six", son: false, vibration: true, rappelGratitude: false, heureRappel: 21,
  heureJour: 4, accueilVu: false, maj: 0,
};

export function emptyDb(): Db {
  return {
    format: "rayans-calme",
    version: 1,
    respirations: [],
    entrees: [],
    gratitudes: [],
    preparations: [],
    activites: [],
    tests: [],
    niveaux: { respiration: niveauDepart("respiration") },
    reglages: { ...REGLAGES_DEFAUT },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, d: number): number => (typeof x === "number" && Number.isFinite(x) ? x : d);
const str = (x: unknown, max = 2000): string => (typeof x === "string" ? x.slice(0, max) : "");
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const jourDe = (x: Record<string, unknown>, at: number) => (typeof x.jour === "string" && estJour(x.jour) ? x.jour : dayKey(at));
const note = (x: unknown): number | undefined => (typeof x === "number" && Number.isFinite(x) ? borne(Math.round(x), 1, 10) : undefined);
const suppr = (x: Record<string, unknown>) => (x.supprime === true ? { supprime: true as const } : {});

/** Lit le fichier de données, en complétant ce qui manque. Lève une erreur si ce n'est pas un fichier Calme. */
export function parseDb(text: string): Db {
  const raw: unknown = JSON.parse(text);
  if (!isObj(raw) || raw.format !== "rayans-calme") throw new Error("Ce n'est pas un fichier de Rayan's Calme.");
  return normaliserDb(raw);
}

const RYTHMES_OK: RythmeId[] = ["six", "quatre-six", "soupir"];
const CLES: CleReeval[] = ["pour", "contre", "ami", "unAn", "controle"];

export function normaliserDb(raw: Record<string, unknown>): Db {
  const d = emptyDb();
  d.respirations = arr(raw.respirations).filter(isObj).map((r): Respiration => {
    const at = num(r.at, 0);
    const avant = note(r.avant);
    const apres = note(r.apres);
    return {
      id: str(r.id, 80), at, jour: jourDe(r, at),
      rythme: RYTHMES_OK.includes(r.rythme as RythmeId) ? (r.rythme as RythmeId) : "six",
      dureeMin: borne(Math.round(num(r.dureeMin, 3)), 1, 30),
      secondes: borne(Math.round(num(r.secondes, 0)), 0, 3600),
      terminee: r.terminee === true,
      ...(avant !== undefined ? { avant } : {}),
      ...(apres !== undefined ? { apres } : {}),
    };
  }).filter((r) => r.id);
  d.entrees = arr(raw.entrees).filter(isObj).map((e): Entree => {
    const at = num(e.at, 0);
    const rep: Partial<Record<CleReeval, string>> = {};
    if (isObj(e.reponses)) for (const k of CLES) { const v = str(e.reponses[k]); if (v) rep[k] = v; }
    return {
      id: str(e.id, 80), at, jour: jourDe(e, at), famille: str(e.famille, 40), nuance: str(e.nuance, 60),
      intensite: borne010(num(e.intensite, 5)), situation: str(e.situation), pensee: str(e.pensee), reponses: rep,
      equilibree: str(e.equilibree), apres: typeof e.apres === "number" ? borne010(e.apres) : null,
      ideesNoires: e.ideesNoires === true, maj: num(e.maj, 0), ...suppr(e),
    };
  }).filter((e) => e.id);
  d.gratitudes = arr(raw.gratitudes).filter(isObj).map((g): Gratitude => {
    const at = num(g.at, 0);
    return {
      id: str(g.id, 80), at, jour: jourDe(g, at),
      choses: arr(g.choses).filter(isObj).map((c) => ({ quoi: str(c.quoi, 500), pourquoi: str(c.pourquoi, 500) })).filter((c) => c.quoi).slice(0, 5),
      maj: num(g.maj, 0), ...suppr(g),
    };
  }).filter((g) => g.id);
  d.preparations = arr(raw.preparations).filter(isObj).map((p): Preparation => {
    const at = num(p.at, 0);
    const texte = str(p.texte, 10000);
    return { id: str(p.id, 80), at, jour: jourDe(p, at), ...(texte ? { texte } : {}), maj: num(p.maj, 0), ...suppr(p) };
  }).filter((p) => p.id);
  d.activites = arr(raw.activites).filter(isObj).map((a): Activite => {
    const at = num(a.at, 0);
    return {
      id: str(a.id, 80), at, jour: jourDe(a, at), type: a.type === "seance" ? "seance" : "relaxation",
      ...(typeof a.dureeMin === "number" ? { dureeMin: borne(Math.round(a.dureeMin), 1, 60) } : {}),
    };
  }).filter((a) => a.id);
  d.tests = arr(raw.tests).filter(isObj).map((t): Test => ({
    id: str(t.id, 80), at: num(t.at, 0), type: t.type === "depart" ? "depart" : "suivi",
    reponses: arr(t.reponses).map((r) => borne010(num(r, 5))).slice(0, 10),
  })).filter((t) => t.id);
  if (isObj(raw.niveaux) && isObj(raw.niveaux.respiration)) {
    const n = raw.niveaux.respiration;
    const dep = niveauDepart("respiration");
    d.niveaux.respiration = {
      niveau: borne(Math.round(num(n.niveau, dep.niveau)), 0, 3), serie: borne(Math.round(num(n.serie, 0)), 0, 1),
      meilleur: borne(Math.round(num(n.meilleur, 0)), 0, 3), maj: num(n.maj, 0),
    };
  }
  if (isObj(raw.reglages)) {
    const r = raw.reglages;
    const df = REGLAGES_DEFAUT;
    const ds = num(r.dureeSeance, df.dureeSeance);
    d.reglages = {
      dureeSeance: ([5, 10, 15, 20] as const).find((x) => x === ds) ?? df.dureeSeance,
      rythme: RYTHMES_OK.includes(r.rythme as RythmeId) ? (r.rythme as RythmeId) : df.rythme,
      son: r.son === true,
      vibration: r.vibration !== false,
      rappelGratitude: r.rappelGratitude === true,
      heureRappel: borne(Math.round(num(r.heureRappel, df.heureRappel)), 12, 23),
      heureJour: borne(Math.round(num(r.heureJour, df.heureJour)), 0, 12),
      accueilVu: r.accueilVu === true,
      maj: num(r.maj, 0),
    };
  }
  return d;
}

// ---------------------------------------------------------------------------------------------------------------
// Fusion de deux versions (PC et iPhone modifiés chacun de leur côté) : rien n'est perdu.

/** Union par identifiant ; si les deux ont le même, `date` départage (le plus récent gagne). */
function parId<T extends { id: string }>(a: T[], b: T[], date: (x: T) => number): T[] {
  const m = new Map<string, T>();
  for (const x of a) m.set(x.id, x);
  for (const x of b) {
    const y = m.get(x.id);
    if (!y || date(x) > date(y)) m.set(x.id, x);
  }
  return [...m.values()];
}

const parDate = <T extends { at: number }>(l: T[]) => l.sort((x, y) => x.at - y.at);

export function fusionner(local: Db, distant: Db): Db {
  const out = emptyDb();
  out.respirations = parDate(parId(local.respirations, distant.respirations, () => 0));
  out.activites = parDate(parId(local.activites, distant.activites, () => 0));
  out.tests = parDate(parId(local.tests, distant.tests, () => 0));
  out.entrees = parDate(parId(local.entrees, distant.entrees, (e) => e.maj));
  out.gratitudes = parDate(parId(local.gratitudes, distant.gratitudes, (g) => g.maj));
  out.preparations = parDate(parId(local.preparations, distant.preparations, (p) => p.maj));
  out.niveaux = { respiration: local.niveaux.respiration.maj >= distant.niveaux.respiration.maj ? local.niveaux.respiration : distant.niveaux.respiration };
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
