// « Mémoire de position » : de vraies positions (parties célèbres, grandes lignes d'ouverture, finales de
// manuel), jamais des pièces jetées au hasard : c'est sur les positions réelles que la mémoire des joueurs
// progresse (Chase et Simon, 1973). Chaque position est recalculée coup par coup avec chess.js (testé).
import { Chess } from "chess.js";
import { CASES, lirePlacement, nbPieces, type Placement } from "./echiquier.ts";
import type { Rng } from "./rng.ts";

export interface Partie { id: string; nom: string; coups: string }

/** Parties célèbres et lignes d'ouverture très jouées (notation anglaise, comme chess.js). */
export const PARTIES: Partie[] = [
  { id: "opera", nom: "Morphy – duc de Brunswick et comte Isouard, Paris 1858 (« partie de l'Opéra »)",
    coups: "e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#" },
  { id: "immortelle", nom: "Anderssen – Kieseritzky, Londres 1851 (« l'Immortelle »)",
    coups: "e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#" },
  { id: "toujours-jeune", nom: "Anderssen – Dufresne, Berlin 1852 (« la Toujours Jeune »)",
    coups: "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7 Qxd7+ Kxd7 Bf5+ Ke8 Bd7+ Kf8 Bxe7#" },
  { id: "legal", nom: "Le mat de Légal (piège connu depuis le XVIIIe siècle)",
    coups: "e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#" },
  { id: "espagnole", nom: "Partie espagnole, variante fermée",
    coups: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Na5 Bc2 c5 d4 Qc7 Nbd2 cxd4 cxd4 Nc6" },
  { id: "najdorf", nom: "Défense sicilienne, variante Najdorf (attaque anglaise)",
    coups: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7 g4 b5 g5 b4 Ne2 Ne8" },
  { id: "gambit-dame", nom: "Gambit dame refusé, variante orthodoxe",
    coups: "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6 Bd3 dxc4 Bxc4 Nd5 Bxe7 Qxe7 O-O Nxc3 Rxc3 e5" },
  { id: "italienne", nom: "Partie italienne (Giuoco Piano lent)",
    coups: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3 h6 Nbd2 Re8 Nf1 Be6 Bc2 d5" },
  { id: "est-indienne", nom: "Défense est-indienne, variante classique",
    coups: "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Nd3 f5 Bd2 Nf6 f3 f4" },
  { id: "caro-kann", nom: "Défense Caro-Kann, variante classique",
    coups: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6 Bd2 Ngf6 O-O-O Be7 Kb1 O-O" },
];

/** Finales de manuel et études célèbres (peu de pièces : pour commencer). */
export const FINALES: { id: string; nom: string; fen: string }[] = [
  { id: "opposition", nom: "Roi et pion contre roi : l'opposition", fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1" },
  { id: "carre", nom: "Roi et pion contre roi : la règle du carré", fen: "8/8/8/8/1p6/8/6K1/k7 w - - 0 1" },
  { id: "dame-roi", nom: "Mat avec la dame", fen: "8/8/8/4k3/8/8/8/3QK3 w - - 0 1" },
  { id: "tour-roi", nom: "Mat avec la tour", fen: "8/8/3k4/8/8/8/8/R3K3 w - - 0 1" },
  { id: "reti", nom: "Étude de Réti (1921)", fen: "7K/8/k1P5/7p/8/8/8/8 w - - 0 1" },
  { id: "saavedra", nom: "Position de Saavedra (1895)", fen: "8/8/1KP5/3r4/8/8/8/k7 w - - 0 1" },
  { id: "lucena", nom: "Position de Lucena (tour et pion contre tour)", fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1" },
  { id: "philidor", nom: "Position de Philidor (défense tour contre tour et pion)", fen: "4k3/7R/1r6/4PK2/8/8/8/8 b - - 0 1" },
  { id: "fou-pion-tour", nom: "Fou et pion de la tour : la mauvaise couleur", fen: "7k/8/6K1/7P/8/8/8/5B2 w - - 0 1" },
  { id: "deux-pions", nom: "Deux pions liés contre roi", fen: "8/8/8/3k4/8/3PP3/3K4/8 w - - 0 1" },
];

export interface PositionMemoire { id: string; nom: string; fen: string; pieces: number }

/** Toutes les positions : les finales, et pour chaque partie une position tous les 4 demi-coups à partir du 10e. */
function construire(): PositionMemoire[] {
  const out: PositionMemoire[] = FINALES.map((f) => ({ id: f.id, nom: f.nom, fen: f.fen, pieces: nbPieces(f.fen) }));
  for (const p of PARTIES) {
    const c = new Chess();
    const coups = p.coups.split(" ");
    coups.forEach((san, i) => {
      c.move(san);
      const demi = i + 1;
      if (demi >= 10 && (demi % 4 === 2 || demi === coups.length)) {
        const n = Math.ceil(demi / 2);
        out.push({ id: `${p.id}-${demi}`, nom: `${p.nom}, après le ${n}${n === 1 ? "er" : "e"} coup ${demi % 2 ? "blanc" : "noir"}`, fen: c.fen(), pieces: nbPieces(c.fen()) });
      }
    });
  }
  return out;
}

let cache: PositionMemoire[] | null = null;
export const positionsMemoire = (): PositionMemoire[] => (cache ??= construire());

/** Ce qui change avec le niveau : quelles positions, combien de secondes pour regarder, pions donnés ou non. */
export interface ParamsMemoire { min: number; max: number; secondes: number; pionsDonnes: boolean }
export const PARAMS_MEMOIRE: ParamsMemoire[] = [
  { min: 3, max: 5, secondes: 10, pionsDonnes: false },
  { min: 3, max: 7, secondes: 8, pionsDonnes: false },
  { min: 16, max: 26, secondes: 15, pionsDonnes: true },
  { min: 16, max: 32, secondes: 10, pionsDonnes: true },
  { min: 16, max: 26, secondes: 20, pionsDonnes: false },
  { min: 16, max: 26, secondes: 12, pionsDonnes: false },
  { min: 27, max: 32, secondes: 15, pionsDonnes: false },
  { min: 27, max: 32, secondes: 10, pionsDonnes: false },
  { min: 16, max: 32, secondes: 7, pionsDonnes: false },
  { min: 16, max: 32, secondes: 5, pionsDonnes: false },
];
export const paramsMemoire = (niveau: number): ParamsMemoire => PARAMS_MEMOIRE[Math.min(PARAMS_MEMOIRE.length, Math.max(1, niveau)) - 1];

/** Une position du niveau, en évitant celles vues récemment (`recentes`). */
export function choisirPosition(niveau: number, rng: Rng, recentes: string[] = []): PositionMemoire {
  const p = paramsMemoire(niveau);
  const toutes = positionsMemoire().filter((x) => x.pieces >= p.min && x.pieces <= p.max);
  const neuves = toutes.filter((x) => !recentes.includes(x.id));
  const liste = neuves.length ? neuves : toutes;
  return liste[Math.floor(rng() * liste.length)];
}

/** Ce qui est déjà posé sur l'échiquier vide au départ (les pions, aux niveaux où ils sont donnés). */
export function departReconstruction(fen: string, pionsDonnes: boolean): Placement {
  if (!pionsDonnes) return {};
  const p = lirePlacement(fen);
  return Object.fromEntries(Object.entries(p).filter(([, x]) => x.type === "p"));
}

export interface ScoreMemoire {
  /** Pièces à retrouver. */
  total: number;
  justes: number;
  /** Pièces posées là où il n'y a rien, ou la mauvaise pièce. */
  fausses: number;
  oubliees: number;
  /** (justes − fausses) / total, entre 0 et 1. */
  part: number;
  reussi: boolean;
  /** Détail case par case (pour l'affichage) : "juste", "fausse" ou "oubliee". */
  cases: Record<string, "juste" | "fausse" | "oubliee">;
}

/** Compare la reconstruction à la vraie position. Réussi à partir de 80 %. */
export function noterReconstruction(fen: string, pose: Placement, pionsDonnes: boolean): ScoreMemoire {
  const vraie = lirePlacement(fen);
  const donnees = departReconstruction(fen, pionsDonnes);
  const cases: ScoreMemoire["cases"] = {};
  let total = 0, justes = 0, fausses = 0, oubliees = 0;
  for (const sq of CASES) {
    if (donnees[sq]) continue;
    const v = vraie[sq];
    const x = pose[sq];
    if (v) total++;
    if (v && x && v.type === x.type && v.color === x.color) { justes++; cases[sq] = "juste"; }
    else if (x) { fausses++; cases[sq] = "fausse"; if (v) oubliees++; }
    else if (v) { oubliees++; cases[sq] = "oubliee"; }
  }
  const part = total ? Math.max(0, (justes - fausses) / total) : 0;
  return { total, justes, fausses, oubliees, part, reussi: part >= 0.8, cases };
}
