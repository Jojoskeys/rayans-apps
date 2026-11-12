'use strict';
/**
 * Explications en français d'un coup raté. Chaque motif est vérifié en rejouant légalement
 * les variantes du moteur avec chess.js ; aucun motif n'est affirmé sans cette vérification.
 */
const {
  Chess, VALUES, NAMES_ART, NAMES_DE, frSan, uciToObj, playUciLine, formatLine, attackedSquares, isDefended, attackersOf,
} = require('./chessutil');
const { formatScore, scoreWin } = require('./scoring');

const HORIZON = 8;

function balanceFor(chess, color) {
  let s = 0;
  for (const row of chess.board()) for (const sq of row) if (sq) s += (sq.color === color ? 1 : -1) * VALUES[sq.type];
  return s;
}

/** Évolution du matériel le long d'une variante, du point de vue `color`. */
function materialSwing(fen, ucis, color) {
  const c = new Chess(fen);
  const start = balanceFor(c, color);
  const line = (ucis || []).slice(0, HORIZON);
  let last = start;
  let settled = start;
  for (let i = 0; i < line.length; i++) {
    let m;
    try { m = c.move(uciToObj(line[i])); } catch (e) { m = null; }
    if (!m) break;
    last = balanceFor(c, color);
    // On mesure à un point « calme » : le coup suivant de la variante n'est pas une prise.
    const next = line[i + 1];
    let nextIsCapture = false;
    if (next) {
      const t = c.get(next.slice(2, 4));
      nextIsCapture = !!t || (c.get(next.slice(0, 2)) || {}).type === 'p' && next[0] !== next[2];
    }
    if (!nextIsCapture) settled = last;
  }
  return { start, end: settled, delta: settled - start, rawEnd: last };
}

/** Fourchette : la pièce en `sq` attaque au moins deux cibles (roi, pièce plus chère ou non défendue). */
function detectFork(chess, sq) {
  const p = chess.get(sq);
  if (!p || p.type === 'k') return null;
  const targets = [];
  for (const t of attackedSquares(chess, sq)) {
    const q = chess.get(t);
    if (!q || q.color === p.color || q.type === 'p') continue;
    if (q.type === 'k' || VALUES[q.type] > VALUES[p.type] || !isDefended(chess, t)) targets.push({ sq: t, piece: q });
  }
  if (targets.length >= 2) return { piece: p, square: sq, targets };
  return null;
}

/** Pièces du camp `color` en prise (attaquées et non défendues, ou attaquées par moins cher). */
function hangingPieces(chess, color) {
  const opp = color === 'w' ? 'b' : 'w';
  const out = [];
  for (const row of chess.board()) for (const q of row) {
    if (!q || q.color !== color || q.type === 'k' || q.type === 'p') continue;
    const atk = attackersOf(chess, q.square, opp);
    if (!atk.length) continue;
    const cheaper = atk.some((a) => VALUES[a.type] < VALUES[q.type]);
    if (cheaper || !isDefended(chess, q.square)) out.push(q);
  }
  return out;
}

function describeTargets(targets) {
  return targets.map((t) => `${NAMES_ART[t.piece.type]} en ${t.sq}`).join(' et ');
}

/**
 * Construit l'explication d'un coup.
 * @returns {{ sentences: string[], motifs: string[], lines: object }}
 */
