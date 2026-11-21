// La séance guidée du jour : quelques exercices courts au niveau actuel (ordre qui tourne chaque jour),
// puis un bloc de travail profond proposé (facultatif, en plus des minutes de la séance).
import { TEST } from "./exercices.ts";
import { dayKey, joursEntre, type Db } from "./model.ts";
import { EXO_IDS, type ExoId } from "./niveaux.ts";

export interface Etape {
  id: string;
  exo: ExoId;
  minutes: number;
}

export interface SeanceDuJour {
  jour: string;
  etapes: Etape[];
  faites: string[];
  finie: boolean;
}

/** Nombre d'exercices selon la durée : 5 min → 2, 10 min → 4, 15 et 20 min → les 5. */
export function nbExercices(minutes: number): number {
  if (minutes <= 5) return 2;
  if (minutes <= 10) return 4;
  return 5;
}

export function seanceDuJour(db: Db, now: number): SeanceDuJour {
  const jour = dayKey(now, db.reglages.heureJour);
  const n = nbExercices(db.reglages.minutes);
  const decalage = ((joursEntre("2026-01-01", jour) % EXO_IDS.length) + EXO_IDS.length) % EXO_IDS.length;
  const ordre = [...EXO_IDS.slice(decalage), ...EXO_IDS.slice(0, decalage)].slice(0, n);
  const minutes = db.reglages.minutes / n;
  const etapes = ordre.map((exo) => ({ id: exo, exo, minutes }));
  const s = db.seances[jour];
  const faites = s?.etapes ?? [];
  return { jour, etapes, faites, finie: s?.fin !== undefined || etapes.every((e) => faites.includes(e.id)) };
}

export function marquerEtape(db: Db, etape: string, now: number): Db {
  const k = dayKey(now, db.reglages.heureJour);
  const s = db.seances[k] ?? { etapes: [] };
  const etapes = s.etapes.includes(etape) ? s.etapes : [...s.etapes, etape];
  const tout = seanceDuJour(db, now).etapes.every((e) => etapes.includes(e.id));
  const fin = s.fin ?? (tout ? now : undefined);
  if (etapes === s.etapes && fin === s.fin) return db;
  return { ...db, seances: { ...db.seances, [k]: { etapes, ...(fin !== undefined ? { fin } : {}) } } };
}

/** Jours d'affilée avec une séance terminée (aujourd'hui compte s'il est fait, sinon on part d'hier). */
export function serie(db: Db, now: number): number {
  const fini = new Set(Object.entries(db.seances).filter(([, s]) => s.fin !== undefined).map(([k]) => k));
  let n = 0;
  let t = now;
  if (!fini.has(dayKey(t, db.reglages.heureJour))) t -= 86400_000;
  while (fini.has(dayKey(t, db.reglages.heureJour))) {
    n++;
    t -= 86400_000;
  }
  return n;
}

/** Le test à proposer : « depart » s'il n'y en a jamais eu, « suivi » 7 jours ou plus après le dernier, sinon null. */
export function testPropose(db: Db, now: number): "depart" | "suivi" | null {
  if (db.tests.length === 0) return "depart";
  const dernier = Math.max(...db.tests.map((t) => t.at));
  return joursEntre(dayKey(dernier, db.reglages.heureJour), dayKey(now, db.reglages.heureJour)) >= TEST.joursEntreTests ? "suivi" : null;
}
