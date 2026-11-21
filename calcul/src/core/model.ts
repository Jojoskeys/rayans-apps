// Les données de Rayan's Calcul mental (un seul fichier JSON, synchronisé avec l'iPhone).
import { startLevel, TYPES, typeInfo, type Level } from "./niveaux.ts";
import type { AstuceId, Op, TypeId } from "./question.ts";

export type Sorte = "entrainement" | "estimation" | "astuce" | "defi" | "test" | "quiz";

export interface Resultat {
  id: string;
  sorte: Sorte;
  /** L'astuce, le défi ou le numéro du test ; vide pour l'entraînement. */
  ref: string;
  at: number;
  bonnes: number;
  total: number;
  /** Temps moyen par calcul (ms). */
  tempsMoyenMs: number;
  /** Score d'un défi (bonnes réponses, ou secondes pour « 20 questions »). */
  score?: number;
  /** Mode « Estimer d'abord » : estimations acceptées (à 10 % près). */
  estimOk?: number;
  detail?: string;
}

/** Un calcul raté, à reposer plus tard (révision espacée simple : J+1, J+3, J+7). */
export interface FaitARevoir {
  cle: string;
  texte: string;
  reponse: number;
  etapes: string[];
  type: TypeId;
  niveau: number;
  a: number;
  b: number;
  op: Op;
  astuce?: AstuceId;
  /** 0 = revoir demain, puis 1 = dans 3 jours, 2 = dans 7 jours. */
  etape: number;
  due: number;
  rates: number;
  maj: number;
  /** Retrouvé à chaque révision : plus rien de prévu. */
  fini?: boolean;
}

export interface Reglages {
  /** Durée de la séance du jour, en minutes. */
  minutes: 5 | 10 | 15 | 20;
  /** L'heure à laquelle un nouveau jour commence. */
  heureJour: number;
  sons: boolean;
  /** Afficher le chrono pendant l'entraînement (désactivé par défaut : moins de stress). */
  chrono: boolean;
  /** La présentation du premier lancement a été vue. */
  bienvenue: boolean;
  maj: number;
}

export interface Db {
  format: "rayans-calcul";
  version: 1;
  niveaux: Record<TypeId, Level>;
  resultats: Resultat[];
  revoir: FaitARevoir[];
  /** Séances du jour (AAAA-MM-JJ) : étapes terminées, et l'heure de fin. */
  jours: Record<string, { etapes: string[]; fin?: number }>;
  reglages: Reglages;
}

