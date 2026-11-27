// Les données de Rayan's Langues (un seul fichier JSON, synchronisé avec l'iPhone). Progrès séparés par langue.
import { LANGUES, type Langue } from "./langues.ts";
import { EXOS, startLevel, type ExoId, type Level } from "./niveaux.ts";

/** Un mot découvert, révisé à intervalles qui s'allongent (voir espacement.ts). Identifiant : « langue:mot ». */
export interface Carte {
  id: string;
  langue: Langue;
  mot: string;
  /** Découvert le (ms). */
  vu: number;
  /** Étape de l'espacement (0 = demain, puis 3 j, 7 j…). */
  etape: number;
  /** Prochaine révision (ms). */
  due: number;
  justes: number;
  fautes: number;
  /** Dernière modification (ms) : la plus récente gagne à la fusion. */
  maj: number;
}

/** Une manche d'exercice terminée. */
export interface Resultat {
  id: string;
  langue: Langue;
  exo: ExoId | "quiz";
  at: number;
  niveau: number;
  score: number;
  max: number;
}

/** Test de départ ou de suivi : 20 mots + 5 phrases. */
export interface TestResultat {
  id: string;
  langue: Langue;
  at: number;
  sorte: "depart" | "suivi";
  /** Lundi de la semaine (AAAA-MM-JJ). */
  semaine: string;
  mots: number;
  motsMax: number;
  phrases: number;
  phrasesMax: number;
}

export interface Reglages {
  /** Langue en cours (null au tout premier lancement). */
  langue: Langue | null;
  minutes: 5 | 10 | 15 | 20;
  /** Nouveaux mots par jour et par langue. */
  nouveauxParJour: number;
  /** Couleur des tons sur le pinyin. */
  couleursTons: boolean;
  /** Arabe : retirer les voyelles courtes d'un mot quand il est bien su. */
  retirerVoyelles: boolean;
  /** L'heure à laquelle un nouveau jour commence. */
  heureJour: number;
  accueilVu: boolean;
  maj: number;
}

export interface Db {
  format: "rayans-langues";
  version: 1;
  cartes: Carte[];
  resultats: Resultat[];
  tests: TestResultat[];
  niveaux: Record<Langue, Record<ExoId, Level>>;
  /** Étapes de la séance du jour faites, par « langue:AAAA-MM-JJ ». */
  seances: Record<string, { etapes: string[] }>;
  reglages: Reglages;
}

export const REGLAGES_DEFAUT: Reglages = {
  langue: null, minutes: 10, nouveauxParJour: 8, couleursTons: true, retirerVoyelles: true, heureJour: 4, accueilVu: false, maj: 0,
};

function niveauxVides(): Record<Langue, Record<ExoId, Level>> {
  const out = {} as Record<Langue, Record<ExoId, Level>>;
  for (const l of LANGUES) {
    out[l] = {} as Record<ExoId, Level>;
    for (const e of EXOS) out[l][e.id] = startLevel(e.id);
  }
  return out;
}

export function emptyDb(): Db {
  return { format: "rayans-langues", version: 1, cartes: [], resultats: [], tests: [], niveaux: niveauxVides(), seances: {}, reglages: { ...REGLAGES_DEFAUT } };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, d: number): number => (typeof x === "number" && Number.isFinite(x) ? x : d);
const str = (x: unknown, d = ""): string => (typeof x === "string" ? x : d);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const langue = (x: unknown): Langue | null => (x === "zh" || x === "ar" ? x : null);
const EXO_IDS = new Set<string>([...EXOS.map((e) => e.id), "quiz"]);
const JOUR = /^\d{4}-\d\d-\d\d$/;

/** Lit le fichier de données, en complétant ce qui manque. Lève une erreur si ce n'est pas un fichier Langues. */
export function parseDb(text: string): Db {
  const raw: unknown = JSON.parse(text);
  if (!isObj(raw) || raw.format !== "rayans-langues") throw new Error("Ce n'est pas un fichier de Rayan's Langues.");
  return normaliserDb(raw);
}

