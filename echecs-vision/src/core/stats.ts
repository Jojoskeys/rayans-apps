// Petits calculs pour l'accueil et les progrès.
import type { Db, Resultat } from "./model.ts";
import type { ExoId } from "./niveaux.ts";

export function historique(db: Db, exo: ExoId, dernier = 30): Resultat[] {
  return db.resultats.filter((r) => r.exo === exo).slice(-dernier);
}

/** Part de réussite sur les `n` dernières manches (null s'il n'y en a pas). */
export function tauxReussite(db: Db, exo: ExoId, n = 20): number | null {
  const h = historique(db, exo, n);
  return h.length ? h.filter((r) => r.reussi).length / h.length : null;
}

/** Tactiques : vues, acquises (plus de révision prévue), et à l'étape 3 ou plus (J+7 passé). */
export function bilanTactiques(db: Db): { vues: number; solides: number; acquises: number } {
  const cartes = Object.values(db.cartes);
  return { vues: cartes.length, solides: cartes.filter((c) => c.etape >= 3).length, acquises: cartes.filter((c) => c.due === null).length };
}

export function nbSeancesFinies(db: Db): number {
  return Object.values(db.seances).filter((s) => s.fin !== undefined).length;
}
