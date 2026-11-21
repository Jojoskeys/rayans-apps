// Les données de Rayan's Sommeil (un seul fichier JSON, synchronisé avec l'iPhone).
import { dayKey, estJour, versMinutes } from "./temps.ts";

export { dayKey };

/** Une nuit notée le matin. L'identifiant est le jour du réveil (AAAA-MM-JJ) : une seule fiche par nuit. */
export interface Nuit {
  id: string;
  /** Heure où tu t'es couché (« 23:10 »). */
  coucher: string;
  /** Heure estimée où tu t'es endormi. */
  endormi: string;
  /** Réveils dans la nuit : 0, 1, 2, ou 3 pour « 3 ou plus ». */
  reveils: 0 | 1 | 2 | 3;
  /** Heure du lever. */
  lever: string;
  /** Énergie au réveil, de 1 (à plat) à 5 (en forme). */
  energie: 1 | 2 | 3 | 4 | 5;
  /** Sieste de la veille, en minutes (0 = aucune). */
  sieste: number;
  /** Café, thé ou boisson énergisante après 14 h, la veille. */
  cafeine: boolean;
  /** Écran dans la dernière heure avant de dormir. */
  ecran: boolean;
  /** Dernière modification (ms) : la plus récente gagne à la fusion. */
  maj: number;
  supprime?: boolean;
}

/** Petit questionnaire de la semaine (fait maison, pas un outil médical). `reponses` : indice de l'option choisie. */
export interface Bilan {
  id: string;
  at: number;
  reponses: number[];
}

export interface ElementRoutine { id: string; texte: string; actif: boolean }

export interface Lieu { name: string; lat: number; lng: number; tz: string }

/** Objectif de la semaine : rapprocher l'heure de coucher par paliers de 15 min. Heures en « minutes du soir » (0 = 18 h). */
export interface Objectif {
  /** Premier jour (AAAA-MM-JJ) de la semaine en cours, null tant que l'objectif n'a pas commencé. */
  debut: string | null;
  heure: number;
  historique: { debut: string; heure: number; tenues: number }[];
  maj: number;
}

export interface Reglages {
  /** Durée de sommeil visée, en minutes (420 à 540, par pas de 15). */
  dureeMin: number;
  /** Temps pour s'endormir, en minutes. */
  latenceMin: number;
  /** « Je me recouche après Fajr » : la nuit se fait en deux parties. */
  recoucher: boolean;
  /** Avec recoucher : heure de coucher souhaitée (« 23:00 ») et temps éveillé pour Fajr (min). */
  coucherSouhaite: string;
  pauseFajrMin: number;
  /** D'où viennent le lieu et la méthode : de Rayan's Prière si possible, sinon des réglages ci-dessous. */
  source: "priere" | "perso";
  lieu: Lieu | null;
  methode: string;
  customFajr: number;
  customIsha: number;
  highLat: string;
  /** L'heure à laquelle un nouveau jour commence (pour la série et la routine). */
  heureJour: number;
  /** La présentation du premier lancement a été vue. */
  accueilVu: boolean;
  maj: number;
}

export interface Db {
  format: "rayans-sommeil";
  version: 1;
  nuits: Nuit[];
  bilans: Bilan[];
  routine: { elements: ElementRoutine[]; maj: number };
  /** Routine du soir cochée, par jour (AAAA-MM-JJ). */
  routineFaite: Record<string, { ids: string[]; maj: number }>;
  objectif: Objectif;
  reglages: Reglages;
}

export const ROUTINE_DEFAUT: ElementRoutine[] = [
  { id: "lumiere", texte: "Baisser la lumière", actif: true },
  { id: "ecran", texte: "Ranger l'écran (téléphone hors du lit)", actif: true },
  { id: "affaires", texte: "Préparer les affaires de demain", actif: true },
  { id: "wudu", texte: "Faire le wudu", actif: true },
  { id: "dhikr", texte: "Dhikr ou lecture calme", actif: true },
  { id: "chambre", texte: "Chambre fraîche et aérée", actif: true },
  { id: "tete", texte: "Noter ce qui tourne dans la tête", actif: true },
];

export const REGLAGES_DEFAUT: Reglages = {
  dureeMin: 450, latenceMin: 15, recoucher: false, coucherSouhaite: "23:00", pauseFajrMin: 20,
  source: "priere", lieu: null, methode: "uoif", customFajr: 15, customIsha: 15, highLat: "angle",
  heureJour: 4, accueilVu: false, maj: 0,
};

