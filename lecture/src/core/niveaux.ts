// Difficulté qui s'adapte, règle « en escalier » : 2 réussites de suite → niveau de texte +1, 1 échec → −1.
// Pour la lecture chronométrée, une réussite demande de comprendre ET de garder son rythme habituel.
import type { Niveau } from "./types.ts";

export type ExoId = "lecture" | "plan" | "survol" | "notes";

export interface ExoInfo {
  id: ExoId;
  nom: string;
  icone: string;
  /** Ce que l'exercice entraîne, en une phrase. */
  entraine: string;
}

export const EXOS: ExoInfo[] = [
  { id: "lecture", nom: "Lecture chronométrée", icone: "⏱️", entraine: "Lire à ton rythme, puis répondre sans le texte : vitesse et compréhension mesurées ensemble." },
  { id: "plan", nom: "Repérer le plan", icone: "🧭", entraine: "Retrouver l'ordre des parties et rattacher des passages à leur partie." },
  { id: "survol", nom: "Survol en 60 s", icone: "🔭", entraine: "Saisir l'essentiel d'un texte avec les titres, l'introduction et la conclusion." },
  { id: "notes", nom: "Lire et prendre des notes", icone: "✍️", entraine: "Noter avec tes mots, puis répondre avec tes seules notes." },
];

export const exoInfo = (id: ExoId): ExoInfo => EXOS.find((e) => e.id === id)!;

export const NIVEAU_MIN: Niveau = 1;
export const NIVEAU_MAX: Niveau = 3;

export interface Level {
  level: Niveau;
  /** Réussites de suite au niveau actuel. */
  streak: number;
  best: Niveau;
  maj: number;
}

export const startLevel = (): Level => ({ level: 1, streak: 0, best: 1, maj: 0 });

export type Issue = "reussi" | "echec" | "neutre";

/** Applique le résultat d'un exercice. « neutre » (ni réussi ni raté) remet la série à zéro sans changer le niveau. */
export function nextLevel(cur: Level, issue: Issue, now: number): Level {
  if (issue === "echec") return { level: Math.max(NIVEAU_MIN, cur.level - 1) as Niveau, streak: 0, best: cur.best, maj: now };
  if (issue === "neutre") return { ...cur, streak: 0, maj: now };
  const best = Math.max(cur.best, cur.level) as Niveau;
  if (cur.streak + 1 >= 2) {
    const level = Math.min(NIVEAU_MAX, cur.level + 1) as Niveau;
    return { level, streak: 0, best: Math.max(best, level) as Niveau, maj: now };
  }
  return { level: cur.level, streak: cur.streak + 1, best, maj: now };
}

export function mediane(valeurs: number[]): number | null {
  if (!valeurs.length) return null;
  const v = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Lecture chronométrée : réussie si compréhension ≥ 80 % et vitesse ≥ ta médiane ; ratée si compréhension < 60 %.
 * Sans vitesse de référence (moins de 3 lectures), seule la compréhension compte.
 */
export function issueLecture(comprehension: number, mpm: number, mediane: number | null): Issue {
  if (comprehension < 0.6) return "echec";
  if (comprehension >= 0.8 && (mediane === null || mpm >= mediane)) return "reussi";
  return "neutre";
}

/** Plan, survol, notes : réussi à 80 % ou plus, raté sous 60 %. */
export function issueScore(part: number): Issue {
  return part < 0.6 ? "echec" : part >= 0.8 ? "reussi" : "neutre";
}
