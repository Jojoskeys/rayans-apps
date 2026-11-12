'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../src/core/classify');
const { winChance } = require('../../src/core/scoring');

// Trouve le cp joué donnant exactement une perte donnée depuis un meilleur coup à 0 cp.
function cpForLoss(loss) {
  let lo = -5000; let hi = 0;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (50 - winChance(mid) > loss) lo = mid; else hi = mid; }
  return hi;
}
const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function ply(loss, extra = {}) {
  return { uci: 'a2a3', fenBefore: FEN, legalCount: 20, best: { uci: 'e2e4', score: { cp: 0 }, pv: ['e2e4'] }, second: { uci: 'd2d4', score: { cp: -5 }, pv: ['d2d4'] }, played: { score: { cp: cpForLoss(loss) }, pv: ['a2a3'] }, ...extra };
}

test('seuils ordinaires et valeurs aux limites (bornes incluses)', () => {
  const t = C.thresholdsFor(null);
  assert.equal(C.ordinaryCategory(0, t), 'excellent');
  assert.equal(C.ordinaryCategory(2.5, t), 'excellent');
  assert.equal(C.ordinaryCategory(2.5000001, t), 'bon');
  assert.equal(C.ordinaryCategory(6, t), 'bon');
  assert.equal(C.ordinaryCategory(6.0000001, t), 'imprecision');
  assert.equal(C.ordinaryCategory(12, t), 'imprecision');
  assert.equal(C.ordinaryCategory(12.0000001, t), 'erreur');
  assert.equal(C.ordinaryCategory(22, t), 'erreur');
  assert.equal(C.ordinaryCategory(22.0000001, t), 'gaffe');
});

test('classement complet aux limites', () => {
  assert.equal(C.classifyPly(ply(2.49)).category, 'excellent');
  assert.equal(C.classifyPly(ply(2.51)).category, 'bon');
  assert.equal(C.classifyPly(ply(5.99)).category, 'bon');
  assert.equal(C.classifyPly(ply(6.01)).category, 'imprecision');
  assert.equal(C.classifyPly(ply(11.99)).category, 'imprecision');
  assert.equal(C.classifyPly(ply(12.01)).category, 'erreur');
  assert.equal(C.classifyPly(ply(21.99)).category, 'erreur');
  assert.equal(C.classifyPly(ply(22.01)).category, 'gaffe');
});

test('assouplissement sous 1400 Elo', () => {
  assert.equal(C.leniencyFactor(1400), 1);
  assert.equal(C.leniencyFactor(2000), 1);
  assert.equal(C.leniencyFactor(null), 1);
  assert.equal(C.leniencyFactor(undefined), 1);
  assert.ok(Math.abs(C.leniencyFactor(1100) - 1.075) < 1e-9);
  assert.ok(Math.abs(C.leniencyFactor(800) - 1.15) < 1e-9);
  assert.ok(Math.abs(C.leniencyFactor(400) - 1.15) < 1e-9);
  assert.equal(C.leniencyFactor(800, 0), 1, 'assouplissement désactivable');
  assert.ok(Math.abs(C.leniencyFactor(800, 0.3) - 1.3) < 1e-9, 'assouplissement configurable');
  // 2,8 points : « bon » à 1500 Elo, « excellent » à 800 Elo (seuil 2,875).
  assert.equal(C.classifyPly(ply(2.8), { elo: 1500 }).category, 'bon');
  assert.equal(C.classifyPly(ply(2.8), { elo: 800 }).category, 'excellent');
  assert.equal(C.classifyPly(ply(2.876), { elo: 800 }).category, 'bon');
  assert.equal(C.classifyPly(ply(25), { elo: 800 }).category, 'erreur', '25 ≤ 22 × 1,15 = 25,3');
});

test('meilleur réservé au coup du moteur', () => {
  const p = ply(0); p.uci = 'e2e4'; p.played = { score: { cp: 0 }, pv: ['e2e4'] };
  assert.equal(C.classifyPly(p).category, 'meilleur');
  const q = ply(0); q.played = { score: { cp: 0 }, pv: ['a2a3'] }; // même score, autre coup
  assert.equal(C.classifyPly(q).category, 'excellent');
});

test('théorie prioritaire si le coup est répertorié et sans perte notable', () => {
  assert.equal(C.classifyPly({ ...ply(1), book: true }).category, 'theorie');
  assert.equal(C.classifyPly({ ...ply(15), book: true }).category, 'erreur', 'une erreur reste une erreur même répertoriée');
});

test('très bon : seul coup qui préserve l’avantage', () => {
  const p = { uci: 'e2e4', fenBefore: FEN, legalCount: 20, best: { uci: 'e2e4', score: { cp: 300 }, pv: ['e2e4'] }, second: { uci: 'd2d4', score: { cp: -50 }, pv: ['d2d4'] }, played: { score: { cp: 300 }, pv: ['e2e4'] } };
  assert.equal(C.classifyPly(p).category, 'tres_bon');
  p.second.score = { cp: 250 };
  assert.equal(C.classifyPly(p).category, 'meilleur');
  p.second.score = { cp: -50 }; p.legalCount = 1;
  assert.equal(C.classifyPly(p).category, 'meilleur', 'coup forcé : pas « très bon »');
});

