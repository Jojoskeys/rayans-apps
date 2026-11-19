// Petits outils sur le texte des annonces.

/** Minuscules, sans accents, espaces simples. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Vrai si le titre contient le mot ou l'expression, en mot entier. */
export function contientMot(titre: string, mot: string): boolean {
  const t = ` ${normaliser(titre)} `;
  const m = normaliser(mot);
  return m.length > 0 && t.includes(` ${m} `);
}

/** Vrai si le titre contient tous les mots de la recherche (dans n'importe quel ordre). */
export function correspond(titre: string, mots: string): boolean {
  return normaliser(mots)
    .split(" ")
    .filter(Boolean)
    .every((m) => contientMot(titre, m));
}

/**
 * Annonces qui faussent la comparaison : pièces détachées, objets en panne,
 * accessoires seuls, copies. On les écarte avant tout calcul.
 */
export const MOTS_EXCLUS = [
  "pour pieces",
  "pour piece",
  "hs",
  "en panne",
  "ne fonctionne pas",
  "ne s allume pas",
  "casse",
  "cassee",
  "ecran fissure",
  "boite vide",
  "boite seule",
  "carton seul",
  "coque",
  "housse",
  "etui",
  "pied seul",
  "telecommande seule",
  "cable seul",
  "chargeur seul",
  "replica",
  "replique",
  "copie",
  "contrefacon",
  "inspire",
  "style",
  "facon",
  "recherche",
  "echange",
];

export function estExclue(titre: string, exclusionsEnPlus: string[] = []): boolean {
  return [...MOTS_EXCLUS, ...exclusionsEnPlus].some((m) => contientMot(titre, m));
}

/** Lit un prix écrit à la française ou non : "1 299,90 €", "45.5", 12. */
export function lirePrix(valeur: unknown): number | null {
  if (typeof valeur === "number") return Number.isFinite(valeur) ? valeur : null;
  if (typeof valeur !== "string") return null;
  let s = valeur.replace(/[€\s  ]|eur/gi, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function mediane(valeurs: number[]): number {
  const v = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