export function emptyDb(): Db {
  return {
    format: "rayans-sommeil",
    version: 1,
    nuits: [],
    bilans: [],
    routine: { elements: ROUTINE_DEFAUT.map((e) => ({ ...e })), maj: 0 },
    routineFaite: {},
    objectif: { debut: null, heure: 0, historique: [], maj: 0 },
    reglages: { ...REGLAGES_DEFAUT },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, d: number): number => (typeof x === "number" && Number.isFinite(x) ? x : d);
const str = (x: unknown, d = ""): string => (typeof x === "string" ? x : d);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const heure = (x: unknown, d: string): string => (typeof x === "string" && versMinutes(x) !== null ? x.trim().padStart(5, "0") : d);

/** Lit le fichier de données, en complétant ce qui manque. Lève une erreur si ce n'est pas un fichier Sommeil. */
export function parseDb(text: string): Db {
  const raw: unknown = JSON.parse(text);
  if (!isObj(raw) || raw.format !== "rayans-sommeil") throw new Error("Ce n'est pas un fichier de Rayan's Sommeil.");
  return normaliserDb(raw);
}

export function normaliserNuit(n: Record<string, unknown>): Nuit | null {
  const id = str(n.id);
  if (!estJour(id)) return null;
  return {
    id,
    coucher: heure(n.coucher, "23:00"),
    endormi: heure(n.endormi, heure(n.coucher, "23:15")),
    reveils: borne(Math.round(num(n.reveils, 0)), 0, 3) as Nuit["reveils"],
    lever: heure(n.lever, "07:00"),
    energie: borne(Math.round(num(n.energie, 3)), 1, 5) as Nuit["energie"],
    sieste: borne(Math.round(num(n.sieste, 0)), 0, 240),
    cafeine: n.cafeine === true,
    ecran: n.ecran === true,
    maj: num(n.maj, 0),
    ...(n.supprime === true ? { supprime: true } : {}),
  };
}

export function normaliserDb(raw: Record<string, unknown>): Db {
  const d = emptyDb();
  d.nuits = arr(raw.nuits).filter(isObj).map(normaliserNuit).filter((n): n is Nuit => n !== null);
  d.bilans = arr(raw.bilans).filter(isObj).map((b) => ({
    id: str(b.id), at: num(b.at, 0), reponses: arr(b.reponses).map((r) => borne(Math.round(num(r, 0)), 0, 3)),
  })).filter((b) => b.id);
  if (isObj(raw.routine)) {
    const el = arr(raw.routine.elements).filter(isObj).map((e) => ({ id: str(e.id), texte: str(e.texte).slice(0, 120), actif: e.actif !== false })).filter((e) => e.id && e.texte);
    d.routine = { elements: el, maj: num(raw.routine.maj, 0) };
  }
  if (isObj(raw.routineFaite))
    for (const [k, v] of Object.entries(raw.routineFaite))
      if (estJour(k) && isObj(v)) d.routineFaite[k] = { ids: [...new Set(arr(v.ids).map((x) => str(x)).filter(Boolean))], maj: num(v.maj, 0) };
  if (isObj(raw.objectif)) {
    const o = raw.objectif;
    d.objectif = {
      debut: typeof o.debut === "string" && estJour(o.debut) ? o.debut : null,
      heure: borne(num(o.heure, 0), 0, 1439),
      historique: arr(o.historique).filter(isObj).map((h) => ({ debut: str(h.debut), heure: borne(num(h.heure, 0), 0, 1439), tenues: borne(num(h.tenues, 0), 0, 7) })).filter((h) => estJour(h.debut)),
      maj: num(o.maj, 0),
    };
  }
  if (isObj(raw.reglages)) {
    const r = raw.reglages;
    const l = r.lieu;
    const lieu: Lieu | null = isObj(l) && typeof l.name === "string" && Number.isFinite(l.lat) && Number.isFinite(l.lng) && typeof l.tz === "string"
      ? { name: l.name.slice(0, 80), lat: borne(l.lat as number, -89.9, 89.9), lng: borne(l.lng as number, -180, 180), tz: l.tz }
      : null;
    const df = REGLAGES_DEFAUT;
    d.reglages = {
      dureeMin: borne(Math.round(num(r.dureeMin, df.dureeMin) / 15) * 15, 420, 540),
      latenceMin: borne(Math.round(num(r.latenceMin, df.latenceMin)), 0, 60),
      recoucher: r.recoucher === true,
      coucherSouhaite: heure(r.coucherSouhaite, df.coucherSouhaite),
      pauseFajrMin: borne(Math.round(num(r.pauseFajrMin, df.pauseFajrMin)), 5, 90),
      source: r.source === "perso" ? "perso" : "priere",
      lieu,
      methode: str(r.methode, df.methode),
      customFajr: borne(num(r.customFajr, df.customFajr), 5, 25),
      customIsha: borne(num(r.customIsha, df.customIsha), 5, 25),
      highLat: str(r.highLat, df.highLat),
      heureJour: borne(Math.round(num(r.heureJour, df.heureJour)), 0, 12),
      accueilVu: r.accueilVu === true,
      maj: num(r.maj, 0),
    };
  }
  return d;
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
  out.nuits = plusRecentParId(local.nuits, distant.nuits, (n) => n.maj).sort((x, y) => x.id.localeCompare(y.id));
  out.bilans = plusRecentParId(local.bilans, distant.bilans, () => 0).sort((x, y) => x.at - y.at);
  out.routine = local.routine.maj >= distant.routine.maj ? local.routine : distant.routine;
  for (const k of new Set([...Object.keys(local.routineFaite), ...Object.keys(distant.routineFaite)])) {
    const a = local.routineFaite[k];
    const b = distant.routineFaite[k];
    out.routineFaite[k] = !a ? b : !b ? a : a.maj >= b.maj ? a : b;
  }
  out.objectif = local.objectif.maj >= distant.objectif.maj ? local.objectif : distant.objectif;
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
