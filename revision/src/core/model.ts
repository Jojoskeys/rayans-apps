/**
 * Modèle de données de Rayan's Révision. Tout est stocké localement dans un seul fichier JSON
 * (voir src/storage.ts). Fonctions pures, sans accès au disque.
 */

export const DAY = 86_400_000;
export const MINUTE = 60_000;

/** Note donnée à une révision : 1 = À revoir, 2 = Difficile, 3 = Bien, 4 = Facile. */
export type Grade = 1 | 2 | 3 | 4;
export const GRADES: Grade[] = [1, 2, 3, 4];
export const GRADE_LABELS: Record<Grade, string> = { 1: "À revoir", 2: "Difficile", 3: "Bien", 4: "Facile" };

export type CardState = "new" | "learning" | "review" | "relearning";
export type CardKind = "basic" | "mcq" | "cloze";
export const KIND_LABELS: Record<CardKind, string> = {
  basic: "Question / réponse",
  mcq: "QCM",
  cloze: "Texte à trous",
};

/** « typed » : on tape la réponse et l'app corrige ; « flip » : on retourne la carte et on se note soi-même. */
export type AnswerMode = "typed" | "flip";

/** État de planification d'une carte (FSRS). */
export interface Sched {
  state: CardState;
  /** Horodatage (ms) à partir duquel la carte est à réviser. */
  due: number;
  /** Stabilité FSRS en jours : délai au bout duquel la probabilité de se souvenir tombe à 90 %. */
  stability: number;
  /** Difficulté FSRS, de 1 (facile) à 10 (difficile). */
  difficulty: number;
  /** Étape courante d'apprentissage ou de réapprentissage. */
  step: number;
  /** Dernier intervalle donné, en jours (0 pendant l'apprentissage). */
  interval: number;
  reps: number;
  lapses: number;
  lastReview: number | null;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  answerMode: AnswerMode;
  /** Nombre maximal de nouvelles cartes présentées chaque jour pour ce paquet. */
  newPerDay: number;
  created: number;
}

export interface Card {
  id: string;
  deckId: string;
  kind: CardKind;
  /** Question ; pour un texte à trous, le texte avec les trous notés {{réponse}} ou {{réponse::indice}}. */
  question: string;
  /** Réponse ; pour un QCM, le texte du bon choix ; vide pour un texte à trous. Variantes séparées par « | ». */
  answer: string;
  /** Choix d'un QCM (le bon choix compris). */
  choices: string[];
  explanation: string;
  created: number;
  updated: number;
  suspended: boolean;
  sched: Sched;
}

export interface ReviewLog {
  cardId: string;
  deckId: string;
  ts: number;
  grade: Grade;
  stateBefore: CardState;
  /** Jours écoulés depuis la révision précédente (0 pour une nouvelle carte). */
  elapsedDays: number;
  /** Intervalle obtenu, en jours (fractions de jour pendant l'apprentissage). */
  interval: number;
  durationMs: number;
}

export interface Settings {
  /** Probabilité de se souvenir visée au moment de la révision (FSRS). */
  retention: number;
  maxReviewsPerDay: number;
  /** Étapes d'apprentissage des nouvelles cartes, en minutes. */
  learningSteps: number[];
  /** Étapes de réapprentissage après un oubli, en minutes. */
  relearningSteps: number[];
  /** Intervalle maximal, en jours. */
  maxInterval: number;
  /** Heure (locale) à laquelle commence une nouvelle journée de révision. */
  dayStartHour: number;
}

export interface Db {
  format: "rayans-revision";
  version: 1;
  decks: Deck[];
  cards: Card[];
  reviews: ReviewLog[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  retention: 0.9,
  maxReviewsPerDay: 200,
  learningSteps: [1, 10],
  relearningSteps: [10],
  maxInterval: 36500,
  dayStartHour: 4,
};

export function emptyDb(): Db {
  return { format: "rayans-revision", version: 1, decks: [], cards: [], reviews: [], settings: { ...DEFAULT_SETTINGS } };
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function newSched(now: number): Sched {
  return { state: "new", due: now, stability: 0, difficulty: 0, step: 0, interval: 0, reps: 0, lapses: 0, lastReview: null };
}

export function makeDeck(name: string, now = Date.now(), extra: Partial<Deck> = {}): Deck {
  return { id: newId("d"), name: name.trim() || "Sans titre", description: "", answerMode: "flip", newPerDay: 20, created: now, ...extra };
}

export interface CardDraft {
  kind: CardKind;
  question: string;
  answer: string;
  choices?: string[];
  explanation?: string;
}

export function makeCard(deckId: string, draft: CardDraft, now = Date.now()): Card {
  const c = cleanDraft(draft);
  return {
    id: newId("c"), deckId, kind: c.kind, question: c.question, answer: c.answer, choices: c.choices,
    explanation: c.explanation, created: now, updated: now, suspended: false, sched: newSched(now),
  };
}

/** Normalise un brouillon de carte : espaces, QCM dont le bon choix figure parmi les choix, etc. */
export function cleanDraft(d: CardDraft): Required<CardDraft> {
  const question = (d.question ?? "").trim();
  let answer = (d.answer ?? "").trim();
  const explanation = (d.explanation ?? "").trim();
  let choices = (d.choices ?? []).map((s) => s.trim()).filter(Boolean);
  choices = choices.filter((s, i) => choices.indexOf(s) === i);
  if (d.kind === "mcq") {
    if (answer && !choices.includes(answer)) choices = [answer, ...choices];
  } else {
    choices = [];
  }
  if (d.kind === "cloze") answer = "";
  return { kind: d.kind, question, answer, choices, explanation };
}

/** Message d'erreur si le brouillon n'est pas une carte valide, sinon null. */
export function validateDraft(d: CardDraft, clozeGapCount: (text: string) => number): string | null {
  const c = cleanDraft(d);
  if (!c.question) return "La question est vide.";
  if (c.kind === "basic" && !c.answer) return "La réponse est vide.";
  if (c.kind === "mcq") {
    if (!c.answer) return "Indiquez le bon choix.";
    if (c.choices.length < 2) return "Un QCM a besoin d'au moins deux choix.";
  }
  if (c.kind === "cloze" && clozeGapCount(c.question) === 0) {
    return "Un texte à trous a besoin d'au moins un trou noté {{réponse}}.";
  }
  return null;
}
