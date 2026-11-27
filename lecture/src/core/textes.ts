// Tous les textes, mis en forme à partir de l'écriture compacte (textes-1/2/3 et textes-tests).
import { TEXTES_1 } from "./textes-1.ts";
import { TEXTES_2 } from "./textes-2.ts";
import { TEXTES_3 } from "./textes-3.ts";
import { TEXTES_TESTS } from "./textes-tests.ts";
import type { Niveau, Texte, TexteBrut } from "./types.ts";

export type { Idee, Niveau, Partie, Question, Texte } from "./types.ts";

/** Nombre de mots d'un texte (un « mot » contient au moins une lettre ou un chiffre). */
export function compterMots(texte: string): number {
  return texte.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function construire(b: TexteBrut, test = false): Texte {
  const parties = b.parties.map(([titre, ...paragraphes]) => ({ titre, paragraphes }));
  return {
    id: b.id, titre: b.titre, niveau: b.niveau, theme: b.theme, sujet: b.sujet, curiosite: b.curiosite,
    parties,
    questions: b.questions.map(([q, choix, s, explication]) => ({ q, choix, sorte: s === "l" ? "litterale" : "inference", explication })),
    idees: b.idees.map(([texte, mots]) => ({ texte, mots: mots.split(/\s+/).filter(Boolean) })),
    ...(test ? { test: true } : {}),
    mots: compterMots(parties.flatMap((p) => p.paragraphes).join(" ")),
  };
}

/** Textes d'entraînement (séances et exercices). */
export const TEXTES: Texte[] = [...TEXTES_1, ...TEXTES_2, ...TEXTES_3].map((b) => construire(b));
/** Textes réservés aux tests de départ et de suivi, dans l'ordre où ils sont proposés. */
export const TESTS: Texte[] = TEXTES_TESTS.map((b) => construire(b, true));

export const texteParId = (id: string): Texte | undefined => TEXTES.find((t) => t.id === id) ?? TESTS.find((t) => t.id === id);

export const textesDuNiveau = (n: Niveau): Texte[] => TEXTES.filter((t) => t.niveau === n);

export const NOM_NIVEAU: Record<Niveau, string> = { 1: "facile", 2: "moyen", 3: "difficile" };
