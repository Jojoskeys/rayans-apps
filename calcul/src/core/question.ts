// Une question de calcul et les petites fonctions partagées (écriture des nombres, décompositions).

/** Les familles d'opérations de l'entraînement adaptatif (chacune a son propre niveau). */
export type TypeId = "addition" | "soustraction" | "tables" | "mult1" | "mult2" | "pourcentages" | "astuces";

export type AstuceId =
  | "x11"
  | "carre5"
  | "x9"
  | "x5"
  | "complements"
  | "decomposition"
  | "pourcent"
  | "arrondir"
  | "proche100"
  | "div5";

export type Op = "+" | "−" | "×" | "÷" | "%";

export interface Question {
  /** Ce qui est affiché (« 47 × 6 »). */
  texte: string;
  reponse: number;
  /** La décomposition montrée après une erreur (et dans les astuces). */
  etapes: string[];
  type: TypeId;
  niveau: number;
  /** Les deux nombres et l'opération, pour l'estimation. */
  a: number;
  b: number;
  op: Op;
  astuce?: AstuceId;
  /** Question revenue de la liste « à revoir » (révision espacée). */
  revision?: boolean;
}

/** Écrit un nombre à la française : espace insécable par groupe de 3 chiffres à partir de 10 000. */
export function fmt(n: number): string {
  const neg = n < 0;
  const s = String(Math.abs(n));
  const g = Math.abs(n) >= 10000 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : s;
  return neg ? `−${g}` : g;
}

/** Les morceaux d'un nombre selon les positions (347 → 300, 40, 7), sans les zéros. */
export function morceaux(n: number): number[] {
  const out: number[] = [];
  const s = String(Math.abs(n));
  for (let i = 0; i < s.length; i++) {
    const v = Number(s[i]) * 10 ** (s.length - 1 - i);
    if (v) out.push(v);
  }
  return out.length ? out : [0];
}

/** La clé d'un calcul (pour la liste « à revoir ») : son texte, sans espaces. */
export const cleDe = (q: Pick<Question, "texte">): string => q.texte.replace(/\s/g, "");

export function question(type: TypeId, niveau: number, a: number, b: number, op: Op, texte: string, reponse: number, etapes: string[], astuce?: AstuceId): Question {
  return { texte, reponse, etapes, type, niveau, a, b, op, ...(astuce ? { astuce } : {}) };
}

/** Lit une saisie (chiffres seulement, espaces ignorés). null si vide ou illisible. */
export function lireSaisie(s: string): number | null {
  const t = s.replace(/[\s ]/g, "").replace("−", "-").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
