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
  { id: "courses", name: "Courses", tagline: "Liste par rayon", icon: "✓", color: "#3BA776", files: ["courses"] },
  { id: "memo", name: "Mémo", tagline: "Idées et notes rapides", icon: "✎", color: "#C77DDB", files: ["memos"] },
  { id: "papiers", name: "Papiers", tagline: "Documents retrouvables", icon: "▤", color: "#7A8BA6", files: [] },
  { id: "recettes", name: "Recettes", tagline: "Plan du jour, courses", icon: "✿", color: "#F472B6", files: [] },
  { id: "favoris", name: "Favoris", tagline: "Vidéos à analyser", icon: "★", color: "#C95B7F", files: [] },
  { id: "bonnes-affaires", name: "Bonnes affaires", tagline: "Occasions sous leur prix", icon: "€", color: "#2E9E6A", files: [] },
];
