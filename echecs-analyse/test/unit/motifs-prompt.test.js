'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { explainMove, detectFork, hangingPieces } = require('../../src/core/motifs');
const { classifyPly } = require('../../src/core/classify');
const { buildClaudePrompt } = require('../../src/core/prompt');
const { Chess, normalizeCastlingUci } = require('../../src/core/chessutil');

test('pièce en prise reconnue en rejouant la variante', () => {
  // Après 1. e4 e5 2. Cf3 Cc6, 3. Cg5?? laisse le cavalier à la dame noire (Dxg5).
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  const ply = { uci: 'd1e2', san: 'Qe2', fenBefore: fen, legalCount: 30, best: { uci: 'f1c4', score: { cp: 40 }, pv: ['f1c4', 'f8c5'] }, second: null, played: { score: { cp: 30 }, pv: ['d1e2'] } };
  const hp = { ...ply, uci: 'f3g5', san: 'Ng5', played: { score: { cp: -250 }, pv: ['f3g5', 'd8g5'] } };
  const cls = classifyPly(hp);
  const ex = explainMove(hp, cls);
  assert.ok(ex.motifs.includes('piece_en_prise'), JSON.stringify(ex));
  assert.match(ex.sentences.join(' '), /C?g5 laisse le cavalier en g5 en prise : l’adversaire répond Dxg5/);
});

test('mat manqué : variante rejouée jusqu’au mat', () => {
  const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
  const ply = { uci: 'h2h3', san: 'h3', fenBefore: fen, legalCount: 15, best: { uci: 'a1a8', score: { mate: 1 }, pv: ['a1a8'] }, second: null, played: { score: { cp: 400 }, pv: ['h2h3', 'h7h6'] } };
  const cls = classifyPly(ply);
  assert.equal(cls.category, 'occasion_manquee');
  const ex = explainMove(ply, cls);
  assert.ok(ex.motifs.includes('mat_manque'));
  assert.match(ex.sentences.join(' '), /mat forcé en 1 : 1\. Ta8#/);
});

test('fourchette détectée', () => {
  const c = new Chess('4k3/8/8/1r3q2/8/3N4/8/4K3 w - - 0 1');
  c.move('Ne5');
  // le cavalier en e5 n'attaque pas b5/f5 ; on prend Nd3-e5? → on teste un vrai cas : Nc7+ fourchette roi/tour
  const c2 = new Chess('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1');
  c2.move('Nc7+');
  const f = detectFork(c2, 'c7');
  assert.ok(f && f.targets.length === 2, JSON.stringify(f));
  assert.ok(c);
});

test('pièces en prise (géométrie)', () => {
  const c = new Chess('4k3/8/8/3n4/8/8/8/3RK3 b - - 0 1');
  assert.deepEqual(hangingPieces(c, 'b').map((p) => p.square), ['d5']);
});

test('sans motif fiable : explication par l’écart d’évaluation', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const ply = { uci: 'g2g4', san: 'g4', fenBefore: fen, legalCount: 20, best: { uci: 'e2e4', score: { cp: 30 }, pv: ['e2e4', 'e7e5'] }, second: null, played: { score: { cp: -110 }, pv: ['g2g4', 'd7d5'] } };
  const ex = explainMove(ply, classifyPly(ply));
  assert.equal(ex.motifs.length, 0);
  assert.match(ex.sentences[0], /Aucun motif tactique simple/);
  assert.match(ex.sentences[1], /1\. e4 e5/);
});

test('roque au format Lichess cloud (e1h1 → e1g1)', () => {
  const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  assert.equal(normalizeCastlingUci(fen, 'e1h1'), 'e1g1');
  assert.equal(normalizeCastlingUci(fen, 'e1f1'), 'e1f1');
});

test('« Demander à Claude » : contenu complet de la question', () => {
  const text = buildClaudePrompt({
    game: { white: 'A', black: 'B', whiteElo: 1500, blackElo: 1400, date: '2026.10.23', url: 'https://www.chess.com/game/live/1' },
    fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', san: 'f6', uci: 'f7f6', categoryLabel: 'Imprécision', loss: 7.25,
    best: { san: 'e5', uci: 'e7e5', score: { cp: -20 } }, played: { score: { cp: -90 } },
    lines: { best: { text: '1... e5 2. Nf3', score: { cp: -20 } }, second: { text: '1... c5', score: { cp: -30 } }, played: { text: '1... f6 2. d4', score: { cp: -90 } } },
    engineName: 'Stockfish 19', depth: 22,
  });
  for (const s of ['FEN) : rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'Camp au trait : Noirs', 'Coup joué : 1... f6', 'Meilleur coup selon Stockfish : 1... e5', '−0.20', '−0.90', 'Stockfish 19, profondeur 22', 'Variante Stockfish n° 1', 'Variante Stockfish n° 2', 'en français', 'pédagogique']) {
    assert.ok(text.includes(s), `manque : ${s}\n${text}`);
  }
});
