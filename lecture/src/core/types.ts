// Forme des textes de l'app. Les textes sont écrits pour l'app (aucun n'est copié d'une œuvre).

export type Niveau = 1 | 2 | 3;

/** Question à choix : la bonne réponse est toujours écrite en premier (`choix[0]`), l'affichage mélange. */
export interface Question {
  q: string;
  choix: string[];
  /** « litterale » : la réponse est écrite dans le texte ; « inference » : il faut la déduire. */
  sorte: "litterale" | "inference";
  explication: string;
}

export interface Partie { titre: string; paragraphes: string[] }

/** Idée clé pour corriger un résumé ; `mots` : débuts de mots (sans accents) qui la repèrent. */
export interface Idee { texte: string; mots: string[] }

export interface Texte {
  id: string;
  titre: string;
  niveau: Niveau;
  theme: string;
  /** Le sujet en une phrase (sert au survol). */
  sujet: string;
  /** Question à garder en tête avant de lire. */
  curiosite: string;
  parties: Partie[];
  questions: Question[];
  idees: Idee[];
  /** Texte réservé aux tests (départ et suivi hebdomadaire). */
  test?: boolean;
  /** Nombre de mots (calculé). */
  mots: number;
}

/** Forme compacte utilisée pour écrire les textes. */
export interface TexteBrut {
  id: string;
  titre: string;
  niveau: Niveau;
  theme: string;
  sujet: string;
  curiosite: string;
  /** [titre de la partie, paragraphe, paragraphe…] */
  parties: string[][];
  /** [question, [bonne réponse, autre, autre, autre], "l" (littérale) ou "i" (inférence), explication] */
  questions: [string, string[], "l" | "i", string][];
  /** [idée, "debuts de mots sans accents"] */
  idees: [string, string][];
}
