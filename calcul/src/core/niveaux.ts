// Difficulté qui s'adapte, règle « en escalier » (Levitt 1971) : 2 réussites de suite → plus dur,
// 1 échec → plus facile. On se stabilise autour de 70 % de réussite : difficile mais réussissable.
import type { TypeId } from "./question.ts";

export interface TypeInfo {
  id: TypeId;
  nom: string;
  icone: string;
  /** Ce que contient chaque niveau, du plus facile au plus dur. */
  paliers: string[];
  min: number;
  max: number;
  depart: number;
}

export const TYPES: TypeInfo[] = [
  { id: "addition", nom: "Additions", icone: "+", min: 1, max: 5, depart: 1,
    paliers: ["1 chiffre + 1 chiffre", "2 chiffres + 1 chiffre", "2 chiffres + 2 chiffres", "3 chiffres + 2 chiffres", "3 chiffres + 3 chiffres"] },
  { id: "soustraction", nom: "Soustractions", icone: "−", min: 1, max: 5, depart: 1,
    paliers: ["passer par 10 (15 − 7)", "2 chiffres − 1 chiffre", "2 chiffres − 2 chiffres", "3 chiffres − 2 chiffres", "3 chiffres − 3 chiffres"] },
  { id: "tables", nom: "Tables", icone: "✕", min: 1, max: 4, depart: 1,
    paliers: ["tables de 2, 3, 4, 5 et 10", "tables de 2 à 9", "les plus dures (6 à 9)", "divisions des tables"] },
  { id: "mult1", nom: "× 1 chiffre", icone: "×", min: 1, max: 4, depart: 1,
    paliers: ["2 chiffres × 2 à 5", "2 chiffres × 2 à 9", "3 chiffres (jusqu'à 499) × 1 chiffre", "3 chiffres × 1 chiffre"] },
  { id: "mult2", nom: "× 2 chiffres", icone: "⊗", min: 1, max: 4, depart: 1,
    paliers: ["2 chiffres × 11 à 19", "jusqu'à 39 × 39", "jusqu'à 99 × 59", "2 chiffres × 2 chiffres"] },
  { id: "pourcentages", nom: "Pourcentages", icone: "%", min: 1, max: 5, depart: 1,
    paliers: ["10 % et 50 %", "25 %, 20 % et 5 %", "15 %, 30 % et 75 %", "x % de y = y % de x", "pourcentages en 5 (35 %, 45 %…)"] },
  { id: "astuces", nom: "Astuces apprises", icone: "💡", min: 1, max: 3, depart: 1,
    paliers: ["exemples simples", "exemples moyens", "exemples difficiles"] },
];

export const typeInfo = (id: TypeId): TypeInfo => TYPES.find((t) => t.id === id)!;

export interface Level {
  niveau: number;
  /** Réussites de suite au niveau actuel. */
  suite: number;
  /** Plus haut niveau réussi. */
  record: number;
  /** Dernière modification (ms), pour la fusion PC ↔ iPhone. */
  maj: number;
}

export function startLevel(id: TypeId): Level {
  return { niveau: typeInfo(id).depart, suite: 0, record: 0, maj: 0 };
}

/** Applique une réponse : 2 réussites de suite → +1, 1 échec → −1, dans les bornes. */
export function nextLevel(id: TypeId, cur: Level, juste: boolean, now: number): Level {
  const t = typeInfo(id);
  const record = juste ? Math.max(cur.record, cur.niveau) : cur.record;
  if (!juste) return { niveau: Math.max(t.min, cur.niveau - 1), suite: 0, record, maj: now };
  if (cur.suite + 1 >= 2) return { niveau: Math.min(t.max, cur.niveau + 1), suite: 0, record, maj: now };
  return { niveau: cur.niveau, suite: cur.suite + 1, record, maj: now };
}
