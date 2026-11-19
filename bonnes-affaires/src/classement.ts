// Le cœur de l'app : estimer le prix habituel de chaque annonce, l'analyser et classer les offres.
import type { Annonce, Offre, Recherche, Reglages } from "./types.ts";
import { correspond, estExclue, mediane } from "./texte.ts";
import { analyser } from "./analyse.ts";

/** En dessous de ce nombre d'annonces comparables, la médiane n'est pas fiable. */
export const MIN_POUR_MEDIANE = 5;
/** Nombre d'offres mises en avant comme « mes choix ». */
export const NOMBRE_CHOIX = 5;

/** Rattache une annonce à sa recherche (celle donnée par la source, sinon la première qui correspond). */
export function rattacher(a: Annonce, recherches: Recherche[]): Recherche | undefined {
  if (a.recherche) {
    const r = recherches.find((x) => x.nom === a.recherche);
    if (r) return r;
  }
  return recherches.find((r) => correspond(a.titre, r.mots));
}

export function classer(annonces: Annonce[], reglages: Reglages): Offre[] {
  // 1. Garder les annonces utilisables, regroupées par recherche.
  const groupes = new Map<Recherche, Annonce[]>();
  const vues = new Set<string>();
  for (const a of annonces) {
    if (!(a.prix > 0) || vues.has(a.lien)) continue;
    const r = rattacher(a, reglages.recherches);
    if (!r || estExclue(a.titre, r.exclure)) continue;
    if (r.prixMax && a.prix > r.prixMax) continue;
    // Sans livraison, l'annonce doit être dans la zone de retrait (si on connaît la distance).
    if (!a.livrable && a.distanceKm != null && a.distanceKm > reglages.distanceMaxKm) continue;
    vues.add(a.lien);
    groupes.set(r, [...(groupes.get(r) ?? []), a]);
  }

  // 2. Prix habituel, écart et analyse, recherche par recherche.
  const offres: Offre[] = [];
  for (const [r, liste] of groupes) {
    const med = liste.length >= MIN_POUR_MEDIANE ? mediane(liste.map((a) => a.prix)) : null;
    for (const a of liste) {
      let prixHabituel: number;
      let originePrix: string;
      if (a.prixHabituel) [prixHabituel, originePrix] = [a.prixHabituel, "donné par l'annonce"];
      else if (r.prixHabituel) [prixHabituel, originePrix] = [r.prixHabituel, "réglage"];
      else if (med) [prixHabituel, originePrix] = [med, `médiane de ${liste.length} annonces`];
      else continue; // pas de point de comparaison fiable

      const dansZone = a.distanceKm != null && a.distanceKm <= reglages.distanceMaxKm;
      // On va le chercher si c'est dans la zone (pas de port), sinon on se le fait livrer.
      const port = dansZone || !a.livrable ? 0 : (a.port ?? 0);
      const total = a.prix + port;
      const ecart = prixHabituel - total;
      const ecartPct = ecart / prixHabituel;
      if (ecartPct < reglages.ecartMin) continue;

      offres.push({
        ...a,
        recherche: r.nom,
        categorie: r.categorie,
        prixHabituel: arrondi(prixHabituel),
        originePrix,
        total: arrondi(total),
        ecart: arrondi(ecart),
        ecartPct,
        gainRevente: arrondi(prixHabituel * (1 - reglages.fraisRevente) - total),
        dansZone,
        ...analyser(a, ecartPct, r.categorie, originePrix, dansZone),
        choix: false,
      });
    }
  }

  // 3. Meilleure note d'abord ; à égalité, la plus proche. Puis les meilleurs choix sans méfiance.
  offres.sort((x, y) => y.score - x.score || (x.distanceKm ?? 9999) - (y.distanceKm ?? 9999));
  offres.filter((o) => o.surete !== "méfiance").slice(0, NOMBRE_CHOIX).forEach((o) => (o.choix = true));
  return offres;
}

function arrondi(n: number): number {
  return Math.round(n * 100) / 100;
}