test('occasion manquée : mat laissé passer, avantage décisif perdu', () => {
  const base = { uci: 'a2a3', fenBefore: FEN, legalCount: 20, second: null };
  const mate = C.classifyPly({ ...base, best: { uci: 'e2e4', score: { mate: 3 }, pv: ['e2e4'] }, played: { score: { cp: 350 }, pv: ['a2a3'] } });
  assert.equal(mate.category, 'occasion_manquee');
  const dec = C.classifyPly({ ...base, best: { uci: 'e2e4', score: { cp: 700 }, pv: ['e2e4'] }, played: { score: { cp: 80 }, pv: ['a2a3'] } });
  assert.equal(dec.category, 'occasion_manquee');
  const lost = C.classifyPly({ ...base, best: { uci: 'e2e4', score: { cp: 700 }, pv: ['e2e4'] }, played: { score: { cp: -500 }, pv: ['a2a3'] } });
  assert.equal(lost.category, 'gaffe', 'si la position devient perdante : gaffe ordinaire');
  const stillMate = C.classifyPly({ ...base, best: { uci: 'e2e4', score: { mate: 2 }, pv: ['e2e4'] }, played: { score: { mate: 4 }, pv: ['a2a3'] } });
  assert.equal(stillMate.category, 'excellent', 'un mat plus long reste excellent');
});

test('table de finales : gain laissé passer et seul coup gagnant', () => {
  const fen = '4k3/6KP/8/8/8/8/7p/8 w - - 0 1';
  const tb = { category: 'win', moves: [{ uci: 'g7f6', category: 'win' }, { uci: 'g7g8', category: 'draw' }, { uci: 'h7h8q', category: 'loss' }] };
  const r = C.classifyPly({ uci: 'g7g8', fenBefore: fen, legalCount: 9, tablebase: tb, best: { uci: 'g7f6', score: { cp: 700 }, pv: ['g7f6'] }, second: null, played: { score: { cp: 0 }, pv: ['g7g8'] } });
  assert.equal(r.category, 'occasion_manquee');
  const only = { category: 'draw', moves: [{ uci: 'a1a2', category: 'draw' }, { uci: 'a1b1', category: 'loss' }] };
  const r2 = C.classifyPly({ uci: 'a1a2', fenBefore: fen, legalCount: 2, tablebase: only, best: { uci: 'a1a2', score: { cp: 0 }, pv: ['a1a2'] }, second: { uci: 'a1b1', score: { cp: -20 }, pv: [] }, played: { score: { cp: 0 }, pv: ['a1a2'] } });
  assert.equal(r2.category, 'tres_bon');
});

test('brillant : sacrifice accepté dans la variante et évaluation maintenue', () => {
  // Hikaru – JokerSicilian (Chess.com, 23/10/2026), position avant 12. Fxf7+.
  const fen = 'r2qr1k1/pb1nppbp/2p2np1/1p6/3P4/1B3NNP/PPP1QPP1/R1B2RK1 w - - 2 12';
  const pv = ['b3f7', 'g8f7', 'f3g5', 'f7g8', 'g5e6'];
  const p = { uci: 'b3f7', fenBefore: fen, legalCount: 40, best: { uci: 'b3f7', score: { cp: 450 }, pv }, second: { uci: 'c1f4', score: { cp: 60 }, pv: ['c1f4'] }, played: { score: { cp: 450 }, pv } };
  assert.ok(C.detectSacrifice(fen, pv));
  assert.equal(C.classifyPly(p).category, 'brillant');
  // Même coup, mais l'adversaire ne prend pas dans la variante : preuve insuffisante.
  const p2 = { ...p, played: { score: { cp: 450 }, pv: ['b3f7', 'g8h8'] }, best: { ...p.best, pv: ['b3f7', 'g8h8'] } };
  assert.equal(C.detectSacrifice(fen, p2.played.pv), null);
  assert.notEqual(C.classifyPly(p2).category, 'brillant');
});

test('coup non évalué', () => {
  assert.equal(C.classifyPly({ uci: 'e2e4', fenBefore: FEN }).category, null);
});

test('brillant : un échange en cours n’est pas un sacrifice (régression)', () => {
  const { Chess } = require('chess.js');
  const c = new Chess();
  for (const m of ['e4', 'c6', 'Nc3', 'd5', 'Nf3', 'g6', 'd4', 'Bg7', 'h3']) c.move(m);
  // 5... dxe4 6. Nxe4 Nf6 7. Nxf6+ exf6 8. Bd3 : le cavalier pris est aussitôt repris.
  const pv = ['d5e4', 'c3e4', 'g8f6', 'e4f6', 'e7f6', 'f1d3', 'e8g8', 'e1g1'];
  assert.equal(C.detectSacrifice(c.fen(), pv), null);
  const p = { uci: 'd5e4', fenBefore: c.fen(), legalCount: 30, best: { uci: 'd5e4', score: { cp: 30 }, pv }, second: { uci: 'g8f6', score: { cp: 20 }, pv: ['g8f6'] }, played: { score: { cp: 30 }, pv } };
  assert.equal(C.classifyPly(p).category, 'meilleur');
});
