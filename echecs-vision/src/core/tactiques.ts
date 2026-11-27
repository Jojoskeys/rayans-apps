// Banque de tactiques simples. Chaque position est vérifiée par chess.js dans les tests : position légale,
// solutions légales, et le thème est bien là (mat → le coup fait mat ; fourchette → la pièce jouée attaque
// deux cibles sans pouvoir être prise ; clouage → la pièce visée ne peut plus bouger ; pièce en prise → la
// pièce prise n'est pas défendue ; découverte → échec à la découverte et une pièce attaquée).
import { Chess } from "chess.js";

export type Theme = "mat1" | "fourchette" | "clouage" | "prise" | "decouverte";

export const THEMES: Record<Theme, { nom: string; consigne: string; idee: string }> = {
  mat1: { nom: "Mat en 1", consigne: "Trouve le coup qui fait mat.", idee: "Regarde d'abord les échecs : chaque échec, puis chaque case de fuite du roi." },
  fourchette: { nom: "Fourchette", consigne: "Une pièce peut attaquer deux cibles à la fois. Trouve le coup.", idee: "Cherche une case d'où une seule pièce touche deux pièces adverses (le roi compte)." },
  clouage: { nom: "Clouage", consigne: "Immobilise une pièce adverse devant son roi.", idee: "Une pièce sur la même ligne que le roi adverse ne peut plus bouger si tu te places derrière elle." },
  prise: { nom: "Pièce en prise", consigne: "Une pièce adverse n'est pas défendue. Prends-la.", idee: "Avant chaque coup : quelles pièces adverses ne sont protégées par rien ?" },
  decouverte: { nom: "Attaque à la découverte", consigne: "Déplace une pièce pour démasquer une attaque, et attaque autre chose en même temps.", idee: "Une pièce qui bouge peut libérer la ligne d'une tour, d'un fou ou de la dame derrière elle." },
};

export interface Tactique {
  id: string;
  theme: Theme;
  /** 1 (très simple) à 3 (position de vraie partie). */
  niveau: 1 | 2 | 3;
  fen: string;
  /** Coups acceptés (notation anglaise de chess.js, sans + ni #). Pour un mat en 1, tout coup qui fait mat est accepté. */
  solutions: string[];
  /** D'où vient la position, s'il y a lieu. */
  origine?: string;
  /** Explication après la réponse. */
  explication: string;
}

