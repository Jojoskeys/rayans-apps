import type { Action, Donnees, Recette } from "../core/types.ts";

export interface Etat {
  /** Recettes de Rayan's Favoris (les recettes perso sont dans donnees.perso). */
  recettes: Recette[];
  donnees: Donnees;
  /** Dossier de Rayan's Favoris lu, et s'il existe. */
  dossier: string;
  trouve: boolean;
  illisibles: string[];
  version: string;
  warning: string | null;
}

export interface RecettesApi {
  getState(): Promise<Etat>;
  actualiser(): Promise<Etat>;
  dispatch(action: Action): Promise<Etat>;
  ouvrirLien(url: string): Promise<void>;
  ouvrirDossier(): Promise<void>;
  copier(texte: string): Promise<void>;
  /** Appelé quand le dossier de Rayan's Favoris a été relu (retour sur la fenêtre). */
  onChange(cb: () => void): () => void;
}

declare global {
  interface Window { recettes: RecettesApi }
}
