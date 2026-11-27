import { FICHES, QUIZ, SOURCES } from "../src/core/contenu";

/** Chaque fiche cite des sources connues, chaque question du quiz renvoie à une fiche existante. */
export function CONTENU_OK(): boolean {
  const sources = new Set(SOURCES.map((s) => s.id));
  const fiches = new Set(FICHES.map((f) => f.id));
  if (fiches.size !== FICHES.length || new Set(QUIZ.map((q) => q.id)).size !== QUIZ.length) return false;
  if (!FICHES.every((f) => f.sources.length > 0 && f.sources.every((s) => sources.has(s)))) return false;
  if (!QUIZ.every((q) => fiches.has(q.fiche))) return false;
  // Toutes les sources servent, le quiz a des « vrai » et des « faux ».
  const citees = new Set(FICHES.flatMap((f) => f.sources));
  return SOURCES.every((s) => citees.has(s.id)) && QUIZ.some((q) => q.vrai) && QUIZ.some((q) => !q.vrai);
}