export const TACTIQUES: Tactique[] = [
  // ----- Mat en 1
  { id: "mat-couloir", theme: "mat1", niveau: 1, fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", solutions: ["Rd8"],
    explication: "Td8 : mat du couloir. Les propres pions du roi noir lui bloquent la fuite." },
  { id: "mat-couloir-noir", theme: "mat1", niveau: 1, fen: "3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1", solutions: ["Rd1"],
    explication: "Td1 : le même mat du couloir, cette fois pour les Noirs." },
  { id: "mat-dame-roi", theme: "mat1", niveau: 1, fen: "7k/8/6K1/8/8/8/8/Q7 w - - 0 1", solutions: ["Qa8"],
    explication: "Da8 : la dame tient la 8e rangée, le roi blanc prend g7 et h7." },
  { id: "mat-escalier", theme: "mat1", niveau: 1, fen: "k7/7R/8/8/8/8/8/K5R1 w - - 0 1", solutions: ["Rg8"],
    explication: "Tg8 : les deux tours en « escalier » : une tient la 7e rangée, l'autre donne mat sur la 8e." },
  { id: "mat-diagonale", theme: "mat1", niveau: 1, fen: "6k1/5ppp/8/8/8/5Q2/5PPP/6K1 w - - 0 1", solutions: ["Qa8"],
    explication: "Da8 : la dame traverse la grande diagonale et donne mat sur la 8e rangée." },
  { id: "mat-arabe", theme: "mat1", niveau: 2, fen: "7k/8/5N2/8/8/8/8/6RK w - - 0 1", solutions: ["Rg8"],
    explication: "Tg8 : le « mat arabe ». Le cavalier protège la tour et prend h7." },
  { id: "mat-etouffe", theme: "mat1", niveau: 2, fen: "6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1", solutions: ["Nf7"],
    explication: "Cf7 : le mat « étouffé ». Le roi est enfermé par ses propres pièces." },
  { id: "mat-berger", theme: "mat1", niveau: 2, fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", solutions: ["Qxf7"],
    origine: "Le « coup du berger » (1.e4 e5 2.Fc4 Cc6 3.Dh5 Cf6 ?)", explication: "Dxf7 : f7, protégé seulement par le roi, est le point faible du début de partie." },
  { id: "mat-legal", theme: "mat1", niveau: 3, fen: "rn1q1bnr/ppp1kB1p/3p2p1/4N3/4P3/2N5/PPPP1PPP/R1BbK2R w KQ - 1 7", solutions: ["Nd5"],
    origine: "Le mat de Légal", explication: "Cd5 : les trois pièces mineures font mat ; la dame blanche sacrifiée ne servait à rien aux Noirs." },
  { id: "mat-opera", theme: "mat1", niveau: 3, fen: "1n2kb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2KR4 w k - 0 17", solutions: ["Rd8"],
    origine: "Morphy – Brunswick et Isouard, Paris 1858", explication: "Td8 : la tour, protégée par le fou g5, donne mat. Morphy vient de sacrifier sa dame en b8." },
  { id: "mat-immortelle", theme: "mat1", niveau: 3, fen: "r1bk3r/p2p1pNp/n2B1n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 w - - 0 23", solutions: ["Be7"],
    origine: "Anderssen – Kieseritzky, Londres 1851", explication: "Fe7 : les Blancs n'ont plus de dame ni de tours, mais les petites pièces font mat." },
  { id: "mat-toujours-jeune", theme: "mat1", niveau: 3, fen: "1r3kr1/pbpBnp1p/1b3P2/8/8/B1P2q2/P4PPP/3R2K1 w - - 4 24", solutions: ["Bxe7"],
    origine: "Anderssen – Dufresne, Berlin 1852", explication: "Fxe7 : les deux fous croisés ferment toutes les cases du roi." },
  // ----- Fourchettes
  { id: "fourchette-cavalier-roi-dame", theme: "fourchette", niveau: 1, fen: "q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", solutions: ["Nc7"],
    explication: "Cc7+ : échec au roi et attaque de la dame. Après le coup du roi, le cavalier prend la dame." },
  { id: "fourchette-cavalier-roi-tour", theme: "fourchette", niveau: 1, fen: "2r3k1/5ppp/8/3N4/8/8/5PPP/6K1 w - - 0 1", solutions: ["Ne7"],
    explication: "Ce7+ : échec au roi et attaque de la tour c8." },
  { id: "fourchette-pion", theme: "fourchette", niveau: 1, fen: "4k3/8/8/2n1n3/8/8/3P4/4K3 w - - 0 1", solutions: ["d4"],
    explication: "d4 : le pion attaque les deux cavaliers à la fois ; l'un des deux tombera." },
  { id: "fourchette-dame", theme: "fourchette", niveau: 2, fen: "4k3/8/8/8/7n/8/8/3QK3 w - - 0 1", solutions: ["Qa4"],
    explication: "Da4+ : échec au roi par la diagonale, et le cavalier h4 attaqué par la rangée." },
  { id: "fourchette-cavalier-dame-tour", theme: "fourchette", niveau: 2, fen: "4k3/8/8/1q3r2/8/8/2N5/4K3 w - - 0 1", solutions: ["Nd4"],
    explication: "Cd4 : le cavalier attaque la dame b5 et la tour f5, et aucune pièce noire ne peut le prendre." },
  // ----- Clouages
  { id: "clouage-tour-cavalier", theme: "clouage", niveau: 1, fen: "4k3/8/4n3/8/8/8/8/R5K1 w - - 0 1", solutions: ["Re1"],
    explication: "Te1 : le cavalier e6 est cloué devant son roi, il ne peut plus bouger." },
  { id: "clouage-fou-cavalier", theme: "clouage", niveau: 1, fen: "4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1", solutions: ["Bb5"],
    explication: "Fb5 : le cavalier c6 est cloué sur la diagonale du roi e8." },
  { id: "clouage-fou-tour", theme: "clouage", niveau: 2, fen: "6k1/5r2/8/8/8/8/8/3BK3 w - - 0 1", solutions: ["Bb3"],
    explication: "Fb3 : la tour f7 est clouée devant le roi ; le fou la prendra (une tour contre un fou)." },
  { id: "clouage-tour-dame", theme: "clouage", niveau: 2, fen: "4k3/4q3/8/8/8/8/3K4/7R w - - 0 1", solutions: ["Re1"],
    explication: "Te1 : la dame est clouée. Si elle prend la tour, le roi blanc la reprend : la dame est perdue contre une tour." },
  // ----- Pièces en prise
  { id: "prise-dame", theme: "prise", niveau: 1, fen: "4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1", solutions: ["Rxd5"],
    explication: "Txd5 : la dame noire n'est défendue par personne." },
  { id: "prise-tour", theme: "prise", niveau: 1, fen: "4k3/8/8/8/2r5/8/3N4/4K3 w - - 0 1", solutions: ["Nxc4"],
    explication: "Cxc4 : un cavalier attaque en « L » : la tour c4 n'est pas défendue." },
  { id: "prise-grande-diagonale", theme: "prise", niveau: 1, fen: "4k3/6n1/8/8/8/8/1B6/4K3 w - - 0 1", solutions: ["Bxg7"],
    explication: "Fxg7 : le fou traverse toute la grande diagonale." },
  { id: "prise-noir-cavalier", theme: "prise", niveau: 1, fen: "4k3/8/8/8/3n4/5Q2/8/4K3 b - - 0 1", solutions: ["Nxf3"],
    explication: "Cxf3+ : la dame blanche n'est pas défendue (le roi e1 ne touche pas f3)." },
  { id: "prise-pion", theme: "prise", niveau: 1, fen: "4k3/8/8/3n4/4P3/8/8/4K3 w - - 0 1", solutions: ["exd5"],
    explication: "exd5 : le pion prend en diagonale, vers l'avant." },
  // ----- Découverte
  { id: "decouverte-cavalier", theme: "decouverte", niveau: 2, fen: "4k3/8/8/3q4/8/8/4N3/4RK2 w - - 0 1", solutions: ["Nc3", "Nf4"],
    explication: "Cc3+ (ou Cf4+) : la tour e1 donne échec à la découverte et le cavalier attaque la dame. Les Noirs doivent parer l'échec : la dame tombe." },
];

