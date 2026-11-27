// Petits outils sur l'échiquier : lecture de la partie « pièces » d'un FEN, noms des pièces en français,
// description d'une position en texte (« Blancs : Rg1, Df3 ; Noirs : Rg8, Tf8 »).

export type Couleur = "w" | "b";
export type TypePiece = "k" | "q" | "r" | "b" | "n" | "p";
export interface Piece { color: Couleur; type: TypePiece }
/** Cases occupées : "e4" → pièce. */
export type Placement = Record<string, Piece>;

export const COLONNES = "abcdefgh";
export const CASES: string[] = [];
for (let r = 8; r >= 1; r--) for (const c of COLONNES) CASES.push(`${c}${r}`);

/** Lettre française de la pièce (le pion n'a pas de lettre). */
export const LETTRE: Record<TypePiece, string> = { k: "R", q: "D", r: "T", b: "F", n: "C", p: "" };
export const NOM: Record<TypePiece, string> = { k: "roi", q: "dame", r: "tour", b: "fou", n: "cavalier", p: "pion" };
/** Valeur habituelle (le roi compte à part). */
export const VALEUR: Record<TypePiece, number> = { k: 100, q: 9, r: 5, b: 3, n: 3, p: 1 };
const ORDRE: TypePiece[] = ["k", "q", "r", "b", "n", "p"];

export function lirePlacement(fen: string): Placement {
  const out: Placement = {};
  const rangs = fen.split(" ")[0].split("/");
  rangs.forEach((rang, i) => {
    let col = 0;
    for (const ch of rang) {
      if (/\d/.test(ch)) { col += Number(ch); continue; }
      const type = ch.toLowerCase() as TypePiece;
      out[`${COLONNES[col]}${8 - i}`] = { color: ch === ch.toUpperCase() ? "w" : "b", type };
      col++;
    }
  });
  return out;
}

export function ecrirePlacement(p: Placement): string {
  const rangs: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let s = "";
    let vide = 0;
    for (const c of COLONNES) {
      const x = p[`${c}${r}`];
      if (!x) { vide++; continue; }
      if (vide) { s += vide; vide = 0; }
      s += x.color === "w" ? x.type.toUpperCase() : x.type;
    }
    if (vide) s += vide;
    rangs.push(s);
  }
  return rangs.join("/");
}

export const nbPieces = (fen: string): number => Object.keys(lirePlacement(fen)).length;

/** « Df3 », « pion e4 » ; avec `long`, « dame f3 ». */
export function nomPiece(p: Piece, sq: string, long = false): string {
  if (long) return `${NOM[p.type]} ${sq}`;
  return p.type === "p" ? `pion ${sq}` : `${LETTRE[p.type]}${sq}`;
}

/** Les pièces d'une couleur, rangées roi, dame, tours, fous, cavaliers, puis pions. */
export function piecesDe(p: Placement, color: Couleur): string[] {
  return Object.keys(p)
    .filter((sq) => p[sq].color === color)
    .sort((a, b) => ORDRE.indexOf(p[a].type) - ORDRE.indexOf(p[b].type) || a.localeCompare(b));
}

/** « Blancs : Rg1, Df3, Cc3, pions a2, b2 ; Noirs : Rg8, Fb7, Tf8 ». */
export function decrire(fen: string): { blancs: string; noirs: string } {
  const p = lirePlacement(fen);
  const ligne = (color: Couleur) => {
    const sqs = piecesDe(p, color);
    const figures = sqs.filter((s) => p[s].type !== "p").map((s) => nomPiece(p[s], s));
    const pions = sqs.filter((s) => p[s].type === "p");
    if (pions.length) figures.push(`${pions.length > 1 ? "pions" : "pion"} ${pions.join(", ")}`);
    return figures.join(", ");
  };
  return { blancs: ligne("w"), noirs: ligne("b") };
}

export const nomCouleur = (c: Couleur, pluriel = true) => (c === "w" ? (pluriel ? "Blancs" : "blanc") : (pluriel ? "Noirs" : "noir"));
export const autre = (c: Couleur): Couleur => (c === "w" ? "b" : "w");
