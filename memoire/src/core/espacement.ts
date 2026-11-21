// Révisions espacées des listes rangées dans un palais (rappel actif à J+1, J+3, J+7, J+14, J+30, J+60, J+120).
// Bien retrouvée (≥ 80 %) → étape suivante ; à moitié → même étape ; mal retrouvée (< 50 %) → retour à J+1,
// comme les boîtes de Leitner. Les révisions tombent au début du jour (heure de début de journée).
import { dayKey, type Liste } from "./model.ts";

export const ETAPES_JOURS = [1, 3, 7, 14, 30, 60, 120];

/** Début du jour `jours` jours après `now` (à l'heure de début de journée). */
export function debutJourDans(now: number, jours: number, heureJour: number): number {
  const d = new Date(now - heureJour * 3600_000);
  d.setHours(heureJour, 0, 0, 0);
  d.setDate(d.getDate() + jours);
  return d.getTime();
}

export function premiereRevision(now: number, heureJour: number): { due: number; etape: number } {
  return { due: debutJourDans(now, ETAPES_JOURS[0], heureJour), etape: 0 };
}

/** Applique un rappel (part retrouvée entre 0 et 1). */
export function apresRappel(l: Liste, part: number, now: number, heureJour: number): Liste {
  let etape = l.etape;
  if (part >= 0.8) etape = l.etape + 1;
  else if (part < 0.5) etape = 0;
  const fini = etape >= ETAPES_JOURS.length;
  const due = fini ? null : debutJourDans(now, ETAPES_JOURS[etape], heureJour);
  return { ...l, etape: Math.min(etape, ETAPES_JOURS.length), due, rappels: [...l.rappels, { at: now, part }], updatedAt: now };
}

export function listesDues(listes: Liste[], now: number): Liste[] {
  return listes.filter((l) => !l.deleted && l.due !== null && l.due <= now).sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
}

/** Texte court pour la prochaine révision. */
export function prochaineRevision(l: Liste, now: number, heureJour: number): string {
  if (l.due === null) return "apprise (plus de révision prévue)";
  const j = Math.round((Date.parse(dayKey(l.due, heureJour)) - Date.parse(dayKey(now, heureJour))) / 86400_000);
  if (j <= 0) return "à réviser aujourd'hui";
  if (j === 1) return "demain";
  return `dans ${j} jours`;
}
