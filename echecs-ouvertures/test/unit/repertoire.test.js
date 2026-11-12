'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../src/core/repertoire');
const { openings, game } = require('../helpers');

const NAJDORF_QH5 = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Qh5', 'e6', 'Qe2'];

test('ouverture, couleur et sortie de théorie (par le joueur ou par l’adversaire)', () => {
  const g = game(NAJDORF_QH5);
  const w = R.gameOpening(g, 'moi', openings);
  assert.equal(w.color, 'w');
  assert.equal(w.opening.name, 'Sicilian Defense: Najdorf Variation');
  assert.equal(w.opening.family, 'Sicilian Defense');
  assert.equal(w.opening.eco, 'B90');
  assert.equal(w.lastBookPly, 10);
  assert.deepEqual(w.departure, { ply: 11, byPlayer: true, san: 'Qh5' });
  assert.equal(w.points, 1);
  assert.deepEqual(R.movesToAnalyze(w).map((p) => p.san), ['Qh5', 'Qe2']);

  const b = R.gameOpening(g, 'LUI', openings);
  assert.equal(b.color, 'b');
  assert.equal(b.departure.byPlayer, false);
  assert.equal(b.points, 0);
  assert.deepEqual(R.movesToAnalyze(b).map((p) => p.san), ['e6']);

  assert.equal(R.gameOpening(g, 'personne', openings), null, 'joueur absent de la partie');
});

test('seuls les 15 premiers coups comptent ; partie entièrement théorique', () => {
  const long = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3', 'Nb8', 'd4', 'Nbd7',
    'Nbd2', 'Bb7', 'Bc2', 'Re8', 'Nf1', 'Bf8', 'Ng3', 'g6', 'a4', 'c5', 'd5', 'c4', 'Be3', 'Qc7'];
  const i = R.gameOpening(game(long), 'moi', openings);
  assert.equal(i.sans.length, R.MAX_PLY);
  assert.equal(i.opening.family, 'Ruy Lopez');
  assert.ok(R.movesToAnalyze(i).every((p) => p.ply <= R.MAX_PLY));
  const short = R.gameOpening(game(['e4', 'e5', 'Nf3', 'Nc6']), 'moi', openings);
  assert.equal(short.departure, null, 'jamais sortie de la théorie');
  assert.equal(R.movesToAnalyze(short).length, 0);
  const odd = R.gameOpening(game(['h4', 'h5', 'Rh3', 'Rh6', 'Ra3']), 'moi', openings);
  assert.equal(odd.opening.family, odd.opening.name ? R.familyOf(odd.opening.name) : R.UNKNOWN_FAMILY);
});

test('coups de la théorie depuis une position', () => {
  const fen = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'; // 1. e4 c5
  const book = R.bookMoves(fen, openings).map((m) => m.san);
  assert.ok(book.includes('Nf3') && book.includes('c3') && book.includes('Nc3'));
  assert.ok(!book.includes('Qh5'));
});

test('catégories de perte', () => {
  assert.equal(R.categoryOf(2), null);
  assert.equal(R.categoryOf(5), 'imprecision');
  assert.equal(R.categoryOf(12), 'erreur');
  assert.equal(R.categoryOf(20), 'gaffe');
  assert.equal(R.categoryOf(undefined), null);
});

function analysisFor(info, losses) {
  // Analyse fictive : chaque coup à analyser reçoit la perte indiquée (par SAN).
  return {
    depth: 12,
    moves: R.movesToAnalyze(info).map((p) => ({
      ply: p.ply, fen: p.fenBefore, uci: p.uci, san: p.san, loss: losses[p.san] || 0,
      best: { uci: 'b1c3', score: { cp: 50 }, pv: ['b1c3'] }, second: { uci: 'f1e2', score: { cp: 40 } }, played: { score: { cp: 0 } },
    })),
  };
}

