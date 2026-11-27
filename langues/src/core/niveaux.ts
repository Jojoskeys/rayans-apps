// Difficulté qui s'adapte, règle « en escalier » (Levitt 1971) : 2 réussites de suite → plus dur,
// 1 échec → plus facile (même règle que Rayan's Mémoire). Un niveau par exercice et par langue.

export type ExoId = "cartes" | "ordre" | "dictee" | "tons" | "lettres";

export interface ExoInfo {
  id: ExoId;
  nom: string;
  icone: string;
  /** Ce que l'exercice entraîne, en une phrase honnête. */
  entraine: string;
  min: number;
  max: number;
  depart: number;
  /** Langues où l'exercice existe. */
  langues: ("zh" | "ar")[];
}

export const EXOS: ExoInfo[] = [
  { id: "cartes", nom: "Cartes mots", icone: "🃏", langues: ["zh", "ar"], min: 1, max: 6, depart: 1,
    entraine: "Retrouver le sens d'un mot (et le mot à partir du sens) : le rappel actif qui fixe le vocabulaire." },
  { id: "ordre", nom: "Phrase dans l'ordre", icone: "🧩", langues: ["zh", "ar"], min: 1, max: 6, depart: 1,
    entraine: "Remettre les mots d'une phrase dans l'ordre : produire la langue, pas seulement la reconnaître." },
  { id: "dictee", nom: "Dictée", icone: "✍️", langues: ["zh", "ar"], min: 1, max: 6, depart: 1,
    entraine: "Écouter puis écrire ce que tu entends : relier le son à l'écrit." },
  { id: "tons", nom: "Tons à l'oreille", icone: "🎵", langues: ["zh"], min: 1, max: 6, depart: 1,
    entraine: "Reconnaître les 4 tons du mandarin à l'oreille, avec plusieurs voix et syllabes." },
  { id: "lettres", nom: "Lettres arabes", icone: "🔤", langues: ["ar"], min: 1, max: 6, depart: 1,
    entraine: "Reconnaître les 28 lettres et leurs formes (début, milieu, fin de mot)." },
];

export const exoInfo = (id: ExoId): ExoInfo => EXOS.find((e) => e.id === id)!;

export interface Level {
  level: number;
  /** Réussites de suite au niveau actuel. */
  streak: number;
  best: number;
  maj: number;
}

export function startLevel(id: ExoId): Level {
  return { level: exoInfo(id).depart, streak: 0, best: 0, maj: 0 };
}

/** Applique le résultat d'une manche. */
export function nextLevel(id: ExoId, cur: Level, success: boolean, now: number): Level {
  const g = exoInfo(id);
  const best = success ? Math.max(cur.best, cur.level) : cur.best;
  if (!success) return { level: Math.max(g.min, cur.level - 1), streak: 0, best, maj: now };
  if (cur.streak + 1 >= 2) return { level: Math.min(g.max, cur.level + 1), streak: 0, best, maj: now };
  return { level: cur.level, streak: cur.streak + 1, best, maj: now };
}

/** Une manche est réussie à partir de 80 % de bonnes réponses. */
export const mancheReussie = (score: number, max: number): boolean => max > 0 && score / max >= 0.8;

// Ce que change chaque niveau.
export const paramsCartes = (n: number) => ({ choix: Math.min(6, n + 2), lectureCachee: n >= 4, sensVersMot: n >= 2 });
export const paramsOrdre = (n: number) => ({ maxMots: n + 2, lectureCachee: n >= 4, sansVoyelles: n >= 5 });
export const paramsDictee = (n: number) => ({
  /** Niveaux 1 à 3 : mots de 1, 2 puis 3 syllabes au plus ; 4 et plus : phrases courtes de (n − 1) mots au plus. */
  phrases: n >= 4,
  maxSyllabes: Math.min(3, n),
  maxMots: n - 1,
  vitesse: Math.round((0.7 + n * 0.05) * 100) / 100,
});
export const paramsTons = (n: number) => ({ choix: n <= 2 ? 2 : 4, vitesse: Math.round((0.75 + n * 0.05) * 100) / 100, plusieursVoix: n >= 3 });
export const paramsLettres = (n: number) => ({ choix: Math.min(6, n + 2), formes: n >= 3, proches: n >= 5 });
