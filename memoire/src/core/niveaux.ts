// Difficulté qui s'adapte, règle « en escalier » (Levitt 1971) : 2 réussites de suite → plus dur,
// 1 échec → plus facile. Le joueur se stabilise autour de 71 % de réussite : difficile sans décourager.

export type GameId =
  | "chiffres"
  | "chiffres-envers"
  | "corsi"
  | "nback"
  | "simon"
  | "paires"
  | "mots"
  | "visages"
  | "kim"
  | "nombres";

export interface GameInfo {
  id: GameId;
  nom: string;
  icone: string;
  /** Ce que le jeu entraîne, en une phrase. */
  entraine: string;
  /** Comment jouer, en une ou deux phrases. */
  regle: string;
  /** Le niveau : ce qu'il compte (« chiffres », « paires »…). */
  unite: string;
  min: number;
  max: number;
  depart: number;
  pas: number;
  /** Repère adulte moyen sans technique (ordre de grandeur), si la recherche en donne un. */
  repere?: string;
  famille: "travail" | "long-terme";
}

export const GAMES: GameInfo[] = [
  {
    id: "chiffres", nom: "Suite de chiffres", icone: "🔢", famille: "travail",
    entraine: "Garder des chiffres en tête quelques secondes (mémoire de travail, boucle des sons).",
    regle: "Les chiffres apparaissent un par un. Retape-les dans l'ordre.",
    unite: "chiffres", min: 3, max: 20, depart: 5, pas: 1, repere: "6 à 7 chiffres pour un adulte",
  },
  {
    id: "chiffres-envers", nom: "Chiffres à l'envers", icone: "🔁", famille: "travail",
    entraine: "Garder et manipuler en même temps (le « chef d'orchestre » de la mémoire de travail).",
    regle: "Les chiffres apparaissent un par un. Retape-les en partant du dernier.",
    unite: "chiffres", min: 2, max: 14, depart: 3, pas: 1, repere: "4 à 5 chiffres pour un adulte",
  },
  {
    id: "corsi", nom: "Cases lumineuses", icone: "🟦", famille: "travail",
    entraine: "Mémoire des positions et des trajets (blocs de Corsi).",
    regle: "Des cases s'allument l'une après l'autre. Clique-les dans le même ordre.",
    unite: "cases", min: 2, max: 14, depart: 4, pas: 1, repere: "5 à 6 cases pour un adulte",
  },
  {
    id: "nback", nom: "N-back", icone: "⏮", famille: "travail",
    entraine: "Mettre à jour sa mémoire en continu.",
    regle: "Des lettres défilent. Appuie sur « Pareil » (ou Espace) quand la lettre est la même que celle d'il y a N lettres.",
    unite: "en arrière (N)", min: 1, max: 7, depart: 2, pas: 1, repere: "2-back au départ, 3 à 4 après entraînement",
  },
  {
    id: "simon", nom: "Séquence de couleurs", icone: "🎵", famille: "travail",
    entraine: "Retenir une séquence qui s'allonge, en images et en sons.",
    regle: "Regarde et écoute la séquence, puis rejoue-la.",
    unite: "couleurs", min: 2, max: 25, depart: 4, pas: 1, repere: "6 à 8 couleurs",
  },
  {
    id: "paires", nom: "Paires", icone: "🃏", famille: "travail",
    entraine: "Mémoire des emplacements.",
    regle: "Retourne deux cartes à la fois et retrouve toutes les paires en le moins de coups possible.",
    unite: "paires", min: 3, max: 18, depart: 4, pas: 1,
  },
  {
    id: "kim", nom: "Objet disparu", icone: "🔍", famille: "travail",
    entraine: "Attention et mémoire visuelle (jeu de Kim).",
    regle: "Observe les objets. Quand ils reviennent, l'un d'eux a disparu : lequel ?",
    unite: "objets", min: 4, max: 24, depart: 6, pas: 1,
  },
  {
    id: "mots", nom: "Liste de mots", icone: "📝", famille: "long-terme",
    entraine: "Retenir une liste, avec ou sans palais de mémoire.",
    regle: "Lis la liste, puis retape tous les mots dont tu te souviens (dans n'importe quel ordre).",
    unite: "mots", min: 5, max: 50, depart: 8, pas: 1, repere: "environ 7 sur 15 sans technique, 12 à 15 avec un palais",
  },
  {
    id: "visages", nom: "Noms et visages", icone: "🙂", famille: "long-terme",
    entraine: "Associer un prénom à un visage.",
    regle: "Retiens le prénom de chaque personne, puis retrouve-les quand les visages reviennent mélangés.",
    unite: "visages", min: 2, max: 16, depart: 3, pas: 1,
  },
  {
    id: "nombres", nom: "Grand nombre", icone: "💯", famille: "long-terme",
    entraine: "Retenir un long nombre par blocs de 2 chiffres (regroupement et système Major).",
    regle: "Le nombre est affiché par blocs de 2. Transforme chaque bloc en image, puis retape le nombre entier.",
    unite: "chiffres", min: 4, max: 80, depart: 6, pas: 2, repere: "un débutant avec le Major vise 20 à 40 chiffres en quelques semaines",
  },
];

export const gameInfo = (id: GameId): GameInfo => GAMES.find((g) => g.id === id)!;

export interface Level {
  level: number;
  /** Réussites de suite au niveau actuel. */
  streak: number;
  best: number;
  updatedAt: number;
}

export function startLevel(id: GameId): Level {
  const g = gameInfo(id);
  return { level: g.depart, streak: 0, best: 0, updatedAt: 0 };
}

/** Applique le résultat d'une manche. */
export function nextLevel(id: GameId, cur: Level, success: boolean, now: number): Level {
  const g = gameInfo(id);
  const best = success ? Math.max(cur.best, cur.level) : cur.best;
  if (!success) return { level: Math.max(g.min, cur.level - g.pas), streak: 0, best, updatedAt: now };
  if (cur.streak + 1 >= 2) return { level: Math.min(g.max, cur.level + g.pas), streak: 0, best, updatedAt: now };
  return { level: cur.level, streak: cur.streak + 1, best, updatedAt: now };
}