export function normaliserDb(raw: Record<string, unknown>): Db {
  const d = emptyDb();
  d.cartes = arr(raw.cartes).filter(isObj).flatMap((c): Carte[] => {
    const l = langue(c.langue);
    const mot = str(c.mot);
    if (!l || !mot) return [];
    return [{
      id: `${l}:${mot}`, langue: l, mot, vu: num(c.vu, 0), etape: borne(Math.round(num(c.etape, 0)), 0, 20), due: num(c.due, 0),
      justes: Math.max(0, num(c.justes, 0)), fautes: Math.max(0, num(c.fautes, 0)), maj: num(c.maj, 0),
    }];
  });
  d.resultats = arr(raw.resultats).filter(isObj).flatMap((r): Resultat[] => {
    const l = langue(r.langue);
    if (!l || !str(r.id) || !EXO_IDS.has(str(r.exo))) return [];
    return [{ id: str(r.id), langue: l, exo: str(r.exo) as Resultat["exo"], at: num(r.at, 0), niveau: num(r.niveau, 1), score: Math.max(0, num(r.score, 0)), max: Math.max(0, num(r.max, 0)) }];
  });
  d.tests = arr(raw.tests).filter(isObj).flatMap((t): TestResultat[] => {
    const l = langue(t.langue);
    if (!l || !str(t.id)) return [];
    return [{
      id: str(t.id), langue: l, at: num(t.at, 0), sorte: t.sorte === "depart" ? "depart" : "suivi", semaine: JOUR.test(str(t.semaine)) ? str(t.semaine) : "",
      mots: num(t.mots, 0), motsMax: num(t.motsMax, 0), phrases: num(t.phrases, 0), phrasesMax: num(t.phrasesMax, 0),
    }];
  });
  if (isObj(raw.niveaux))
    for (const l of LANGUES) {
      const nl = raw.niveaux[l];
      if (!isObj(nl)) continue;
      for (const e of EXOS) {
        const v = nl[e.id];
        if (isObj(v)) d.niveaux[l][e.id] = { level: borne(Math.round(num(v.level, e.depart)), e.min, e.max), streak: borne(num(v.streak, 0), 0, 1), best: num(v.best, 0), maj: num(v.maj, 0) };
      }
    }
  if (isObj(raw.seances))
    for (const [k, v] of Object.entries(raw.seances))
      if (/^(zh|ar):\d{4}-\d\d-\d\d$/.test(k) && isObj(v)) d.seances[k] = { etapes: [...new Set(arr(v.etapes).map((e) => str(e)).filter(Boolean))] };
  if (isObj(raw.reglages)) {
    const r = raw.reglages;
    const m = num(r.minutes, 10);
    d.reglages = {
      langue: langue(r.langue),
      minutes: (m === 5 || m === 15 || m === 20 ? m : 10) as Reglages["minutes"],
      nouveauxParJour: borne(Math.round(num(r.nouveauxParJour, 8)), 0, 30),
      couleursTons: r.couleursTons !== false,
      retirerVoyelles: r.retirerVoyelles !== false,
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

export function ajouterJours(jour: string, n: number): string {
  const d = new Date(Date.UTC(+jour.slice(0, 4), +jour.slice(5, 7) - 1, +jour.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}

/** Le lundi de la semaine d'un jour (AAAA-MM-JJ). */
export function lundiDe(jour: string): string {
  const jds = new Date(Date.UTC(+jour.slice(0, 4), +jour.slice(5, 7) - 1, +jour.slice(8, 10))).getUTCDay();
  return ajouterJours(jour, -((jds + 6) % 7));
}

// ---------------------------------------------------------------------------------------------------------------
// Fusion de deux versions (PC et iPhone modifiés chacun de leur côté) : rien n'est perdu.

function plusRecentParId<T extends { id: string }>(a: T[], b: T[], date: (x: T) => number): T[] {
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
  out.cartes = plusRecentParId(local.cartes, distant.cartes, (c) => c.maj).sort((x, y) => x.vu - y.vu || x.id.localeCompare(y.id));
  out.resultats = plusRecentParId(local.resultats, distant.resultats, () => 0).sort((x, y) => x.at - y.at);
  out.tests = plusRecentParId(local.tests, distant.tests, () => 0).sort((x, y) => x.at - y.at);
  for (const l of LANGUES)
    for (const e of EXOS) {
      const a = local.niveaux[l][e.id];
      const b = distant.niveaux[l][e.id];
      out.niveaux[l][e.id] = a.maj >= b.maj ? a : b;
    }
  for (const k of new Set([...Object.keys(local.seances), ...Object.keys(distant.seances)]))
    out.seances[k] = { etapes: [...new Set([...(local.seances[k]?.etapes ?? []), ...(distant.seances[k]?.etapes ?? [])])] };
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