test('exercices : même position dans plusieurs parties → un seul exercice ; sortie de théorie légère ignorée', () => {
  const i1 = R.gameOpening(game(NAJDORF_QH5), 'moi', openings);
  const i2 = R.gameOpening(game(NAJDORF_QH5, { result: '0-1', endTime: 1800000000 }), 'moi', openings);
  const i3 = R.gameOpening(game(['d4', 'd5', 'c4', 'e6', 'Qd3']), 'moi', openings); // sortie qui perd 4 pts → « sortie »
  const i4 = R.gameOpening(game(['d4', 'd5', 'c4', 'e6', 'Qb3']), 'moi', openings); // sortie qui perd 1 pt → rien
  const drills = R.buildDrills([
    { info: i1, analysis: analysisFor(i1, { Qh5: 22, Qe2: 1 }) },
    { info: i2, analysis: analysisFor(i2, { Qh5: 15 }) },
    { info: i3, analysis: analysisFor(i3, { Qd3: 4 }) },
    { info: i4, analysis: analysisFor(i4, { Qb3: 1 }) },
    { info: i4, analysis: null },
  ], openings);
  assert.equal(drills.length, 2);
  const sic = drills.find((d) => d.opening.family === 'Sicilian Defense');
  assert.equal(sic.occurrences.length, 2);
  assert.equal(sic.category, 'gaffe', 'catégorie la plus grave');
  assert.equal(sic.worstLoss, 22);
  assert.equal(sic.lastSeen, 1800000000);
  assert.equal(sic.ply, 11);
  assert.deepEqual(sic.line, NAJDORF_QH5.slice(0, 10));
  assert.ok(sic.book.length > 0, 'la position avant 6. Dh5 est théorique');
  assert.equal(sic.id, R.drillId('w', sic.fen));
  const qg = drills.find((d) => d.opening.family !== 'Sicilian Defense');
  assert.equal(qg.category, 'sortie');
});

test('vérification des réponses', () => {
  const i = R.gameOpening(game(NAJDORF_QH5), 'moi', openings);
  const [d] = R.buildDrills([{ info: i, analysis: analysisFor(i, { Qh5: 22 }) }], openings);
  assert.equal(R.quickCheck(d, 'b1c3').accepted, true, 'meilleur coup');
  assert.equal(R.quickCheck(d, 'f1e2').accepted, true, '2e choix presque aussi bon');
  assert.equal(R.quickCheck(d, 'd1h5').accepted, false, 'coup joué dans la partie');
  assert.equal(R.quickCheck(d, 'f2f3'), null, 'autre coup : évaluation nécessaire');
  // Meilleur coup fictif à +0,50 : un coup à 0,00 perd ≈ 4,6 pts, à +0,30 ≈ 1,8 pt, à −1,50 ≈ 20 pts.
  const bookUci = d.book.find((b) => b.uci !== 'b1c3' && b.uci !== 'f1e2').uci;
  assert.ok(!d.book.some((b) => b.uci === 'f2f3'));
  assert.equal(R.judgeScore(d, bookUci, { cp: 0 }).accepted, true, 'théorie : tolérance de 6 pts');
  assert.equal(R.judgeScore(d, bookUci, { cp: -150 }).accepted, false, 'théorie douteuse refusée');
  assert.equal(R.judgeScore(d, 'f2f3', { cp: 30 }).accepted, true, 'hors théorie : perte ≤ 3 pts');
  assert.equal(R.judgeScore(d, 'f2f3', { cp: 0 }).accepted, false, 'hors théorie : perte > 3 pts');
});

