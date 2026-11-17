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
];
