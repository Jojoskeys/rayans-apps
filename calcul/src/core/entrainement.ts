// L'entraînement adaptatif : les types sont MÉLANGÉS (jamais deux fois le même de suite quand c'est possible),
// chaque type a son niveau, et les calculs ratés reviennent (même série, puis les jours suivants).
import { ASTUCES } from "./astuces.ts";
import { apresReponse, enQuestion, faitsDus } from "./espacement.ts";
import { genererQuestion } from "./generateur.ts";
import type { Db } from "./model.ts";
import { nextLevel } from "./niveaux.ts";
import type { AstuceId, Question, TypeId } from "./question.ts";
import { pick, type Rng } from "./rng.ts";

/** Les astuces déjà travaillées (au moins une série de 10 exercices faite). */
export function astucesVues(db: Db): AstuceId[] {
  const faites = new Set(db.resultats.filter((r) => r.sorte === "astuce").map((r) => r.ref));
  return ASTUCES.map((a) => a.id).filter((id) => faites.has(id));
}

/** Les types proposés : × 2 chiffres une fois le × 1 chiffre bien parti, les astuces une fois apprises. */
export function typesActifs(db: Db): TypeId[] {
  const t: TypeId[] = ["addition", "soustraction", "tables", "mult1", "pourcentages"];
  if (db.niveaux.mult1.niveau >= 3 || db.niveaux.mult2.record > 0) t.push("mult2");
  if (astucesVues(db).length) t.push("astuces");
  return t;
}

/** Un type au hasard, différent des deux derniers si possible (entrelacement). */
export function choisirType(actifs: TypeId[], derniers: TypeId[], rng: Rng): TypeId {
  const eviter = new Set(derniers.slice(-2));
  const libres = actifs.filter((t) => !eviter.has(t));
  if (libres.length) return pick(rng, libres);
  const pasLeDernier = actifs.filter((t) => t !== derniers[derniers.length - 1]);
  return pick(rng, pasLeDernier.length ? pasLeDernier : actifs);
}

/**
 * La prochaine question de l'entraînement. Toutes les 4 questions, un calcul raté un autre jour (s'il y en a
 * un de dû et qu'il n'a pas été posé récemment) ; sinon une nouvelle question d'un type mélangé, à son niveau.
 */
export function prochaineQuestion(db: Db, deja: Question[], now: number, rng: Rng): Question {
  const recents = new Set(deja.slice(-6).map((q) => q.texte));
  if (deja.length % 4 === 3) {
    const f = faitsDus(db, now).find((x) => !recents.has(x.texte));
    if (f) return enQuestion(f);
  }
  const type = choisirType(typesActifs(db), deja.map((q) => q.type), rng);
  let q = genererQuestion(type, db.niveaux[type].niveau, rng, astucesVues(db));
  for (let i = 0; i < 10 && recents.has(q.texte); i++) q = genererQuestion(type, db.niveaux[type].niveau, rng, astucesVues(db));
  return q;
}

/** Applique une réponse de l'entraînement : niveau du type (sauf révision) et liste « à revoir ». */
export function appliquerReponse(db: Db, q: Question, juste: boolean, now: number): Db {
  const out: Db = { ...db, revoir: apresReponse(db.revoir, q, juste, now, db.reglages.heureJour) };
  if (!q.revision) out.niveaux = { ...db.niveaux, [q.type]: nextLevel(q.type, db.niveaux[q.type], juste, now) };
  return out;
}

/** Mode « Estimer d'abord » : des calculs où estimer a du sens (gros nombres), au niveau de chacun. */
export function questionEstimation(db: Db, deja: Question[], rng: Rng): Question {
  const choix: { type: TypeId; min: number }[] = [
    { type: "addition", min: 4 },
    { type: "soustraction", min: 4 },
    { type: "mult1", min: 2 },
    { type: "mult2", min: 1 },
    { type: "pourcentages", min: 3 },
  ];
  const type = choisirType(choix.map((c) => c.type), deja.map((q) => q.type), rng);
  const min = choix.find((c) => c.type === type)!.min;
  return genererQuestion(type, Math.max(min, db.niveaux[type].niveau), rng);
}