test('répétition espacée et sélection', () => {
  const now = 1e12;
  let s = R.nextState(null, true, now);
  assert.equal(s.box, 1); assert.equal(s.due, now + 86400000);
  s = R.nextState(s, true, now);
  assert.equal(s.box, 2); assert.equal(s.successes, 2);
  s = R.nextState(s, false, now);
  assert.equal(s.box, 0); assert.equal(s.due, now + 10 * 60000); assert.equal(s.attempts, 3);

  const mk = (id, category, n, color = 'w', family = 'A') => ({ id, color, category, ply: 9, lastSeen: 0, opening: { family }, occurrences: new Array(n).fill({}) });
  const drills = [mk('a', 'imprecision', 1), mk('b', 'gaffe', 1), mk('c', 'imprecision', 5), mk('d', 'erreur', 1, 'b', 'B'), mk('e', 'gaffe', 1)];
  const states = { e: { box: 0, attempts: 1, successes: 0, due: now - 1 }, d: { box: 3, attempts: 3, successes: 3, due: now + 1000 } };
  const r = R.selectDrills(drills, states, {}, now);
  assert.deepEqual(r.drills.map((d) => d.id), ['e', 'b', 'c', 'a', 'd'], 'révision, puis gravité, puis fréquence, puis non dus');
  assert.deepEqual(r.counts, { total: 5, due: 4, neverSeen: 3, mastered: 1 });
  assert.deepEqual(R.selectDrills(drills, states, { onlyDue: true, color: 'b' }, now).drills, []);
  assert.deepEqual(R.selectDrills(drills, states, { family: 'B' }, now).drills.map((d) => d.id), ['d']);
});

test('répertoire par couleur et par ouverture, avec taux de réussite', () => {
  const now = 1e12;
  const g1 = game(NAJDORF_QH5);
  const g2 = game(NAJDORF_QH5, { result: '1/2-1/2' });
  const g3 = game(['e4', 'e5', 'Nf3', 'Nc6'], { white: 'Lui', black: 'Moi', result: '0-1' });
  const infos = [g1, g2, g3].map((g) => R.gameOpening(g, 'moi', openings));
  const analyses = { [g1.id]: analysisFor(infos[0], { Qh5: 22, Qe2: 6 }) };
  const drills = R.buildDrills([{ info: infos[0], analysis: analyses[g1.id] }], openings);
  assert.equal(drills.length, 2);
  const states = { [drills[0].id]: { box: 3, attempts: 4, successes: 3, due: now + 1 } };
  const rep = R.buildRepertoire(infos, analyses, drills, states, now);
  assert.equal(rep.w.length, 1);
  const sic = rep.w[0];
  assert.equal(sic.family, 'Sicilian Defense');
  assert.equal(sic.games, 2);
  assert.equal(sic.scorePct, 75);
  assert.equal(sic.avgDepartureMove, 5.5);
  assert.equal(sic.departuresByPlayerPct, 100);
  assert.equal(sic.analysedGames, 1);
  assert.deepEqual(sic.mistakes, { gaffe: 1, erreur: 0, imprecision: 1 });
  assert.equal(sic.drills, 2);
  assert.equal(sic.drillsDue, 1);
  assert.equal(sic.drillsMastered, 1);
  assert.equal(sic.successRate, 75);
  assert.equal(sic.variations[0].name, 'Sicilian Defense: Najdorf Variation');
  assert.equal(rep.b.length, 1);
  assert.equal(rep.b[0].scorePct, 100);
  assert.equal(rep.b[0].stayedInBook, 1);
  assert.equal(rep.b[0].successRate, null, 'aucun essai');
});

test('lecture rapide des premiers coups d’un PGN Chess.com (horloges, numéros, résultat)', () => {
  const pgn = '[Event "Live Chess"]\n[Site "Chess.com"]\n[Result "0-1"]\n\n1. e4 {[%clk 0:02:59.9]} 1... c5 {[%clk 0:02:58]} 2. Nf3 $1 {[%clk 0:02:57]} 2... d6?! 3. O-O-O?? (3. d4 cxd4) 3... Nf6 0-1';
  assert.deepEqual(R.firstSans(pgn), ['e4', 'c5', 'Nf3', 'd6', 'O-O-O', 'Nf6']);
  assert.deepEqual(R.firstSans(pgn, 2), ['e4', 'c5']);
  // PGN illisible par la lecture rapide : repli sur chess.js, même résultat.
  const g = game(['e4', 'c5', 'Nf3', 'd6']);
  const odd = { ...g, pgn: g.pgn.replace('1. e4', '1.e4') };
  assert.deepEqual(R.gameOpening(odd, 'moi', openings).sans, ['e4', 'c5', 'Nf3', 'd6']);
  assert.equal(R.replay(['e4', 'e4']), null, 'coup illégal');
});
