// Les apps disponibles sur l'iPhone. `files` : fichiers synchronisés (nom de fichier dans le dépôt, sans .json).
export interface MobileApp {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  color: string;
  files: string[];
}

export const APPS: MobileApp[] = [
  { id: "aujourdhui", name: "Aujourd'hui", tagline: "Ma journée, cours, échéances", icon: "☀", color: "#E3A33B", files: ["routine", "fac", "objectifs", "bilan", "sport"] },
  { id: "revision", name: "Révision", tagline: "Cartes et fiches de cours", icon: "▣", color: "#5B8DEF", files: ["revision"] },
  { id: "hifz", name: "Hifz", tagline: "Mémorisation du Coran", icon: "☾", color: "#D9B25F", files: ["hifz"] },
  { id: "priere", name: "Prière", tagline: "Horaires du jour", icon: "◷", color: "#4FC08D", files: ["priere"] },
  { id: "chrono", name: "Chrono", tagline: "Pomodoro et temps passé", icon: "◔", color: "#E8594F", files: ["chrono"] },
  { id: "ouvertures", name: "Ouvertures", tagline: "Positions d'échecs à rejouer", icon: "♞", color: "#9B7BEA", files: ["ouvertures", "ouvertures-donnees"] },
  { id: "telecommande", name: "Télécommande", tagline: "Piloter le PC, fichiers", icon: "⌘", color: "#3D8BFD", files: [] },
  { id: "studio", name: "Studio", tagline: "Vidéos à valider", icon: "▶", color: "#D9534F", files: [] },
  { id: "demain", name: "Demain", tagline: "Heure de réveil, Fajr", icon: "☼", color: "#F08A4B", files: [] },
  { id: "actu", name: "Ton monde", tagline: "L'actu du monde ce matin", icon: "◍", color: "#4A9FD8", files: ["actu"] },
  { id: "arene", name: "Arène", tagline: "Bourse en argent fictif", icon: "◈", color: "#E3A33B", files: [] },
  { id: "courses", name: "Courses", tagline: "Liste par rayon", icon: "✓", color: "#3BA776", files: ["courses"] },
  { id: "memoire", name: "Mémoire", tagline: "Palais, jeux, séance du jour", icon: "🏛", color: "#8B7CF6", files: ["memoire"] },
  { id: "sommeil", name: "Sommeil", tagline: "Coucher selon Fajr, journal", icon: "☾", color: "#7C8CF8", files: ["sommeil", "priere"] },
  { id: "focus", name: "Focus", tagline: "Attention, travail profond", icon: "◎", color: "#3FB7D9", files: ["focus"] },
  { id: "calcul", name: "Calcul mental", tagline: "Astuces, entraînement, défis", icon: "∑", color: "#F2994A", files: ["calcul"] },
  { id: "calme", name: "Calme", tagline: "Respirer, souffler, nommer", icon: "≈", color: "#5FB3A8", files: ["calme"] },
  { id: "langues", name: "Langues", tagline: "Chinois et arabe, 10 min par jour", icon: "文", color: "#E0665A", files: ["langues"] },
  { id: "lecture", name: "Lecture", tagline: "Lire mieux, comprendre autant", icon: "❡", color: "#3FBF9F", files: ["lecture"] },
  { id: "culture", name: "Culture", tagline: "Quiz du jour, culture et actu", icon: "✦", color: "#C9A227", files: ["culture"] },
  { id: "echecs-vision", name: "Échecs Vision", tagline: "Voir l'échiquier de tête", icon: "♞", color: "#8E7CC3", files: ["echecs-vision"] },
  { id: "memo", name: "Mémo", tagline: "Idées et notes rapides", icon: "✎", color: "#C77DDB", files: ["memos"] },
  { id: "papiers", name: "Papiers", tagline: "Documents retrouvables", icon: "▤", color: "#7A8BA6", files: [] },
  { id: "recettes", name: "Recettes", tagline: "Plan du jour, courses", icon: "✿", color: "#F472B6", files: [] },
  { id: "favoris", name: "Favoris", tagline: "Vidéos à analyser", icon: "★", color: "#C95B7F", files: [] },
  { id: "bonnes-affaires", name: "Bonnes affaires", tagline: "Occasions sous leur prix", icon: "€", color: "#2E9E6A", files: [] },
  { id: "montre", name: "Montre", tagline: "Eau, séances, humeur, pas", icon: "⌚", color: "#26A69A", files: [] },
];
