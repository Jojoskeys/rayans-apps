// Difficulté qui s'adapte, règle « en escalier » (Levitt 1971) : 2 réussites de suite → plus dur,
// 1 échec → plus facile. On se stabilise autour de 71 % de réussite : difficile sans décourager.

export type ExoId = "recherche" | "flanker" | "stroop" | "soutenue" | "changement";

export interface ExoInfo {
  id: ExoId;
  nom: string;
  icone: string;
  /** Ce que l'exercice entraîne, en une phrase. */
  entraine: string;
  /** Comment jouer, en une ou deux phrases. */
  regle: string;
  /** Ce qui change quand le niveau monte. */
  niveau: string;
  min: number;
  max: number;
  depart: number;
}

export const EXOS: ExoInfo[] = [
  {
    id: "recherche", nom: "Trouver la cible", icone: "🔎",
    entraine: "Chercher vite une chose précise au milieu d'autres (recherche visuelle).",
    regle: "Une grille de symboles s'affiche. Clique la cible montrée en haut, avant la fin du temps.",
    niveau: "Plus de symboles, qui ressemblent de plus en plus à la cible, et moins de temps.",
    min: 1, max: 12, depart: 2,
  },
  {
    id: "flanker", nom: "Flèche du milieu", icone: "↔",
    entraine: "Ignorer ce qui est juste à côté de ce que tu regardes (attention sélective).",
    regle: "Cinq flèches s'affichent. Indique la direction de celle du MILIEU, avec les boutons ou les flèches du clavier.",
    niveau: "Moins de temps pour répondre, plus de flèches trompeuses autour.",
    min: 1, max: 10, depart: 2,
  },
  {
    id: "stroop", nom: "Couleur du mot", icone: "🎨",
    entraine: "Bloquer un réflexe (lire le mot) pour faire ce qui est demandé (effet Stroop).",
    regle: "Un nom de couleur est écrit dans une autre couleur. Clique la couleur de l'ENCRE, pas le mot.",
    niveau: "Plus de pièges, moins de temps, puis les boutons changent de place.",
    min: 1, max: 10, depart: 2,
  },
  {
    id: "soutenue", nom: "Rester sur la tâche", icone: "🎯",
    entraine: "Garder son attention sur une tâche monotone sans « décrocher » (attention soutenue).",
    regle: "Des chiffres défilent. Appuie (Espace ou le bouton) pour TOUS les chiffres, sauf le 3. Ignore les notifications qui apparaissent.",
    niveau: "Les chiffres vont plus vite, la suite est plus longue, puis de fausses notifications viennent te tenter.",
    min: 1, max: 10, depart: 2,
  },
  {
    id: "changement", nom: "Coût du changement", icone: "🔀",
    entraine: "Passer d'une règle à l'autre, et voir combien de temps ça coûte (changement de tâche).",
    regle: "Un chiffre s'affiche avec une règle : « pair ou impair ? » ou « plus petit ou plus grand que 5 ? ». D'abord une règle à la fois, puis les deux mélangées.",
    niveau: "Moins de temps pour répondre, plus d'essais mélangés.",
    min: 1, max: 8, depart: 1,
  },
];

export const exoInfo = (id: ExoId): ExoInfo => EXOS.find((g) => g.id === id)!;
export const EXO_IDS: ExoId[] = EXOS.map((e) => e.id);
export const estExo = (x: string): x is ExoId => (EXO_IDS as string[]).includes(x);

export interface Level {
  level: number;
  /** Réussites de suite au niveau actuel. */
  streak: number;
  best: number;
  /** Dernière modification (ms), pour la fusion PC ↔ iPhone. */
  maj: number;
}

export function startLevel(id: ExoId): Level {
  return { level: exoInfo(id).depart, streak: 0, best: 0, maj: 0 };
}

/** Applique le résultat d'une manche : 2 réussites de suite → +1, 1 échec → −1, dans les bornes. */
export function nextLevel(id: ExoId, cur: Level, success: boolean, now: number): Level {
  const g = exoInfo(id);
  const best = success ? Math.max(cur.best, cur.level) : cur.best;
  if (!success) return { level: Math.max(g.min, cur.level - 1), streak: 0, best, maj: now };
  if (cur.streak + 1 >= 2) return { level: Math.min(g.max, cur.level + 1), streak: 0, best, maj: now };
  return { level: cur.level, streak: cur.streak + 1, best, maj: now };
}
