// « Nommer et réévaluer » : la roue des mots, les questions pour regarder une pensée autrement, et le seuil
// au-delà duquel on affiche calmement la page « Si ça ne va vraiment pas ».

export interface Famille {
  id: string;
  nom: string;
  icone: string;
  nuances: string[];
}

export const FAMILLES: Famille[] = [
  { id: "colere", nom: "Colère", icone: "🔥", nuances: ["agacement", "irritation", "énervement", "rage", "rancune"] },
  { id: "peur", nom: "Peur", icone: "😨", nuances: ["appréhension", "frayeur", "panique", "insécurité"] },
  { id: "inquietude", nom: "Inquiétude", icone: "🌀", nuances: ["nervosité", "stress", "doute", "tension", "préoccupation"] },
  { id: "tristesse", nom: "Tristesse", icone: "🌧", nuances: ["déception", "chagrin", "découragement", "solitude", "nostalgie"] },
  { id: "honte", nom: "Honte", icone: "🙈", nuances: ["gêne", "culpabilité", "humiliation", "embarras"] },
  { id: "frustration", nom: "Frustration", icone: "😤", nuances: ["impatience", "blocage", "sentiment d'injustice", "contrariété"] },
  { id: "fatigue", nom: "Fatigue", icone: "🪫", nuances: ["épuisement", "lassitude", "vide", "lourdeur"] },
  { id: "jalousie", nom: "Jalousie", icone: "🍋", nuances: ["envie", "comparaison", "possessivité"] },
  { id: "ennui", nom: "Ennui", icone: "😶", nuances: ["désintérêt", "flottement", "agitation"] },
  { id: "joie", nom: "Joie", icone: "☀", nuances: ["soulagement", "fierté", "enthousiasme", "reconnaissance", "sérénité"] },
];

export const famille = (id: string): Famille | undefined => FAMILLES.find((f) => f.id === id);

/** Les questions pour regarder la pensée automatique sous un autre angle (restructuration simple). */
export interface QuestionReeval { id: CleReeval; question: string; aide: string }
export type CleReeval = "pour" | "contre" | "ami" | "unAn" | "controle";

export const QUESTIONS_REEVAL: QuestionReeval[] = [
  { id: "pour", question: "Quelles preuves vont dans le sens de cette pensée ?", aide: "Des faits, pas des impressions." },
  { id: "contre", question: "Quelles preuves vont contre ?", aide: "Une fois où ça s'est passé autrement, un détail que tu oublies." },
  { id: "ami", question: "Que dirais-tu à un ami qui pense ça ?", aide: "Souvent, on est plus juste avec les autres qu'avec soi." },
  { id: "unAn", question: "Est-ce que ce sera important dans un an ?", aide: "Si oui, c'est normal que ça pèse ; si non, ça aide à relativiser." },
  { id: "controle", question: "Qu'est-ce que je contrôle, là, tout de suite ?", aide: "Une petite action possible, même minuscule." },
];

export const INTENSITE_ALERTE = 9;

/** Faut-il afficher calmement la page d'aide ? (intensité très forte ou idées noires cochées) */
export const besoinAide = (intensite: number, ideesNoires: boolean): boolean => ideesNoires || intensite >= INTENSITE_ALERTE;

/** Une petite phrase sur l'écart d'intensité avant / après, sans jugement. */
export function phraseEcart(avant: number, apres: number): string {
  const d = avant - apres;
  if (d >= 2) return `L'intensité est passée de ${avant} à ${apres}. Prendre le temps de mettre des mots a aidé cette fois.`;
  if (d === 1) return `De ${avant} à ${apres} : un petit pas, c'est déjà ça.`;
  if (d === 0) return `L'intensité reste à ${apres}. Ce n'est pas un échec : certaines émotions ont besoin de temps, ou d'en parler à quelqu'un.`;
  return `L'intensité est montée (${avant} → ${apres}). Ça arrive quand on regarde une situation en face. Une respiration lente peut aider maintenant.`;
}