function explainMove(ply, cls) {
  const fen = ply.fenBefore;
  const color = fen.split(' ')[1];
  const sentences = [];
  const motifs = [];
  const bestLine = playUciLine(fen, ply.best && ply.best.pv, 12);
  const playedLine = playUciLine(fen, ply.played && ply.played.pv, 12);
  const secondLine = ply.second ? playUciLine(fen, ply.second.pv, 12) : null;
  const lines = {
    best: { san: bestLine.sans, text: formatLine(fen, bestLine.sans), score: ply.best && ply.best.score },
    played: { san: playedLine.sans, text: formatLine(fen, playedLine.sans), score: ply.played && ply.played.score },
    second: secondLine ? { san: secondLine.sans, text: formatLine(fen, secondLine.sans), score: ply.second.score } : null,
  };
  if (!cls || cls.category === null || cls.isBest) return { sentences, motifs, lines };
  if (['theorie', 'brillant', 'tres_bon', 'meilleur', 'excellent'].includes(cls.category)) return { sentences, motifs, lines };

  const bestSan = frSan(bestLine.sans[0]);
  const playedSan = frSan(playedLine.sans[0] || ply.san);

  // --- Ce que le coup joué permet à l'adversaire ---
  const ps = ply.played.score;
  if (typeof ps.mate === 'number' && ps.mate < 0) {
    const replay = playUciLine(fen, ply.played.pv);
    const confirmed = replay.valid && replay.final.isCheckmate();
    sentences.push(confirmed
      ? `Après ${playedSan}, l’adversaire a un mat forcé en ${Math.abs(ps.mate)} : ${formatLine(fen, replay.sans)}.`
      : `Après ${playedSan}, Stockfish annonce un mat en ${Math.abs(ps.mate)} pour l’adversaire : ${lines.played.text}.`);
    motifs.push('menace_mat');
  }
  if (playedLine.moves.length >= 2) {
    const c = new Chess(fen);
    c.move(uciToObj(ply.played.pv[0]));
    const hanging = hangingPieces(c, color);
    const reply = playedLine.moves[1];
    const lost = hanging.find((h) => h.square === reply.to && reply.captured);
    if (lost) {
      sentences.push(`${playedSan} laisse ${NAMES_ART[lost.type]} en ${lost.square} en prise : l’adversaire répond ${frSan(reply.san)}.`);
      motifs.push('piece_en_prise');
    } else {
      const fork = (() => {
        const c2 = new Chess(fen);
        c2.move(uciToObj(ply.played.pv[0]));
        c2.move(uciToObj(ply.played.pv[1]));
        return detectFork(c2, reply.to);
      })();
      const swing = materialSwing(fen, ply.played.pv, color);
      if (fork && swing.delta <= -2) {
        sentences.push(`${playedSan} permet ${frSan(reply.san)}, une fourchette ${NAMES_DE[fork.piece.type]} sur ${describeTargets(fork.targets)}.`);
        motifs.push('fourchette_adverse');
      }
    }
  }
  if (!motifs.includes('piece_en_prise') && !motifs.includes('menace_mat')) {
    const swing = materialSwing(fen, ply.played.pv, color);
    if (swing.delta <= -2) {
      sentences.push(`Dans la variante qui suit ${playedSan}, vous perdez ${-swing.delta} point(s) de matériel : ${lines.played.text}.`);
      motifs.push('perte_materiel');
    }
  }

  // --- Ce que le meilleur coup obtenait ---
  const bs = ply.best.score;
  if (typeof bs.mate === 'number' && bs.mate > 0) {
    const replay = playUciLine(fen, ply.best.pv);
    const confirmed = replay.valid && replay.final.isCheckmate();
    sentences.push(confirmed
      ? `${bestSan} menait à un mat forcé en ${bs.mate} : ${formatLine(fen, replay.sans)}.`
      : `${bestSan} menait, selon Stockfish, à un mat en ${bs.mate} : ${lines.best.text}.`);
    motifs.push('mat_manque');
  } else if (bestLine.moves.length) {
    const first = bestLine.moves[0];
    const c = new Chess(fen);
    c.move(uciToObj(ply.best.pv[0]));
    const fork = detectFork(c, first.to);
    const swing = materialSwing(fen, ply.best.pv, color);
    if (fork && swing.delta >= 2) {
      sentences.push(`${bestSan} était une fourchette sur ${describeTargets(fork.targets)}, qui gagne du matériel : ${lines.best.text}.`);
      motifs.push('fourchette');
    } else if (first.captured && swing.delta >= 2) {
      sentences.push(`${bestSan} prenait ${NAMES_ART[first.captured]} et gagnait ${swing.delta} point(s) de matériel : ${lines.best.text}.`);
      motifs.push('prise');
    } else if (c.isCheck() && swing.delta >= 2) {
      sentences.push(`${bestSan} donnait échec et gagnait ${swing.delta} point(s) de matériel : ${lines.best.text}.`);
      motifs.push('echec_gain');
    } else if (first.captured) {
      sentences.push(`${bestSan} reprenait ${NAMES_ART[first.captured]} en ${first.to}.`);
      motifs.push('prise_simple');
    }
  }

  if (motifs.length === 0) {
    const wb = scoreWin(ply.best.score);
    const wp = scoreWin(ply.played.score);
    sentences.push(`Aucun motif tactique simple n’a été détecté. L’évaluation passe de ${formatScore(ply.best.score)} (avec ${bestSan}) à ${formatScore(ply.played.score)} (après ${playedSan}), du point de vue du joueur au trait : ${(wb - wp).toFixed(1)} points de chances de gain perdus.`);
    sentences.push(`La variante du meilleur coup illustre la différence : ${lines.best.text}.`);
  }
  return { sentences, motifs, lines };
}

module.exports = { explainMove, materialSwing, detectFork, hangingPieces };
