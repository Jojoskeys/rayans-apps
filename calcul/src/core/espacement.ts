// Révision espacée simple des calculs ratés : un calcul raté revient plus tard dans la même série
// (3 questions après), puis le lendemain, puis à J+3 et J+7. Raté à nouveau → retour à demain.
import type { Db, FaitARevoir } from "./model.ts";
import { cleDe, type Question } from "./question.ts";

export const INTERVALLES_JOURS = [1, 3, 7];
/** Une question ratée est reposée après ce nombre d'autres questions, dans la même série. */
export const REPOSER_APRES = 3;

/** Début du jour `jours` jours après `now` (à l'heure de début de journée). */
export function debutJourDans(now: number, jours: number, heureJour: number): number {
  const d = new Date(now - heureJour * 3600_000);
  d.setHours(heureJour, 0, 0, 0);
  d.setDate(d.getDate() + jours);
  return d.getTime();
}

/** Met à jour la liste « à revoir » après une réponse. */
export function apresReponse(revoir: FaitARevoir[], q: Question, juste: boolean, now: number, heureJour: number): FaitARevoir[] {
  const cle = cleDe(q);
  const f = revoir.find((x) => x.cle === cle);
  if (!juste) {
    const nouveau: FaitARevoir = {
      cle, texte: q.texte, reponse: q.reponse, etapes: q.etapes, type: q.type, niveau: q.niveau, a: q.a, b: q.b, op: q.op,
      ...(q.astuce ? { astuce: q.astuce } : {}),
      etape: 0, due: debutJourDans(now, INTERVALLES_JOURS[0], heureJour), rates: (f?.rates ?? 0) + 1, maj: now,
    };
    return f ? revoir.map((x) => (x.cle === cle ? nouveau : x)) : [...revoir, nouveau];
  }
  // Juste : on n'avance que si c'était une révision prévue (le fait était dû).
  if (!f || f.fini || !q.revision || f.due > now) return revoir;
  const etape = f.etape + 1;
  const fini = etape >= INTERVALLES_JOURS.length;
  const maj: FaitARevoir = fini
    ? { ...f, etape, fini: true, maj: now }
    : { ...f, etape, due: debutJourDans(now, INTERVALLES_JOURS[etape], heureJour), maj: now };
  return revoir.map((x) => (x.cle === cle ? maj : x));
}

/** Les calculs à revoir aujourd'hui (les plus anciens d'abord). */
export function faitsDus(db: Db, now: number): FaitARevoir[] {
  return db.revoir.filter((f) => !f.fini && f.due <= now).sort((a, b) => a.due - b.due);
}

export function enQuestion(f: FaitARevoir): Question {
  return { texte: f.texte, reponse: f.reponse, etapes: f.etapes, type: f.type, niveau: f.niveau, a: f.a, b: f.b, op: f.op, revision: true, ...(f.astuce ? { astuce: f.astuce } : {}) };
}

// ----- File des questions à reposer dans la même série ---------------------------------------------------------
export interface AReposer { q: Question; dans: number }

/** Ajoute une question ratée : elle reviendra après `REPOSER_APRES` autres questions. */
export function planifierReposer(file: AReposer[], q: Question): AReposer[] {
  return [...file.filter((x) => x.q.texte !== q.texte), { q: { ...q }, dans: REPOSER_APRES }];
}

/** Avance d'une question ; renvoie la question à reposer maintenant (s'il y en a une) et la nouvelle file. */
export function tirerReposer(file: AReposer[]): { q: Question | null; file: AReposer[] } {
  const avance = file.map((x) => ({ ...x, dans: x.dans - 1 }));
  const i = avance.findIndex((x) => x.dans <= 0);
  if (i < 0) return { q: null, file: avance };
  return { q: avance[i].q, file: avance.filter((_, j) => j !== i) };
}
