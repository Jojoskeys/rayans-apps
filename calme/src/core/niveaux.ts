// Difficulté qui s'adapte, règle « en escalier » : 2 réussites de suite → niveau +1, 1 échec → niveau −1.
// Dans Calme, elle ne concerne QUE la respiration : le niveau est la durée proposée (2, 3, 5 ou 10 min).
// Terminer une séance au moins aussi longue que la durée proposée = réussite ; l'arrêter avant la fin = échec ;
// terminer une séance plus courte que proposé ne change rien (c'est ton choix du jour).
import { DUREES } from "./respiration.ts";

export type ExerciceId = "respiration";

export interface InfoNiveau {
  id: ExerciceId;
  min: number;
  max: number;
  depart: number;
}

export const NIVEAUX_INFO: Record<ExerciceId, InfoNiveau> = {
  respiration: { id: "respiration", min: 0, max: DUREES.length - 1, depart: 1 },
};

export interface Niveau {
  niveau: number;
  /** Réussites de suite au niveau actuel. */
  serie: number;
  meilleur: number;
  maj: number;
}

export function niveauDepart(id: ExerciceId): Niveau {
  return { niveau: NIVEAUX_INFO[id].depart, serie: 0, meilleur: 0, maj: 0 };
}

/** Applique une réussite ou un échec. */
export function niveauSuivant(id: ExerciceId, cur: Niveau, reussite: boolean, now: number): Niveau {
  const g = NIVEAUX_INFO[id];
  const meilleur = reussite ? Math.max(cur.meilleur, cur.niveau) : cur.meilleur;
  if (!reussite) return { niveau: Math.max(g.min, cur.niveau - 1), serie: 0, meilleur, maj: now };
  if (cur.serie + 1 >= 2) return { niveau: Math.min(g.max, cur.niveau + 1), serie: 0, meilleur, maj: now };
  return { niveau: cur.niveau, serie: cur.serie + 1, meilleur, maj: now };
}

/** Durée (min) proposée pour la prochaine respiration. */
export const dureeProposee = (n: Niveau): number => DUREES[Math.min(DUREES.length - 1, Math.max(0, n.niveau))];

/**
 * Résultat d'une respiration : « reussite », « echec » ou « neutre ».
 * `dureeMin` : durée choisie ; `terminee` : allée jusqu'au bout.
 */
export function resultatRespiration(n: Niveau, dureeMin: number, terminee: boolean): "reussite" | "echec" | "neutre" {
  if (!terminee) return "echec";
  return dureeMin >= dureeProposee(n) ? "reussite" : "neutre";
}

/** Met à jour le niveau après une respiration (inchangé si « neutre »). */
export function apresRespiration(n: Niveau, dureeMin: number, terminee: boolean, now: number): Niveau {
  const r = resultatRespiration(n, dureeMin, terminee);
  return r === "neutre" ? n : niveauSuivant("respiration", n, r === "reussite", now);
}

/** Phrase affichée avant de commencer, selon ce qui vient de se passer. */
export function phraseNiveau(avant: Niveau, apres: Niveau): string | null {
  if (apres.niveau > avant.niveau) return `Deux séances terminées de suite : la prochaine te proposera ${dureeProposee(apres)} min. Tu pourras toujours choisir moins.`;
  if (apres.niveau < avant.niveau) return `Pas de souci d'avoir arrêté. La prochaine te proposera ${dureeProposee(apres)} min, plus facile à tenir.`;
  return null;
}
