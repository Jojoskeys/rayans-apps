// Le petit bilan de la semaine : questionnaire écrit pour l'app (ce n'est pas un questionnaire clinique ni un outil médical).
// Refait chaque semaine, il sert seulement à comparer ton ressenti d'une semaine à l'autre.
import type { Bilan } from "./model.ts";

export interface Question {
  id: string;
  texte: string;
  options: string[];
  /** true : la dernière option est la plus reposante ; false : c'est la première. */
  versLeHaut: boolean;
}

const FREQ = ["Aucun", "1 ou 2", "3 ou 4", "5 ou plus"];
const SOUVENT = ["Presque jamais", "Parfois", "Souvent", "Presque toujours"];

export const QUESTIONS: Question[] = [
  { id: "endormissement", texte: "Ces 7 derniers jours, combien de soirs as-tu mis longtemps (plus d'une demi-heure environ) à t'endormir ?", options: FREQ, versLeHaut: false },
  { id: "rendormir", texte: "Combien de nuits t'es-tu réveillé sans arriver à te rendormir facilement ?", options: FREQ, versLeHaut: false },
  { id: "repose", texte: "Au lever, tu te sentais reposé…", options: SOUVENT, versLeHaut: true },
  { id: "somnolence", texte: "Dans la journée, as-tu lutté pour rester éveillé (en cours, en lisant, dans les transports) ?", options: SOUVENT, versLeHaut: false },
  { id: "horaires", texte: "Tes heures de lever étaient à peu près les mêmes d'un jour à l'autre (à une heure près)…", options: SOUVENT, versLeHaut: true },
  { id: "souci", texte: "As-tu pensé à ton sommeil avec inquiétude ?", options: SOUVENT, versLeHaut: false },
];

/** Valeur « repos » d'une réponse : 0 à 3, 3 = le plus reposant, quelle que soit la façon dont la question est posée. */
export function valeur(q: Question, choix: number): number {
  const c = Math.min(3, Math.max(0, choix));
  return q.versLeHaut ? c : 3 - c;
}

/** Ressenti global, de 0 à 18 : sert seulement à comparer deux semaines, pas à te noter. */
export const ressenti = (b: Bilan) => QUESTIONS.reduce((a, q, i) => a + valeur(q, b.reponses[i] ?? 0), 0);

/** Le dernier bilan date-t-il de 7 jours ou plus (ou n'y en a-t-il aucun) ? */
export function bilanAFaire(bilans: Bilan[], now: number): boolean {
  if (!bilans.length) return true;
  const dernier = Math.max(...bilans.map((b) => b.at));
  return now - dernier >= 6.5 * 86400_000;
}

/** Comparaison neutre de deux bilans, question par question. */
export function comparer(avant: Bilan, apres: Bilan): { question: string; sens: "mieux" | "pareil" | "moins" }[] {
  return QUESTIONS.map((q, i) => {
    const a = valeur(q, avant.reponses[i] ?? 0);
    const b = valeur(q, apres.reponses[i] ?? 0);
    return { question: q.id, sens: b > a ? "mieux" : b < a ? "moins" : "pareil" };
  });
}

export function phraseComparaison(avant: Bilan, apres: Bilan): string {
  const d = ressenti(apres) - ressenti(avant);
  if (d >= 2) return "Par rapport au bilan précédent, ton ressenti est plutôt meilleur.";
  if (d <= -2) return "Par rapport au bilan précédent, la semaine a été un peu plus difficile. Ça arrive : regarde ce qui a changé, sans t'en vouloir.";
  return "Par rapport au bilan précédent, ton ressenti est à peu près le même.";
}

/** Somnolence forte « souvent » ou « presque toujours » : on montre la fiche « Quand voir un médecin ». */
export function alerteSomnolence(b: Bilan): boolean {
  const i = QUESTIONS.findIndex((q) => q.id === "somnolence");
  return (b.reponses[i] ?? 0) >= 2;
}
