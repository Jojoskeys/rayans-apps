// La séance du jour (~10 min) : 3 positions à reconstruire, 6 questions de vision, 6 tactiques
// (révisions dues d'abord). Une étape finie est notée dans db.seances[jour].
import { dayKey, joursEntre, type Db } from "./model.ts";
import type { ExoId } from "./niveaux.ts";

export interface Etape { id: ExoId; titre: string; manches: number; minutes: number; faite: boolean }

export const ETAPES: Omit<Etape, "faite">[] = [
  { id: "memoire", titre: "Mémoire de position", manches: 3, minutes: 3 },
  { id: "vision", titre: "Vision sans échiquier", manches: 6, minutes: 3 },
  { id: "tactiques", titre: "Tactiques à revoir et nouvelles", manches: 6, minutes: 4 },
];

export function seanceDuJour(db: Db, now: number): { jour: string; etapes: Etape[]; finie: boolean } {
  const jour = dayKey(now, db.reglages.heureJour);
  const faites = db.seances[jour]?.etapes ?? [];
  const etapes = ETAPES.map((e) => ({ ...e, faite: faites.includes(e.id) }));
  return { jour, etapes, finie: etapes.every((e) => e.faite) };
}

/** Note une étape comme faite (et la séance comme finie si c'était la dernière). */
export function etapeFaite(db: Db, id: ExoId, now: number): Db {
  const jour = dayKey(now, db.reglages.heureJour);
  const cur = db.seances[jour] ?? { etapes: [] };
  if (cur.etapes.includes(id)) return db;
  const etapes = [...cur.etapes, id];
  const finie = ETAPES.every((e) => etapes.includes(e.id));
  return { ...db, seances: { ...db.seances, [jour]: { etapes, ...(finie ? { fin: now } : cur.fin !== undefined ? { fin: cur.fin } : {}) } } };
}

/** Jours de suite avec une séance finie (aujourd'hui compris s'il est fait, sinon jusqu'à hier). */
export function serieJours(db: Db, now: number): number {
  const jours = Object.entries(db.seances).filter(([, s]) => s.fin !== undefined).map(([k]) => k).sort();
  if (!jours.length) return 0;
  const auj = dayKey(now, db.reglages.heureJour);
  let dernier = jours[jours.length - 1];
  if (joursEntre(dernier, auj) > 1) return 0;
  let n = 1;
  for (let i = jours.length - 2; i >= 0; i--) {
    if (joursEntre(jours[i], dernier) !== 1) break;
    n++;
    dernier = jours[i];
  }
  return n;
}
