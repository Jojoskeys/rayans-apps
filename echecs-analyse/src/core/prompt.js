'use strict';
/** Texte copié par le bouton « Demander à Claude » (aucun envoi automatique). */
const { formatScore } = require('./scoring');
const { frSan } = require('./chessutil');

function moveLabel(fen, san) {
  const parts = fen.split(' ');
  const n = parts[5] || '1';
  const f = frSan(san);
  return parts[1] === 'w' ? `${n}. ${f}` : `${n}... ${f}`;
}

/**
 * @param {object} d { game, fenBefore, san, uci, categoryLabel, loss, best:{san,uci,score,depth},
 *                    played:{score,depth}, lines:{best,second,played}, engineName, depth, explored }
 */
function buildClaudePrompt(d) {
  const side = d.fenBefore.split(' ')[1] === 'w' ? 'Blancs' : 'Noirs';
  const out = [];
  out.push('Bonjour Claude. Peux-tu m’expliquer de façon pédagogique, en français, ce coup d’échecs : ce qu’il change, pourquoi le meilleur coup du moteur est préférable, et quelles idées (menaces, tactiques, plans) j’aurais dû voir ?');
  out.push('');
  if (d.game) {
    const g = d.game;
    out.push(`Partie : ${g.white} (${g.whiteElo || '?'}) – ${g.black} (${g.blackElo || '?'}), ${g.date || ''}${g.url ? ' — ' + g.url : ''}`);
  }
  if (d.explored) out.push('Contexte : coup joué dans une variante explorée à partir de cette partie (pas dans la partie originale).');
  out.push(`Position avant le coup (FEN) : ${d.fenBefore}`);
  out.push(`Camp au trait : ${side}`);
  out.push(`Coup joué : ${moveLabel(d.fenBefore, d.san)} (UCI ${d.uci})${d.categoryLabel ? ` — classé « ${d.categoryLabel} »` : ''}${typeof d.loss === 'number' ? `, perte de ${d.loss.toFixed(1).replace('.', ',')} points de chances de gain` : ''}`);
  if (d.best) out.push(`Meilleur coup selon Stockfish : ${moveLabel(d.fenBefore, d.best.san)} (UCI ${d.best.uci})`);
  out.push(`Scores (centipions, point de vue des ${side}) : meilleur coup ${formatScore(d.best && d.best.score)} ; coup joué ${formatScore(d.played && d.played.score)}`);
  out.push('Notation algébrique française : R roi, D dame, T tour, F fou, C cavalier (les coups UCI sont aussi indiqués).');
  out.push(`Moteur : ${d.engineName || 'Stockfish'}, profondeur ${d.depth || '?'}`);
  if (d.lines) {
    if (d.lines.best && d.lines.best.text) out.push(`Variante Stockfish n° 1 (${formatScore(d.lines.best.score)}) : ${d.lines.best.text}`);
    if (d.lines.second && d.lines.second.text) out.push(`Variante Stockfish n° 2 (${formatScore(d.lines.second.score)}) : ${d.lines.second.text}`);
    if (d.lines.played && d.lines.played.text) out.push(`Variante après le coup joué (${formatScore(d.lines.played.score)}) : ${d.lines.played.text}`);
  }
  out.push('');
  out.push('Merci de t’appuyer uniquement sur ces données : vérifie que chaque coup que tu cites est légal dans la position donnée, et signale-le si une explication est incertaine.');
  return out.join('\n');
}

module.exports = { buildClaudePrompt, moveLabel };
