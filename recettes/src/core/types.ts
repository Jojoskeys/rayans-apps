// Types partagés par la logique, le processus principal et l'interface.

/** Une recette, venue de Rayan's Favoris (recettes.md ou une fiche) ou ajoutée à la main. */
export interface Recette {
  /** Identifiant de la vidéo (ex. « instagram-Abc123 »), ou « perso-<uuid> » pour une recette ajoutée à la main. */
  id: string;
  titre: string;
  portions?: string;
  ingredients: string[];
  etapes: string[];
  /** Lien de la vidéo d'origine. */
  lien?: string;
  /** Ce que montre la vidéo (champ resume de la fiche). */
  resume?: string;
  /** Remarques pour Rayan (champ pour_rayan de la fiche) : halal, sèche… */
  pourRayan?: string;
  /** Valeurs par portion, seulement si la fiche (ou Rayan) les donne : jamais devinées. */
  kcal?: number;
  proteines?: number;
  origine: "favoris" | "perso";
}

export const REPAS = ["petitDej", "dejeuner", "collation", "diner"] as const;
export type Repas = (typeof REPAS)[number];

/** Une case du plan : une recette, ou « libre » (id null). fixe = choisie par Rayan, gardée quand on régénère. */
export interface Case { id: string | null; fixe: boolean }
export type Jour = Record<Repas, Case>;

/** Plan de la semaine, du lundi (debut, AAAA-MM-JJ) au dimanche. */
export interface Plan { debut: string; jours: Jour[] }

/** Ce que Rayan ajoute ou coche : gardé dans le dossier de données de l'app, jamais dans le dépôt. */
export interface Donnees {
  version: 1;
  /** Identifiants des recettes mises en favori. */
  favoris: string[];
  /** Pour chaque recette, les dates (ms) où Rayan l'a faite. */
  faites: Record<string, number[]>;
  /** Recettes ajoutées à la main. */
  perso: Recette[];
  /** Recettes cochées pour la liste de courses. */
  panier: string[];
  /** Plan de repas de la semaine. */
  plan: Plan | null;
  /** Magasin choisi par Rayan pour un produit (clé de l'ingrédient → nom du magasin). */
  magasins: Record<string, string>;
}

export type Action =
  | { type: "plan"; plan: Plan }
  | { type: "casePlan"; jour: number; repas: Repas; id: string | null }
  | { type: "magasin"; cle: string; magasin: string | null }
  | { type: "favori"; id: string }
  | { type: "faite"; id: string; at: number }
  | { type: "annulerFaite"; id: string; at: number }
  | { type: "ajouterPerso"; recette: Recette }
  | { type: "supprimerPerso"; id: string }
  | { type: "panier"; id: string; dedans: boolean }
  | { type: "viderPanier" };

export interface Etiquettes {
  proteines: boolean;
  rapide: boolean;
  collation: boolean;
  repas: boolean;
}

export interface Remarques {
  halal: string[];
  seche: string[];
  /** Ingrédients qui ne sont souvent pas halal, à vérifier (lardons, gélatine, vin…). */
  aVerifier: string[];
}
