// La séance du jour : respiration → « Nommer et réévaluer » OU gratitude (en alternance) → mot de fin.
// Plus la séance est longue, plus la respiration dure ; à 20 min, on ajoute la relaxation musculaire.
import { pick, makeRng } from "./rng.ts";

export type TypeEtape = "respiration" | "nommer" | "gratitude" | "relaxation" | "fin";

export interface Etape {
  type: TypeEtape;
  /** Durée indicative en minutes. */
  min: number;
}

export const DUREES_SEANCE = [5, 10, 15, 20] as const;
export type DureeSeance = (typeof DUREES_SEANCE)[number];

const RESPI: Record<DureeSeance, number> = { 5: 2, 10: 3, 15: 5, 20: 5 };

/**
 * Plan de la séance. `nbSeances` : nombre de séances déjà terminées (pour alterner nommer / gratitude).
 */
export function planSeance(duree: DureeSeance, nbSeances: number): Etape[] {
  const respi = RESPI[duree] ?? 3;
  const ecrit: TypeEtape = nbSeances % 2 === 0 ? "nommer" : "gratitude";
  const etapes: Etape[] = [{ type: "respiration", min: respi }];
  const relax = duree === 20 ? 5 : 0;
  etapes.push({ type: ecrit, min: duree - respi - relax - 1 });
  if (relax) etapes.push({ type: "relaxation", min: relax });
  etapes.push({ type: "fin", min: 1 });
  return etapes;
}

export const NOM_ETAPE: Record<TypeEtape, string> = {
  respiration: "Respiration lente",
  nommer: "Nommer et réévaluer",
  gratitude: "3 choses bien",
  relaxation: "Relaxation musculaire",
  fin: "Mot de fin",
};

/** Mots de fin : simples, sans promesse. */
export const MOTS_DE_FIN = [
  "Tu as pris ce temps pour toi. C'est ça qui compte, pas la perfection.",
  "Bien joué d'être venu aujourd'hui. Demain, on recommence, tranquillement.",
  "Ce que tu ressens a le droit d'exister. Tu viens d'apprendre à le regarder un peu mieux.",
  "Un moment calme de plus dans ta journée. Garde ce rythme de respiration pour plus tard si besoin.",
  "Pas besoin que tout aille parfaitement pour avancer. Merci d'avoir pris soin de toi.",
  "Rappel : si un jour ça ne va vraiment pas, le bouton d'aide est toujours là, en haut.",
];

/** Le mot de fin du jour (le même toute la journée). */
export function motDuJour(jour: string): string {
  let h = 0;
  for (const c of jour) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return pick(makeRng(h), MOTS_DE_FIN);
}