export function emptyDb(): Db {
  const niveaux = {} as Record<TypeId, Level>;
  for (const t of TYPES) niveaux[t.id] = startLevel(t.id);
  return {
    format: "rayans-calcul",
    version: 1,
    niveaux,
    resultats: [],
    revoir: [],
    jours: {},
    reglages: { minutes: 10, heureJour: 4, sons: true, chrono: false, bienvenue: false, maj: 0 },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, d: number): number => (typeof x === "number" && Number.isFinite(x) ? x : d);
const str = (x: unknown, d = ""): string => (typeof x === "string" ? x : d);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const SORTES: Sorte[] = ["entrainement", "estimation", "astuce", "defi", "test", "quiz"];
const OPS: Op[] = ["+", "−", "×", "÷", "%"];

/** Lit le fichier de données, en complétant ce qui manque. Lève une erreur si ce n'est pas un fichier Calcul. */
export function parseDb(text: string): Db {
  const raw: unknown = JSON.parse(text);
  if (!isObj(raw) || raw.format !== "rayans-calcul") throw new Error("Ce n'est pas un fichier de Rayan's Calcul mental.");
  return normaliserDb(raw);
}

export function normaliserDb(raw: Record<string, unknown>): Db {
  const d = emptyDb();
  if (isObj(raw.niveaux))
    for (const t of TYPES) {
      const l = raw.niveaux[t.id];
      if (isObj(l))
        d.niveaux[t.id] = {
          niveau: Math.min(t.max, Math.max(t.min, num(l.niveau, t.depart))),
          suite: num(l.suite, 0),
          record: num(l.record, 0),
          maj: num(l.maj, 0),
        };
    }
  d.resultats = arr(raw.resultats).filter(isObj).map((r): Resultat => ({
    id: str(r.id),
    sorte: (SORTES.includes(r.sorte as Sorte) ? r.sorte : "entrainement") as Sorte,
    ref: str(r.ref),
    at: num(r.at, 0),
    bonnes: num(r.bonnes, 0),
    total: num(r.total, 0),
    tempsMoyenMs: num(r.tempsMoyenMs, 0),
    ...(typeof r.score === "number" ? { score: r.score } : {}),
    ...(typeof r.estimOk === "number" ? { estimOk: r.estimOk } : {}),
    ...(typeof r.detail === "string" ? { detail: r.detail } : {}),
  })).filter((r) => r.id);
  d.revoir = arr(raw.revoir).filter(isObj).map((f): FaitARevoir => {
    const type = (TYPES.some((t) => t.id === f.type) ? f.type : "addition") as TypeId;
    return {
      cle: str(f.cle), texte: str(f.texte), reponse: num(f.reponse, 0), etapes: arr(f.etapes).map((e) => str(e)),
      type, niveau: Math.min(typeInfo(type).max, Math.max(1, num(f.niveau, 1))), a: num(f.a, 0), b: num(f.b, 0),
      op: (OPS.includes(f.op as Op) ? f.op : "+") as Op,
      ...(typeof f.astuce === "string" ? { astuce: f.astuce as AstuceId } : {}),
      etape: num(f.etape, 0), due: num(f.due, 0), rates: num(f.rates, 1), maj: num(f.maj, 0),
      ...(f.fini === true ? { fini: true } : {}),
    };
  }).filter((f) => f.cle && f.texte);
  if (isObj(raw.jours))
    for (const [k, v] of Object.entries(raw.jours))
      if (/^\d{4}-\d\d-\d\d$/.test(k) && isObj(v)) d.jours[k] = { etapes: arr(v.etapes).map((e) => str(e)).filter(Boolean), ...(typeof v.fin === "number" ? { fin: v.fin } : {}) };
  if (isObj(raw.reglages)) {
    const r = raw.reglages;
    const m = num(r.minutes, 10);
    d.reglages = {
      minutes: ([5, 10, 15, 20].includes(m) ? m : 10) as Reglages["minutes"],
      heureJour: Math.min(12, Math.max(0, num(r.heureJour, 4))),
      sons: r.sons !== false,
      chrono: r.chrono === true,
      bienvenue: r.bienvenue === true,
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

function parCle<T>(a: T[], b: T[], cle: (x: T) => string, maj: (x: T) => number): T[] {
  const m = new Map<string, T>();
  for (const x of a) m.set(cle(x), x);
  for (const x of b) {
    const y = m.get(cle(x));
    if (!y || maj(x) > maj(y)) m.set(cle(x), x);
  }
  return [...m.values()];
}

/** Résultats et séances additionnés (sans doublon), niveaux, faits à revoir et réglages : le plus récent gagne. */
export function fusionner(a: Db, b: Db): Db {
  const out = emptyDb();
  for (const t of TYPES) out.niveaux[t.id] = a.niveaux[t.id].maj >= b.niveaux[t.id].maj ? a.niveaux[t.id] : b.niveaux[t.id];
  out.resultats = parCle(a.resultats, b.resultats, (r) => r.id, () => 0).sort((x, y) => x.at - y.at);
  out.revoir = parCle(a.revoir, b.revoir, (f) => f.cle, (f) => f.maj);
  out.reglages = a.reglages.maj >= b.reglages.maj ? a.reglages : b.reglages;
  for (const k of new Set([...Object.keys(a.jours), ...Object.keys(b.jours)])) {
    const x = a.jours[k];
    const y = b.jours[k];
    const etapes = [...new Set([...(x?.etapes ?? []), ...(y?.etapes ?? [])])];
    const fins = [x?.fin, y?.fin].filter((f): f is number => f !== undefined);
    out.jours[k] = { etapes, ...(fins.length ? { fin: Math.min(...fins) } : {}) };
  }
  return out;
}

/** Fusion au format texte, pour la synchronisation de Rayan's Mobile et de Rayan's Aujourd'hui. */
export function fusionnerTexte(local: string | null, distant: string | null): string | null {
  if (local === null) return distant;
  if (distant === null) return local;
  let l: Db | null = null;
  let d: Db | null = null;
  try { l = parseDb(local); } catch { /* illisible : on garde l'autre */ }
  try { d = parseDb(distant); } catch { /* illisible : on garde l'autre */ }
  if (!l) return d ? distant : local;
  if (!d) return local;
  return JSON.stringify(fusionner(l, d));
}
