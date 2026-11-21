// Travail profond par paliers (15 → 20 → 25 → 30 → 40 → 50 min) et journal des distractions.
// Règle (choix pratique, pas une loi prouvée) : 2 séances réussies de suite au palier actuel → palier suivant ;
// 1 séance abandonnée au palier actuel → palier précédent. Réussie = allée jusqu'au bout avec 2 distractions notées au plus.
import type { Distraction, SeanceTravail } from "./model.ts";

export const PALIERS = [15, 20, 25, 30, 40, 50];
/** Distractions notées au plus pour qu'une séance compte comme réussie. */
export const MAX_DISTRACTIONS = 2;

export interface EtatTravail {
  /** Indice dans PALIERS. */
  palier: number;
  /** Séances réussies de suite au palier actuel. */
  serie: number;
  maj: number;
}

/** reussie : terminée avec ≤ 2 distractions ; distraite : terminée avec plus ; abandonnee : arrêtée avant la fin. */
export type Issue = "reussie" | "distraite" | "abandonnee";

export function issueSeance(terminee: boolean, distractions: number): Issue {
  if (!terminee) return "abandonnee";
  return distractions <= MAX_DISTRACTIONS ? "reussie" : "distraite";
}

export const minutesPalier = (e: EtatTravail): number => PALIERS[e.palier];

/** Applique une séance. Seules les séances faites à la durée du palier actuel comptent. */
export function apresSeance(e: EtatTravail, minutes: number, issue: Issue, now: number): EtatTravail {
  if (minutes !== PALIERS[e.palier]) return e;
  if (issue === "abandonnee") return { palier: Math.max(0, e.palier - 1), serie: 0, maj: now };
  if (issue === "distraite") return { palier: e.palier, serie: 0, maj: now };
  if (e.serie + 1 >= 2) return { palier: Math.min(PALIERS.length - 1, e.palier + 1), serie: 0, maj: now };
  return { palier: e.palier, serie: e.serie + 1, maj: now };
}

/** L'utilisateur choisit lui-même son palier. */
export function choisirPalier(index: number, now: number): EtatTravail {
  return { palier: Math.min(PALIERS.length - 1, Math.max(0, Math.round(index))), serie: 0, maj: now };
}

/** Pause proposée à la fin : 3 min après un bloc court, 5 min après un bloc de 30 min ou plus. */
export const minutesPause = (minutes: number): number => (minutes >= 30 ? 5 : 3);

export const INTENTION_PROPOSEE = "Si j'ai envie de regarder mon téléphone, alors je note l'envie et je reviens à ma tâche.";

export type TypeDistraction = "telephone" | "pensee" | "bruit" | "personne" | "autre";

export const TYPES_DISTRACTION: { id: TypeDistraction; nom: string; icone: string }[] = [
  { id: "telephone", nom: "Téléphone", icone: "📱" },
  { id: "pensee", nom: "Une pensée", icone: "💭" },
  { id: "bruit", nom: "Un bruit", icone: "🔊" },
  { id: "personne", nom: "Une personne", icone: "🙋" },
  { id: "autre", nom: "Autre", icone: "❔" },
];

export interface StatsDistractions {
  total: number;
  parType: Record<TypeDistraction, number>;
  /** Nombre de distractions pour chaque heure de 0 à 23. */
  parHeure: number[];
  /** Le type le plus fréquent (null si aucune). */
  principal: TypeDistraction | null;
  /** L'heure la plus touchée (null si aucune). */
  heurePire: number | null;
}

export function statsDistractions(liste: Distraction[]): StatsDistractions {
  const parType = { telephone: 0, pensee: 0, bruit: 0, personne: 0, autre: 0 } as Record<TypeDistraction, number>;
  const parHeure = Array.from({ length: 24 }, () => 0);
  for (const d of liste) {
    parType[d.type]++;
    parHeure[new Date(d.at).getHours()]++;
  }
  let principal: TypeDistraction | null = null;
  for (const t of TYPES_DISTRACTION) if (parType[t.id] > 0 && (principal === null || parType[t.id] > parType[principal])) principal = t.id;
  const maxH = Math.max(...parHeure);
  return { total: liste.length, parType, parHeure, principal, heurePire: maxH > 0 ? parHeure.indexOf(maxH) : null };
}

/** Minutes de travail profond faites (blocs terminés ou non) et blocs réussis. */
export function bilanTravail(travaux: SeanceTravail[]): { minutes: number; reussies: number; total: number } {
  return {
    minutes: Math.round(travaux.reduce((a, s) => a + s.faites, 0)),
    reussies: travaux.filter((s) => s.issue === "reussie").length,
    total: travaux.length,
  };
}
