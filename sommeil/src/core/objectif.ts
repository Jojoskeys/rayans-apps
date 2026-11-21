// Objectif de la semaine : on rapproche l'heure de coucher de l'heure conseillée par paliers de 15 min,
// seulement quand la semaine précédente a été tenue (5 nuits sur 7). Sinon, on garde le même objectif, sans reproche.
import type { Nuit, Objectif } from "./model.ts";
import { ajouterJours, joursEntre, minutesDuSoir, quartSup } from "./temps.ts";

export const PALIER = 15;
export const NUITS_POUR_AVANCER = 5;
/** Marge : coucher jusqu'à 10 min après l'objectif compte comme tenu. */
export const MARGE = 10;
/** Nuits notées (sur 14 jours) avant de fixer le premier objectif. */
export const NUITS_POUR_DEMARRER = 3;

/** Habitude actuelle : médiane des heures de coucher des 7 dernières nuits notées (minutes du soir), ou null. */
export function habitudeCoucher(nuits: Nuit[], jusquA: string): number | null {
  const v = nuits
    .filter((n) => !n.supprime && n.id <= jusquA && joursEntre(n.id, jusquA) < 14)
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 7)
    .map((n) => minutesDuSoir(n.coucher))
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

/** Nuits tenues de la semaine qui commence le jour `debut` (nuits dont le réveil est entre debut et debut + 6). */
export function nuitsTenues(nuits: Nuit[], debut: string, heure: number): number {
  const parJour = new Map(nuits.filter((n) => !n.supprime).map((n) => [n.id, n]));
  let tenues = 0;
  for (let i = 0; i < 7; i++) {
    const n = parJour.get(ajouterJours(debut, i));
    const c = n ? minutesDuSoir(n.coucher) : null;
    if (c !== null && c <= heure + MARGE) tenues++;
  }
  return tenues;
}

/**
 * Met l'objectif à jour pour le jour `aujourdHui`. `cible` = heure conseillée (minutes du soir).
 * Renvoie le même objet si rien ne change (pas d'écriture inutile).
 */
export function majObjectif(o: Objectif, nuits: Nuit[], aujourdHui: string, cible: number, now: number): Objectif {
  if (o.debut === null) {
    // On attend 3 nuits notées pour connaître l'habitude : on part d'elle, pas d'un objectif hors d'atteinte.
    const notees = nuits.filter((n) => !n.supprime && n.id <= aujourdHui && joursEntre(n.id, aujourdHui) < 14).length;
    const hab = habitudeCoucher(nuits, aujourdHui);
    if (hab === null || notees < NUITS_POUR_DEMARRER) return o;
    const depart = Math.max(cible, Math.min(1439, quartSup(hab)));
    return { debut: aujourdHui, heure: depart, historique: [], maj: now };
  }
  let { debut, heure } = o;
  const historique = [...o.historique];
  let change = false;
  while (joursEntre(debut, aujourdHui) >= 7) {
    const tenues = nuitsTenues(nuits, debut, heure);
    historique.push({ debut, heure, tenues });
    if (tenues >= NUITS_POUR_AVANCER) heure = Math.max(cible, heure - PALIER);
    debut = ajouterJours(debut, 7);
    change = true;
  }
  // Un objectif plus tôt que l'heure conseillée ne sert à rien (Fajr se décale avec les saisons).
  if (heure < cible) { heure = cible; change = true; }
  if (!change) return o;
  return { debut, heure, historique: historique.slice(-52), maj: now };
}

/** Phrase neutre sur la dernière semaine terminée. */
export function phraseObjectif(o: Objectif, cible: number): string {
  const der = o.historique[o.historique.length - 1];
  if (o.heure <= cible) return "Tu es à l'heure conseillée : l'objectif est simplement de la garder.";
  if (!der) return `Première semaine : vise ce coucher au moins ${NUITS_POUR_AVANCER} nuits sur 7. Ensuite, on avancera de ${PALIER} min.`;
  if (der.heure > o.heure) return `Semaine passée tenue ${der.tenues} nuits sur 7 : nouveau palier, ${PALIER} min plus tôt.`;
  return `Semaine passée : ${der.tenues} nuit${der.tenues > 1 ? "s" : ""} sur 7. On garde le même palier une semaine de plus, c'est normal.`;
}
