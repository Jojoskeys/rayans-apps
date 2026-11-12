'use strict';
/**
 * Découpage d'une partie en phases (ouverture, milieu de jeu, finale), règle simplifiée inspirée du
 * « Divider » de Lichess (sans son critère de « mélange » des pièces). Évaluée sur la position AVANT
 * chaque demi-coup ; une phase atteinte ne revient jamais en arrière.
 *  - Finale : au plus 6 pièces sur l'échiquier hors rois et pions (les deux camps ensemble).
 *  - Milieu de jeu : dès que l'un des critères est rempli : au plus 10 pièces hors rois et pions,
 *    ou un camp a moins de 4 de ses pièces (pions compris) sur sa première rangée, ou le coup 16 est commencé.
 *  - Ouverture : avant.
 */
const PHASES = ['ouverture', 'milieu', 'finale'];
const PHASE_LABELS = { ouverture: 'Ouverture', milieu: 'Milieu de jeu', finale: 'Finale' };
const ENDGAME_MAX_PIECES = 6;
const MIDDLEGAME_MAX_PIECES = 10;
const BACKRANK_MIN = 4;
const MIDDLEGAME_MOVE = 16;

function fenStats(fen) {
  const [board, , , , , fullmove] = fen.split(' ');
  const rows = board.split('/'); // rows[0] = 8e rangée
  let pieces = 0;
  for (const ch of board) if (/[nbrqNBRQ]/.test(ch)) pieces++;
  const countRow = (row, upper) => {
    let n = 0;
    for (const ch of row) if (/[a-zA-Z]/.test(ch) && (upper ? ch === ch.toUpperCase() : ch === ch.toLowerCase())) n++;
    return n;
  };
  return { pieces, whiteBack: countRow(rows[7], true), blackBack: countRow(rows[0], false), fullmove: parseInt(fullmove, 10) || 1 };
}

function rawPhase(fen) {
  const s = fenStats(fen);
  if (s.pieces <= ENDGAME_MAX_PIECES) return 2;
  if (s.pieces <= MIDDLEGAME_MAX_PIECES || s.whiteBack < BACKRANK_MIN || s.blackBack < BACKRANK_MIN || s.fullmove >= MIDDLEGAME_MOVE) return 1;
  return 0;
}

/** Phase de chaque demi-coup : tableau de 'ouverture' | 'milieu' | 'finale', dans l'ordre des demi-coups. */
function phasesOf(plies) {
  let cur = 0;
  return plies.map((p) => {
    cur = Math.max(cur, rawPhase(p.fenBefore));
    return PHASES[cur];
  });
}

module.exports = { PHASES, PHASE_LABELS, phasesOf, rawPhase, fenStats };
