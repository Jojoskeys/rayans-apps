// Petits calculs pour l'accueil et les progrès.
import { MAJOR_MOTS, majorCle } from "./contenu.ts";
import type { Db, Resultat } from "./model.ts";

export const motMajor = (db: Db, n: number): string => db.major.mots[majorCle(n)] ?? MAJOR_MOTS[n];

export function historique(db: Db, jeu: Resultat["jeu"], dernier = 30): Resultat[] {
  return db.resultats.filter((r) => r.jeu === jeu).slice(-dernier);
}

/** Les tests de départ et de suivi, dans l'ordre. */
export function tests(db: Db): Resultat[] {
  return db.resultats.filter((r) => r.jeu === "test-mots" || r.jeu === "test-chiffres");
}

export function nbSeancesFinies(db: Db): number {
  return Object.values(db.seances).filter((s) => s.fin !== undefined).length;
}
