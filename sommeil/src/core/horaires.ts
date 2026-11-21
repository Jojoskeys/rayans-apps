// Heure de coucher conseillée à partir de Fajr. Le calcul de Fajr est celui de Rayan's Prière (même dépôt), réutilisé tel quel.
import { CITIES } from "../../../priere/src/core/cities.ts";
import { computeDay, METHODS, type CalcParams, type HighLatRule, type MethodId } from "../../../priere/src/core/praytimes.ts";
import { calcParams, normalizeData } from "../../../priere/src/core/settings.ts";
import type { Lieu, Reglages } from "./model.ts";
import { ajouterJours, dayKey, partiesJour, versMinutes } from "./temps.ts";

export { METHODS };

/** Villes de France proposées (celles de Rayan's Prière). */
export const VILLES: Lieu[] = CITIES.filter((c) => c.country === "France").map((c) => ({ name: c.name, lat: c.lat, lng: c.lng, tz: c.tz }));

export const LIEU_PAR_DEFAUT: Lieu = VILLES.find((v) => v.name === "Paris")!;

export interface ParamsFajr {
  calc: CalcParams;
  lieu: string;
  /** D'où viennent les réglages : Rayan's Prière, ceux de Sommeil, ou Paris par défaut. */
  origine: "priere" | "perso" | "defaut";
}

/** Lit le JSON de Rayan's Prière (priere.json) ; null s'il est absent, illisible ou sans lieu choisi. */
export function paramsDepuisPriere(texte: string | null): ParamsFajr | null {
  if (!texte) return null;
  try {
    const s = normalizeData(JSON.parse(texte)).settings;
    const calc = calcParams(s);
    if (!calc || !s.place) return null;
    return { calc, lieu: s.place.name, origine: "priere" };
  } catch {
    return null;
  }
}

const METHODES_IDS = METHODS.map((m) => m.id) as string[];
const HIGHLAT: HighLatRule[] = ["angle", "milieu", "septieme", "aucune"];

/** Les paramètres à utiliser : Prière si disponible et choisi, sinon ceux de Sommeil, sinon Paris (méthode UOIF). */
export function paramsFajr(r: Reglages, priere: ParamsFajr | null): ParamsFajr {
  if (r.source === "priere" && priere) return priere;
  const lieu = r.lieu ?? LIEU_PAR_DEFAUT;
  const calc: CalcParams = {
    lat: lieu.lat, lng: lieu.lng, timeZone: lieu.tz,
    method: (METHODES_IDS.includes(r.methode) ? r.methode : "uoif") as MethodId,
    customFajr: r.customFajr, customIsha: r.customIsha, asr: "shafii",
    highLat: (HIGHLAT.includes(r.highLat as HighLatRule) ? r.highLat : "angle") as HighLatRule,
  };
  return { calc, lieu: lieu.name, origine: r.lieu ? "perso" : "defaut" };
}

/** Fajr (instant en ms) d'un jour AAAA-MM-JJ au lieu donné. */
export function fajrDu(calc: CalcParams, jour: string): number {
  const [y, m, d] = partiesJour(jour);
  return computeDay(calc, y, m, d).fajr;
}

/** Instant local du jour `jour` à l'heure « HH:MM » ; une heure avant midi est comptée le lendemain (nuit). */
export function instantDuSoir(jour: string, hhmm: string): number {
  const min = versMinutes(hhmm) ?? 23 * 60;
  const [y, m, d] = partiesJour(jour);
  return new Date(y, m - 1, d + (min < 12 * 60 ? 1 : 0), Math.floor(min / 60), min % 60).getTime();
}

export interface ConseilNuit {
  /** Soirée concernée (AAAA-MM-JJ) : la nuit qui suit ce jour. */
  soir: string;
  fajr: number;
  coucher: number;
  endormi: number;
  /** Heure de lever finale (Fajr, ou après la 2ᵉ partie de nuit). */
  lever: number;
  /** Sommeil avant Fajr et, si besoin, après (minutes). */
  partie1: number;
  partie2: number;
  /** Reprise du sommeil après Fajr (seulement avec « je me recouche »). */
  reprise: number | null;
  debutRoutine: number;
  dernierCafe: number;
  /** NaN possible pour Fajr près des pôles : alors pas de conseil. */
  valide: boolean;
}

const MIN = 60_000;

/**
 * Conseil pour la nuit qui suit le jour `soir` :
 * - nuit d'un bloc : coucher = Fajr du lendemain − durée visée − temps pour s'endormir, lever à Fajr ;
 * - « je me recouche après Fajr » : coucher à l'heure souhaitée, 1ʳᵉ partie jusqu'à Fajr, puis 2ᵉ partie pour compléter.
 */
export function conseilNuit(calc: CalcParams, r: Reglages, soir: string): ConseilNuit {
  const fajr = fajrDu(calc, ajouterJours(soir, 1));
  const duree = r.dureeMin;
  const lat = r.latenceMin;
  let coucher: number, endormi: number, lever: number, partie1: number, partie2 = 0, reprise: number | null = null;
  if (!r.recoucher) {
    endormi = fajr - duree * MIN;
    coucher = endormi - lat * MIN;
    lever = fajr;
    partie1 = duree;
  } else {
    coucher = instantDuSoir(soir, r.coucherSouhaite);
    endormi = coucher + lat * MIN;
    partie1 = Math.max(0, Math.round((fajr - endormi) / MIN));
    if (partie1 >= duree) lever = fajr;
    else {
      partie2 = duree - partie1;
      reprise = fajr + r.pauseFajrMin * MIN;
      lever = reprise + (lat + partie2) * MIN;
    }
  }
  return {
    soir, fajr, coucher, endormi, lever, partie1, partie2, reprise,
    debutRoutine: coucher - 45 * MIN,
    dernierCafe: coucher - 6 * 60 * MIN,
    valide: Number.isFinite(fajr),
  };
}

/** La soirée dont on parle maintenant : celle du jour en cours (la journée commence à `heureJour`). */
export const soirDuJour = (now: number, heureJour: number) => dayKey(now, heureJour);

/** « Ce matin » entre le début du jour et 14 h, sinon « Ce soir ». */
export function moment(now: number, heureJour: number): "matin" | "soir" {
  const h = new Date(now).getHours();
  return h >= heureJour && h < 14 ? "matin" : "soir";
}
