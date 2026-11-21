// Tendances du journal. Jamais de note ni de « mauvais score » : des moyennes, des écarts et des phrases neutres.
import type { Nuit } from "./model.ts";
import { ajouterJours, joursEntre, minutesDuSoir, versMinutes } from "./temps.ts";

export const actives = (nuits: Nuit[]) => nuits.filter((n) => !n.supprime).sort((a, b) => a.id.localeCompare(b.id));

/** Sommeil estimé d'une nuit (minutes) : de l'endormissement au lever. Les réveils ne sont pas retirés (durée inconnue). */
export function dureeNuit(n: Nuit): number {
  const e = minutesDuSoir(n.endormi);
  const l = minutesDuSoir(n.lever);
  if (e === null || l === null) return 0;
  const d = l - e;
  return d > 0 ? d : d + 1440;
}

/** Temps pour s'endormir (minutes). */
export function latenceNuit(n: Nuit): number {
  const c = minutesDuSoir(n.coucher);
  const e = minutesDuSoir(n.endormi);
  if (c === null || e === null) return 0;
  return Math.max(0, e - c);
}

/** Les nuits des `jours` derniers jours (jusqu'au jour `fin` compris). */
export function periode(nuits: Nuit[], fin: string, jours: number): Nuit[] {
  return actives(nuits).filter((n) => n.id <= fin && joursEntre(n.id, fin) < jours);
}

export const moyenne = (v: number[]) => (v.length ? v.reduce((a, x) => a + x, 0) / v.length : 0);

export function ecartType(v: number[]): number {
  if (v.length < 2) return 0;
  const m = moyenne(v);
  return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1));
}

export function mediane(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Heure de lever en minutes depuis minuit. */
const leverMin = (n: Nuit) => versMinutes(n.lever) ?? 0;

export interface Tendances {
  nuits: number;
  dureeMoyenne: number;
  /** Écart-type des heures de lever, en minutes. */
  ecartLever: number;
  ecartCoucher: number;
  /** Indice de régularité simple : nuits dont le lever est à ± 30 min du lever habituel (médiane). */
  regulieres: number;
  leverHabituel: number;
  energieMoyenne: number;
}

export function tendances(nuits: Nuit[], fin: string, jours = 14): Tendances {
  const p = periode(nuits, fin, jours);
  const levers = p.map(leverMin);
  const med = mediane(levers);
  return {
    nuits: p.length,
    dureeMoyenne: Math.round(moyenne(p.map(dureeNuit))),
    ecartLever: Math.round(ecartType(levers)),
    ecartCoucher: Math.round(ecartType(p.map((n) => minutesDuSoir(n.coucher) ?? 0))),
    regulieres: levers.filter((l) => Math.abs(l - med) <= 30).length,
    leverHabituel: Math.round(med),
    energieMoyenne: Math.round(moyenne(p.map((n) => n.energie)) * 10) / 10,
  };
}

/** Jours d'affilée avec une nuit notée, jusqu'à aujourd'hui (ou hier si aujourd'hui n'est pas encore noté). */
export function serie(nuits: Nuit[], aujourdHui: string): number {
  const ids = new Set(actives(nuits).map((n) => n.id));
  let k = ids.has(aujourdHui) ? aujourdHui : ajouterJours(aujourdHui, -1);
  let s = 0;
  while (ids.has(k)) { s++; k = ajouterJours(k, -1); }
  return s;
}

/** Points du nuage « énergie au réveil selon la durée » (heures, énergie 1-5). */
export const pointsEnergie = (nuits: Nuit[], fin: string, jours = 60) =>
  periode(nuits, fin, jours).map((n) => ({ id: n.id, heures: dureeNuit(n) / 60, energie: n.energie }));

/** Phrase neutre comparant deux valeurs (pour les durées : « un peu plus », « un peu moins », « à peu près pareil »). */
export function evolution(avant: number, apres: number, seuil: number, plus: string, moins: string, pareil = "à peu près pareil"): string {
  if (Math.abs(apres - avant) < seuil) return pareil;
  return apres > avant ? plus : moins;
}

/** Petits constats sur le journal, toujours formulés sans jugement. */
export function constats(nuits: Nuit[], fin: string): string[] {
  const p = periode(nuits, fin, 28);
  const out: string[] = [];
  const moy = (f: (n: Nuit) => boolean) => {
    const a = p.filter(f);
    return a.length >= 3 ? moyenne(a.map((n) => n.energie)) : null;
  };
  const avecCafe = moy((n) => n.cafeine);
  const sansCafe = moy((n) => !n.cafeine);
  if (avecCafe !== null && sansCafe !== null && Math.abs(avecCafe - sansCafe) >= 0.5)
    out.push(`Énergie au réveil en moyenne ${sansCafe.toFixed(1)} sans caféine après 14 h, ${avecCafe.toFixed(1)} avec.`);
  const avecEcran = moy((n) => n.ecran);
  const sansEcran = moy((n) => !n.ecran);
  if (avecEcran !== null && sansEcran !== null && Math.abs(avecEcran - sansEcran) >= 0.5)
    out.push(`Énergie au réveil en moyenne ${sansEcran.toFixed(1)} sans écran la dernière heure, ${avecEcran.toFixed(1)} avec.`);
  const longues = p.filter((n) => latenceNuit(n) > 30).length;
  if (p.length >= 7 && longues >= p.length / 2)
    out.push("Tu mets souvent plus d'une demi-heure à t'endormir : la fiche « Insomnie » donne des pistes, et si ça dure, parles-en à un médecin.");
  if (out.length === 0 && p.length >= 7) out.push("Pas de lien net dans ton journal pour l'instant : c'est fréquent, continue à noter tranquillement.");
  return out;
}
