// Petit questionnaire sur la semaine, écrit pour l'app (ce n'est PAS un questionnaire clinique ni un outil
// médical). Chaque réponse va de 0 à 10. Il sert seulement à voir comment tes semaines évoluent.

export interface QuestionSemaine {
  id: string;
  texte: string;
  bas: string;
  haut: string;
  /** true : une valeur plus haute est plus agréable pour toi ; false : une valeur plus basse l'est. */
  hautMieux: boolean;
}

export const QUESTIONS: QuestionSemaine[] = [
  { id: "stress", texte: "Cette semaine, à quel point tu t'es senti stressé ou sous pression ?", bas: "pas du tout", haut: "énormément", hautMieux: false },
  { id: "sommeil", texte: "Comment tu as dormi cette semaine ?", bas: "très mal", haut: "très bien", hautMieux: true },
  { id: "calmer", texte: "Quand ça montait, à quel point tu arrivais à te calmer ?", bas: "pas du tout", haut: "très facilement", hautMieux: true },
  { id: "deborde", texte: "À quel point tu t'es senti débordé par tes émotions ?", bas: "jamais", haut: "très souvent", hautMieux: false },
  { id: "agreable", texte: "Combien de moments agréables tu as eus ?", bas: "aucun", haut: "beaucoup", hautMieux: true },
];

export const JOURS_ENTRE_TESTS = 7;

export interface Test {
  id: string;
  at: number;
  type: "depart" | "suivi";
  reponses: number[];
}

export const borne010 = (x: number) => Math.min(10, Math.max(0, Math.round(x)));

/** Le test de la semaine est-il à faire ? (aucun test, ou le dernier date d'au moins 7 jours) */
export function testAFaire(tests: Test[], now: number): boolean {
  if (tests.length === 0) return true;
  const dernier = Math.max(...tests.map((t) => t.at));
  return now - dernier >= JOURS_ENTRE_TESTS * 86400_000;
}

export type Sens = "mieux" | "moins" | "pareil";

/** Compare deux tests, question par question (écart d'au moins 1 point pour parler de changement). */
export function comparer(avant: Test, apres: Test): { question: QuestionSemaine; avant: number; apres: number; sens: Sens }[] {
  return QUESTIONS.map((q, i) => {
    const a = avant.reponses[i] ?? 5;
    const b = apres.reponses[i] ?? 5;
    const d = q.hautMieux ? b - a : a - b;
    return { question: q, avant: a, apres: b, sens: d >= 1 ? "mieux" : d <= -1 ? "moins" : "pareil" };
  });
}

export function phraseComparaison(c: { question: QuestionSemaine; avant: number; apres: number; sens: Sens }): string {
  const noms: Record<string, string> = { stress: "Stress ressenti", sommeil: "Sommeil", calmer: "Capacité à te calmer", deborde: "Débordé par tes émotions", agreable: "Moments agréables" };
  const n = noms[c.question.id] ?? c.question.id;
  if (c.sens === "pareil") return `${n} : à peu près pareil (${c.avant} → ${c.apres}).`;
  return `${n} : ${c.avant} → ${c.apres} (${c.sens === "mieux" ? "plutôt mieux pour toi" : "un peu moins bien"}).`;
}
