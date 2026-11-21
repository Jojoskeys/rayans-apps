// Petits calculs pour l'accueil et les progrès.
import type { Db, Resultat, TestResultat } from "./model.ts";
import type { ExoId } from "./niveaux.ts";

export function historique(db: Db, exo: ExoId, dernier = 30): Resultat[] {
  return db.resultats.filter((r) => r.exo === exo).slice(-dernier);
}

export function nbSeancesFinies(db: Db): number {
  return Object.values(db.seances).filter((s) => s.fin !== undefined).length;
}

/** Comparaison honnête : même épreuve, mêmes conditions. Différences « suivi − départ » (null si inconnu). */
export function comparerTests(depart: TestResultat, suivi: TestResultat) {
  const diff = (a: number | null, b: number | null) => (a !== null && b !== null ? b - a : null);
  return {
    trouvees: suivi.recherche.justes - depart.recherche.justes,
    msRecherche: diff(depart.recherche.ms, suivi.recherche.ms),
    reponsesFlanker: suivi.flanker.justes - depart.flanker.justes,
    msFlanker: diff(depart.flanker.ms, suivi.flanker.ms),
    coutFlanker: diff(depart.flanker.cout, suivi.flanker.cout),
  };
}
