// Révisions espacées des mots, même logique que Rayan's Mémoire (boîtes de Leitner) : rappel juste → étape suivante
// (J+1, J+3, J+7, J+14, J+30, J+60, J+120, puis tous les 120 jours) ; rappel faux → retour à J+1.
// Les révisions tombent au début du jour (heure de début de journée).
import { dayKey, type Carte } from "./model.ts";
import type { Langue } from "./langues.ts";

export const ETAPES_JOURS = [1, 3, 7, 14, 30, 60, 120];
/** Un mot est « su » à partir de l'étape 3 (il a tenu une semaine). */
export const ETAPE_SU = 3;

/** Début du jour `jours` jours après `now` (à l'heure de début de journée). */
export function debutJourDans(now: number, jours: number, heureJour: number): number {
  const d = new Date(now - heureJour * 3600_000);
  d.setHours(heureJour, 0, 0, 0);
  d.setDate(d.getDate() + jours);
  return d.getTime();
}

const jours = (etape: number) => ETAPES_JOURS[Math.min(etape, ETAPES_JOURS.length - 1)];

/** Nouvelle carte, à la découverte d'un mot : première révision demain. */
export function nouvelleCarte(langue: Langue, mot: string, now: number, heureJour: number): Carte {
  return { id: `${langue}:${mot}`, langue, mot, vu: now, etape: 0, due: debutJourDans(now, 1, heureJour), justes: 0, fautes: 0, maj: now };
}

/** Applique un rappel. */
export function apresRappel(c: Carte, juste: boolean, now: number, heureJour: number): Carte {
  const etape = juste ? c.etape + 1 : 0;
  return {
    ...c, etape, due: debutJourDans(now, jours(juste ? etape : 0), heureJour),
    justes: c.justes + (juste ? 1 : 0), fautes: c.fautes + (juste ? 0 : 1), maj: now,
  };
}

export function cartesDues(cartes: Carte[], langue: Langue, now: number): Carte[] {
  return cartes.filter((c) => c.langue === langue && c.due <= now).sort((a, b) => a.due - b.due || a.etape - b.etape);
}

export const estSu = (c: Carte): boolean => c.etape >= ETAPE_SU;

/** Mots découverts aujourd'hui dans cette langue (pour la limite de nouveaux mots par jour). */
export function nouveauxAujourdhui(cartes: Carte[], langue: Langue, now: number, heureJour: number): number {
  const j = dayKey(now, heureJour);
  return cartes.filter((c) => c.langue === langue && dayKey(c.vu, heureJour) === j).length;
}

/** Texte court pour la prochaine révision. */
export function prochaineRevision(c: Carte, now: number, heureJour: number): string {
  const j = Math.round((Date.parse(dayKey(c.due, heureJour)) - Date.parse(dayKey(now, heureJour))) / 86400_000);
  if (j <= 0) return "à réviser aujourd'hui";
  if (j === 1) return "demain";
  return `dans ${j} jours`;
}
