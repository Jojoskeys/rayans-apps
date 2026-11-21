// Défis chronométrés (facultatifs) et tests de départ / de suivi (20 calculs à difficulté fixe).
import { genererQuestion } from "./generateur.ts";
import type { Db, Resultat } from "./model.ts";
import type { Question, TypeId } from "./question.ts";
import { makeRng, pick, shuffle, type Rng } from "./rng.ts";

export type DefiId = "60s" | "2min" | "20q";

export interface DefiInfo {
  id: DefiId;
  nom: string;
  icone: string;
  regle: string;
  /** Durée (s) pour les défis au temps, ou nombre de questions pour « 20 questions ». */
  secondes?: number;
  questions?: number;
  /** Le score : plus grand = mieux (bonnes réponses), ou plus petit = mieux (secondes). */
  sens: "plus" | "moins";
  unite: string;
}

export const DEFIS: DefiInfo[] = [
  { id: "60s", nom: "60 secondes", icone: "⏱", regle: "Le plus de bonnes réponses en 60 secondes.", secondes: 60, sens: "plus", unite: "bonnes réponses" },
  { id: "2min", nom: "2 minutes", icone: "⏲", regle: "Le plus de bonnes réponses en 2 minutes.", secondes: 120, sens: "plus", unite: "bonnes réponses" },
  { id: "20q", nom: "20 questions", icone: "🏁", regle: "20 calculs le plus vite possible ; chaque erreur ajoute 5 secondes.", questions: 20, sens: "moins", unite: "secondes" },
];

export const defiInfo = (id: DefiId): DefiInfo => DEFIS.find((d) => d.id === id)!;
export const PENALITE_S = 5;

/** Les défis gardent une difficulté fixe (pour comparer les scores d'une fois sur l'autre). */
const PALIER_DEFI: { type: TypeId; niveau: number }[] = [
  { type: "addition", niveau: 3 },
  { type: "soustraction", niveau: 3 },
  { type: "tables", niveau: 2 },
  { type: "mult1", niveau: 2 },
  { type: "pourcentages", niveau: 2 },
];

export function questionDefi(rng: Rng, precedente?: Question): Question {
  const choix = PALIER_DEFI.filter((p) => p.type !== precedente?.type);
  const p = pick(rng, choix);
  return genererQuestion(p.type, p.niveau, rng);
}

/** Le score d'un défi terminé. */
export function scoreDefi(id: DefiId, bonnes: number, total: number, dureeMs: number): number {
  if (id === "20q") return Math.round(dureeMs / 1000) + (total - bonnes) * PENALITE_S;
  return bonnes;
}

export function meilleurScore(db: Db, id: DefiId): number | null {
  const s = db.resultats.filter((r) => r.sorte === "defi" && r.ref === id && typeof r.score === "number").map((r) => r.score!);
  if (!s.length) return null;
  return defiInfo(id).sens === "plus" ? Math.max(...s) : Math.min(...s);
}

// ----- Tests -------------------------------------------------------------------------------------------------
/** 5 types × 4 niveaux = 20 calculs, toujours la même difficulté. */
export const STRUCTURE_TEST: { type: TypeId; niveau: number }[] = (["addition", "soustraction", "tables", "mult1", "pourcentages"] as TypeId[]).flatMap((type) =>
  [1, 2, 3, 4].map((niveau) => ({ type, niveau })),
);

/**
 * Les 20 calculs du test n° `numero` (0 = test de départ, 1, 2… = suivis). Même structure et même difficulté
 * à chaque fois ; les nombres changent d'un test à l'autre mais sont fixés par la graine (reproductibles).
 */
export function questionsTest(numero: number): Question[] {
  const rng = makeRng(7000 + numero);
  return shuffle(rng, STRUCTURE_TEST.map((s) => genererQuestion(s.type, s.niveau, rng)));
}

export function testsFaits(db: Db): Resultat[] {
  return db.resultats.filter((r) => r.sorte === "test").sort((a, b) => a.at - b.at);
}

/** Le test à proposer : départ s'il n'y en a pas, suivi si le dernier date d'au moins 7 jours, sinon rien. */
export function testPropose(db: Db, now: number): { numero: number; nom: string } | null {
  const t = testsFaits(db);
  if (!t.length) return { numero: 0, nom: "Test de départ" };
  if (now - t[t.length - 1].at >= 7 * 86400_000 - 3600_000) return { numero: t.length, nom: `Test de suivi n° ${t.length}` };
  return null;
}

export const nomTest = (numero: number): string => (numero === 0 ? "Test de départ" : `Test de suivi n° ${numero}`);
