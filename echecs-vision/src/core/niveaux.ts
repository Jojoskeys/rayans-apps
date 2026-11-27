// Difficulté qui s'adapte, règle « en escalier » (Levitt 1971) : 2 réussites de suite → plus dur,
// 1 échec → plus facile. On se stabilise autour de 71 % de réussite : difficile sans décourager.
// N'importe rien : ce fichier est chargé par model.ts, lui-même lu par Rayan's Mobile.

export type ExoId = "memoire" | "vision" | "tactiques";

export interface ExoInfo {
  id: ExoId;
  nom: string;
  icone: string;
  entraine: string;
  regle: string;
  niveau: string;
  min: number;
  max: number;
  depart: number;
}

export const EXOS: ExoInfo[] = [
  {
    id: "memoire", nom: "Mémoire de position", icone: "🧠",
    entraine: "Retenir une position d'un coup d'œil, comme les joueurs forts (les « chunks »).",
    regle: "Une vraie position s'affiche quelques secondes, puis l'échiquier se vide : replace les pièces. Chaque pièce bien placée compte, chaque pièce mal placée retire un point.",
    niveau: "Plus de pièces, moins de temps pour regarder, puis les pions ne sont plus donnés.",
    min: 1, max: 10, depart: 1,
  },
  {
    id: "vision", nom: "Vision sans échiquier", icone: "👁",
    entraine: "Voir les pièces « dans sa tête » : qui attaque quoi, qui défend quoi, quelles cases sont tenues.",
    regle: "La position est donnée seulement en texte. Réponds de tête, sans échiquier.",
    niveau: "Plus de pièces, puis des questions plus riches (pièces attaquées, défenseurs).",
    min: 1, max: 10, depart: 1,
  },
  {
    id: "tactiques", nom: "Tactiques", icone: "⚔",
    entraine: "Reconnaître tout de suite les motifs simples : mat en 1, fourchette, clouage, pièce en prise, découverte.",
    regle: "Joue le bon coup sur l'échiquier. Les positions reviennent à intervalles croissants (révision espacée).",
    niveau: "Des positions plus chargées, jusqu'aux fins de parties célèbres.",
    min: 1, max: 6, depart: 1,
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

/** Niveau de tactique visé (1 à 3) pour un niveau d'exercice (1 à 6). */
export const niveauTactique = (level: number): 1 | 2 | 3 => Math.min(3, Math.max(1, Math.ceil(level / 2))) as 1 | 2 | 3;
