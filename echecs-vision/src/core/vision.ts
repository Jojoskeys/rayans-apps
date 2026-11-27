// « Vision sans échiquier » : une position donnée seulement en texte, et une question à résoudre de tête.
// Les positions sont tirées au hasard mais toujours légales (vérifiées par chess.js), sans échec au roi.
// Les bonnes réponses sont calculées par chess.js : « attaquer » une case = la contrôler, même pour une
// pièce clouée (comme aux échecs : un roi ne peut pas aller sur une case contrôlée par une pièce clouée).
import { Chess, type Square } from "chess.js";
import { autre, CASES, decrire, ecrirePlacement, lirePlacement, nomCouleur, nomPiece, piecesDe, type Couleur, type Placement, type TypePiece } from "./echiquier.ts";
import { pick, shuffle, type Rng } from "./rng.ts";

export type TypeQuestion = "case" | "attaquees" | "defenseurs";

export interface QuestionVision {
  type: TypeQuestion;
  fen: string;
  blancs: string;
  noirs: string;
  enonce: string;
  /** « case » : réponse oui/non. Sinon : cases des pièces à choisir parmi `options`. */
  oui?: boolean;
  options: { sq: string; nom: string }[];
  bonnes: string[];
  /** Explication montrée après la réponse. */
  explication: string;
}

/** Nombre de pièces (rois compris) et types de questions selon le niveau (1 à 10). */
export function paramsVision(niveau: number): { pieces: number; types: TypeQuestion[] } {
  const n = Math.min(10, Math.max(1, niveau));
  const types: TypeQuestion[] = n <= 2 ? ["case"] : n <= 4 ? ["case", "attaquees"] : ["case", "attaquees", "defenseurs"];
  return { pieces: Math.min(12, 3 + n), types };
}

const FIGURES: TypePiece[] = ["q", "r", "r", "b", "b", "n", "n", "p", "p", "p"];

/** Une position légale de `n` pièces (deux rois compris), trait aux Blancs, aucun roi en échec. */
export function positionAuHasard(rng: Rng, n: number): string {
  for (let essai = 0; essai < 500; essai++) {
    const p: Placement = {};
    const libres = shuffle(rng, CASES);
    const wk = libres.pop()!;
    p[wk] = { color: "w", type: "k" };
    const voisin = (a: string, b: string) => Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) <= 1 && Math.abs(+a[1] - +b[1]) <= 1;
    const bkIdx = libres.findIndex((s) => !voisin(s, wk));
    const bk = libres.splice(bkIdx, 1)[0];
    p[bk] = { color: "b", type: "k" };
    for (let i = 2; i < n; i++) {
      const type = pick(rng, FIGURES);
      const idx = libres.findIndex((s) => type !== "p" || (s[1] !== "1" && s[1] !== "8"));
      const sq = libres.splice(idx, 1)[0];
      p[sq] = { color: i % 2 ? "b" : "w", type };
    }
    const fen = `${ecrirePlacement(p)} w - - 0 1`;
    try {
      const c = new Chess(fen);
      if (c.inCheck() || c.isAttacked(bk as Square, "w")) continue;
      return fen;
    } catch { /* position refusée par chess.js : on recommence */ }
  }
  throw new Error("Impossible de tirer une position.");
}

const liste = (noms: string[]) => (noms.length ? noms.join(", ") : "aucune");

export function questionAuHasard(rng: Rng, niveau: number): QuestionVision {
  const { pieces, types } = paramsVision(niveau);
  for (;;) {
    const fen = positionAuHasard(rng, pieces);
    const q = construireQuestion(rng, fen, pick(rng, types));
    if (q) return q;
  }
}

/** Fabrique une question sur cette position (null si elle ne s'y prête pas). */
export function construireQuestion(rng: Rng, fen: string, type: TypeQuestion): QuestionVision | null {
  const c = new Chess(fen);
  const p = lirePlacement(fen);
  const { blancs, noirs } = decrire(fen);
  const base = { fen, blancs, noirs };
  const nomsDe = (sqs: string[]) => sqs.map((s) => nomPiece(p[s], s));
  const camp: Couleur = rng() < 0.5 ? "w" : "b";

  if (type === "case") {
    const vides = CASES.filter((s) => !p[s]);
    const oui = rng() < 0.5;
    const candidates = vides.filter((s) => c.isAttacked(s as Square, camp) === oui);
    if (!candidates.length) return null;
    const sq = pick(rng, candidates);
    const qui = c.attackers(sq as Square, camp);
    return {
      ...base, type, oui, options: [], bonnes: [],
      enonce: `La case ${sq} est-elle contrôlée par les ${nomCouleur(camp)} ?`,
      explication: oui ? `Oui : ${liste(nomsDe(qui))} ${qui.length > 1 ? "contrôlent" : "contrôle"} ${sq}.` : `Non : aucune pièce ${camp === "w" ? "blanche" : "noire"} ne contrôle ${sq}.`,
    };
  }

  if (type === "attaquees") {
    // Pièces du camp `camp` (sauf le roi, jamais en échec ici) attaquées par l'autre camp.
    const cibles = piecesDe(p, camp).filter((s) => p[s].type !== "k");
    if (cibles.length < 2) return null;
    const bonnes = cibles.filter((s) => c.isAttacked(s as Square, autre(camp)));
    const detail = bonnes.map((s) => `${nomPiece(p[s], s)} (par ${liste(nomsDe(c.attackers(s as Square, autre(camp))))})`);
    return {
      ...base, type, options: cibles.map((s) => ({ sq: s, nom: nomPiece(p[s], s) })), bonnes,
      enonce: `Quelles pièces ${camp === "w" ? "blanches" : "noires"} sont attaquées par les ${nomCouleur(autre(camp))} ? (Coche-les toutes, ou aucune.)`,
      explication: bonnes.length ? `Attaquées : ${detail.join(" ; ")}.` : "Aucune n'est attaquée.",
    };
  }

  // « defenseurs » : une pièce de `camp`, et les pièces de son camp qui la protègent.
  const cibles = piecesDe(p, camp).filter((s) => p[s].type !== "k");
  const autres = piecesDe(p, camp);
  if (!cibles.length || autres.length < 3) return null;
  const sq = pick(rng, cibles);
  const bonnes = c.attackers(sq as Square, camp);
  return {
    ...base, type, options: autres.filter((s) => s !== sq).map((s) => ({ sq: s, nom: nomPiece(p[s], s) })), bonnes,
    enonce: `Quelles pièces défendent ${nomPiece(p[sq], sq, true)} (${couleurAccordee(camp, p[sq].type)}) ? (Coche-les toutes, ou aucune.)`,
    explication: bonnes.length ? `Défendue par : ${liste(nomsDe(bonnes))}.` : "Personne ne la défend.",
  };
}

/** Corrige une réponse : oui/non pour « case », sinon l'ensemble des pièces cochées doit être exact. */
export function corriger(q: QuestionVision, reponse: boolean | string[]): boolean {
  if (q.type === "case") return reponse === q.oui;
  if (!Array.isArray(reponse)) return false;
  const a = [...new Set(reponse)].sort();
  const b = [...q.bonnes].sort();
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

const FEMININ: TypePiece[] = ["q", "r"];
function couleurAccordee(c: Couleur, t: TypePiece): string {
  const f = FEMININ.includes(t);
  return c === "w" ? (f ? "blanche" : "blanc") : (f ? "noire" : "noir");
}
