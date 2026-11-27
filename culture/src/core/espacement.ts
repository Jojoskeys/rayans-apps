// Révisions espacées (même principe que Rayan's Mémoire) : rappel à J+1, J+3, J+7, J+14, J+30, J+60, J+120.
// Bonne réponse → étape suivante ; mauvaise → retour à J+1, comme les boîtes de Leitner. Après la dernière étape,
// la question est « apprise » (plus de révision prévue). Les révisions tombent au début du jour.
import { dayKey, type Carte } from "./model.ts";

export const ETAPES_JOURS = [1, 3, 7, 14, 30, 60, 120];

/** Début du jour `jours` jours après `now` (à l'heure de début de journée). */
export function debutJourDans(now: number, jours: number, heureJour: number): number {
  const d = new Date(now - heureJour * 3600_000);
  d.setHours(heureJour, 0, 0, 0);
  d.setDate(d.getDate() + jours);
  return d.getTime();
}

/** Applique une réponse à une carte. La toute première bonne réponse fait passer directement à J+3. */
export function apresReponse(c: Carte, juste: boolean, now: number, heureJour: number): Carte {
  const etape = juste ? c.etape + 1 : 0;
  const fini = etape >= ETAPES_JOURS.length;
  return {
    ...c,
    etape: Math.min(etape, ETAPES_JOURS.length),
    due: fini ? null : debutJourDans(now, ETAPES_JOURS[juste ? etape : 0], heureJour),
    vues: c.vues + 1,
    justes: c.justes + (juste ? 1 : 0),
    maj: now,
  };
}

export const estNouvelle = (c: Carte) => c.vues === 0;
export const estApprise = (c: Carte) => c.vues > 0 && c.due === null;

export function cartesDues(cartes: Carte[], now: number): Carte[] {
  return cartes.filter((c) => c.vues > 0 && c.due !== null && c.due <= now).sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
}

/** Texte court pour la prochaine révision. */
export function prochaineRevision(c: Carte, now: number, heureJour: number): string {
  if (c.vues === 0) return "pas encore vue";
  if (c.due === null) return "apprise (plus de révision prévue)";
  const j = Math.round((Date.parse(dayKey(c.due, heureJour)) - Date.parse(dayKey(now, heureJour))) / 86400_000);
  if (j <= 0) return "à revoir aujourd'hui";
  if (j === 1) return "demain";
  return `dans ${j} jours`;
}