export const tactique = (id: string): Tactique | undefined => TACTIQUES.find((t) => t.id === id);

const sansSigne = (san: string) => san.replace(/[+#!?]/g, "");

/** Vérifie un coup joué (de `from` à `to`). Renvoie le coup en notation et s'il est bon. */
export function jouerCoup(t: Tactique, from: string, to: string, promotion = "q"): { san: string; bon: boolean } | null {
  const c = new Chess(t.fen);
  let m;
  try { m = c.move({ from, to, promotion }); } catch { return null; }
  const bon = t.theme === "mat1" ? c.isCheckmate() : t.solutions.includes(sansSigne(m.san));
  return { san: m.san, bon };
}

/** Le camp au trait, pour tourner l'échiquier. */
export const trait = (fen: string): "white" | "black" => (fen.split(" ")[1] === "b" ? "black" : "white");

/** Les coups légaux, au format attendu par chessground (case de départ → cases d'arrivée). */
export function destinations(fen: string): Map<string, string[]> {
  const d = new Map<string, string[]>();
  for (const m of new Chess(fen).moves({ verbose: true })) d.set(m.from, [...(d.get(m.from) ?? []), m.to]);
  return d;
}

/** Notation française d'un coup (« Cf3 », « Dxf7# »). */
export const sanFr = (san: string) => san.replace(/[KQRBN]/g, (x) => ({ K: "R", Q: "D", R: "T", B: "F", N: "C" })[x]!);

/** Le coup solution (cases de départ et d'arrivée), pour le montrer par une flèche. */
export function coupSolution(t: Tactique): { from: string; to: string; san: string } {
  const m = new Chess(t.fen).move(t.solutions[0]);
  return { from: m.from, to: m.to, san: m.san };
}
