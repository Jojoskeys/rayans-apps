// Révisions espacées des tactiques (même principe que Rayan's Mémoire) : rappel actif à J+1, J+3, J+7, J+14,
// J+30, J+60, J+120. Trouvée → étape suivante ; ratée → retour à J+1, comme les boîtes de Leitner.
// Les révisions tombent au début du jour (heure de début de journée).
import { dayKey, type Carte, type Db } from "./model.ts";
import { niveauTactique } from "./niveaux.ts";
import { shuffle, type Rng } from "./rng.ts";
import { TACTIQUES, type Tactique } from "./tactiques.ts";

export const ETAPES_JOURS = [1, 3, 7, 14, 30, 60, 120];

/** Début du jour `jours` jours après `now` (à l'heure de début de journée). */
export function debutJourDans(now: number, jours: number, heureJour: number): number {
  const d = new Date(now - heureJour * 3600_000);
  d.setHours(heureJour, 0, 0, 0);
  d.setDate(d.getDate() + jours);
  return d.getTime();
}

/** Applique un essai sur une tactique (carte absente = première fois). */
export function apresEssai(c: Carte | undefined, bon: boolean, now: number, heureJour: number): Carte {
  const etape = !c ? (bon ? 1 : 0) : bon ? c.etape + 1 : 0;
  const fini = etape >= ETAPES_JOURS.length;
  return {
    etape: Math.min(etape, ETAPES_JOURS.length),
    due: fini ? null : debutJourDans(now, ETAPES_JOURS[etape], heureJour),
    essais: (c?.essais ?? 0) + 1,
    reussites: (c?.reussites ?? 0) + (bon ? 1 : 0),
    maj: now,
  };
}

/** Tactiques à revoir maintenant, la plus en retard d'abord. */
export function tactiquesDues(db: Db, now: number): Tactique[] {
  return TACTIQUES.filter((t) => {
    const c = db.cartes[t.id];
    return c && c.due !== null && c.due <= now;
  }).sort((a, b) => (db.cartes[a.id].due ?? 0) - (db.cartes[b.id].due ?? 0));
}

/** Tactiques jamais vues, du niveau visé d'abord, puis les plus proches. */
export function tactiquesNeuves(db: Db, rng: Rng): Tactique[] {
  const cible = niveauTactique(db.niveaux.tactiques.level);
  const neuves = shuffle(rng, TACTIQUES.filter((t) => !db.cartes[t.id]));
  return neuves.sort((a, b) => Math.abs(a.niveau - cible) - Math.abs(b.niveau - cible));
}

/** La série de tactiques d'une séance : d'abord les révisions dues, puis des nouvelles, `n` au total. */
export function serieTactiques(db: Db, now: number, rng: Rng, n = 6): Tactique[] {
  const dues = tactiquesDues(db, now).slice(0, n);
  return [...dues, ...tactiquesNeuves(db, rng).slice(0, n - dues.length)];
}

/** Texte court pour la prochaine révision. */
export function prochaineRevision(c: Carte, now: number, heureJour: number): string {
  if (c.due === null) return "acquise (plus de révision prévue)";
  const j = Math.round((Date.parse(dayKey(c.due, heureJour)) - Date.parse(dayKey(now, heureJour))) / 86400_000);
  if (j <= 0) return "à revoir aujourd'hui";
  if (j === 1) return "demain";
  return `dans ${j} jours`;
}
