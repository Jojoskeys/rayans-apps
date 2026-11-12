'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateGame, mergeGames, stableId } = require('../../src/core/games');
const { createImporter, isMonthClosed } = require('../../src/server/importer');
const { createStore } = require('../../src/server/store');

const PGN = (result, moves = '1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#') => `[Event "Live Chess"]\n[Site "Chess.com"]\n[White "A"]\n[Black "B"]\n[Result "${result}"]\n\n${moves} ${result}\n`;
function raw(over = {}) {
  return {
    url: 'https://www.chess.com/game/live/111', uuid: 'u-111', rules: 'chess', time_class: 'blitz', end_time: 1700000000,
    initial_setup: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: PGN('1-0'), white: { username: 'A', rating: 1200, result: 'win' }, black: { username: 'B', rating: 1100, result: 'checkmated' },
    ...over,
  };
}

test('partie standard terminée acceptée', () => {
  const v = validateGame(raw());
  assert.equal(v.ok, true);
  assert.equal(v.game.id, 'u-111');
  assert.equal(v.game.result, '1-0');
  assert.equal(v.game.plyCount, 7);
});

test('exclusion des parties en cours, variantes et résultats indéterminés', () => {
  assert.equal(validateGame(raw({ pgn: PGN('*', '1. e4 e5'), white: { username: 'A', result: 'win' }, black: { username: 'B', result: 'resigned' } })).code, 'ongoing');
  assert.equal(validateGame(raw({ white: { username: 'A' }, black: { username: 'B' } })).code, 'undetermined');
  assert.equal(validateGame(raw({ white: { username: 'A', result: 'win' }, black: { username: 'B', result: 'win' } })).code, 'undetermined');
  assert.equal(validateGame(raw({ rules: 'chess960' })).code, 'variant');
  assert.equal(validateGame(raw({ rules: 'crazyhouse' })).code, 'variant');
  assert.equal(validateGame(raw({ initial_setup: '8/8/8/8/8/8/8/K6k w - - 0 1' })).code, 'setup');
  assert.equal(validateGame(raw({ pgn: undefined })).code, 'ongoing');
});

test('PGN invalide et résultat incohérent écartés', () => {
  assert.equal(validateGame(raw({ pgn: PGN('1-0', '1. e4 e5 2. Ke3 Ke6 3. Qxh8') })).code, 'pgn');
  assert.equal(validateGame(raw({ pgn: PGN('0-1') })).code, 'incoherent', 'PGN 0-1 alors que les Blancs ont gagné');
  // « maté » annoncé alors que la position finale n'est pas un mat.
  assert.equal(validateGame(raw({ pgn: PGN('1-0', '1. e4 e5') })).code, 'incoherent');
  // Abandon : position quelconque acceptée.
  assert.equal(validateGame(raw({ pgn: PGN('1-0', '1. e4 e5'), black: { username: 'B', result: 'resigned' } })).ok, true);
  // Nulle par accord.
  assert.equal(validateGame(raw({ pgn: PGN('1/2-1/2', '1. e4 e5'), white: { username: 'A', result: 'agreed' }, black: { username: 'B', result: 'agreed' } })).ok, true);
  // Pat annoncé mais absent.
  assert.equal(validateGame(raw({ pgn: PGN('1/2-1/2', '1. e4 e5'), white: { username: 'A', result: 'stalemate' }, black: { username: 'B', result: 'stalemate' } })).code, 'incoherent');
});

test('identifiant stable et déduplication', () => {
  assert.equal(stableId({ uuid: 'abc', url: 'x' }), 'abc');
  assert.equal(stableId({ url: 'https://www.chess.com/game/live/42' }), 'url-live-42');
  const idx = {};
  const g = validateGame(raw()).game;
  assert.equal(mergeGames(idx, [g, g]), 1);
  assert.equal(mergeGames(idx, [g]), 0);
  assert.equal(Object.keys(idx).length, 1);
});

test('mois clos : récupéré au moins 2 jours après la fin du mois', () => {
  const u = 'https://api.chess.com/pub/player/x/games/2026/10';
  assert.equal(isMonthClosed(u, Date.UTC(2026, 9, 31)), false);
  assert.equal(isMonthClosed(u, Date.UTC(2026, 10, 2, 23)), false);
  assert.equal(isMonthClosed(u, Date.UTC(2026, 10, 3)), true);
  assert.equal(isMonthClosed('https://api.chess.com/pub/player/x/games/2025/12', Date.UTC(2026, 0, 3)), true);
});

function fakeApi(months, opts = {}) {
  const calls = [];
  let failures = opts.failures || {};
  const fetchImpl = async (url) => {
    calls.push(url);
    if (failures[url] > 0) { failures[url]--; return { ok: false, status: 429, headers: { get: () => null }, json: async () => ({}) }; }
    if (url.endsWith('/games/archives')) return { ok: true, status: 200, json: async () => ({ archives: Object.keys(months) }) };
    if (months[url]) return { ok: true, status: 200, json: async () => ({ games: months[url] }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetchImpl, calls };
}
const waitDone = async (imp) => { for (let i = 0; i < 200; i++) { const s = imp.status(); if (s.status !== 'running') return s; await new Promise((r) => setTimeout(r, 5)); } throw new Error('timeout'); };

test('import : premier import complet, mise à jour des seuls mois ouverts, déduplication, reprise', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-'));
  const store = createStore(dir);
  const base = 'https://api.chess.com/pub/player/joueur/games/';
  const months = {
    [`${base}2026/09`]: [raw({ uuid: 'g1' }), raw({ uuid: 'g2', rules: 'chess960' })],
    [`${base}2026/10`]: [raw({ uuid: 'g3' }), raw({ uuid: 'g3' })],
    [`${base}2026/11`]: [raw({ uuid: 'g4' })],
  };
  let now = Date.UTC(2026, 10, 12);
  const api = fakeApi(months, { failures: { [`${base}2026/10`]: 10 } });
  const imp = createImporter({ store, fetchImpl: api.fetchImpl, retryDelays: [1, 1], now: () => now });
  imp.start('Joueur');
  let st = await waitDone(imp);
  assert.equal(st.status, 'partial', 'limitation persistante sur un mois : import partiel signalé');
  assert.match(st.message, /partiel/);
  assert.equal(Object.keys(store.loadGames('joueur')).length, 1, 'le mois récupéré avant l’échec est conservé');
  // Reprise : la limitation est levée.
  const api2 = fakeApi(months);
  const imp2 = createImporter({ store, fetchImpl: api2.fetchImpl, retryDelays: [1], now: () => now });
  imp2.start('Joueur');
  st = await waitDone(imp2);
  assert.equal(st.status, 'done');
  assert.equal(st.monthsToFetch, 3 - 0, 'novembre (ouvert) + octobre + septembre (récupéré trop tôt) à refaire');
  const games = store.loadGames('joueur');
  assert.deepEqual(Object.keys(games).sort(), ['g1', 'g3', 'g4']);
  assert.equal(st.rejected.variant, 1);
  // Mise à jour 10 jours plus tard : septembre et octobre sont clos (récupérés après le 2 novembre), seul novembre est refait.
  now = Date.UTC(2026, 10, 22);
  months[`${base}2026/11`].push(raw({ uuid: 'g5' }), raw({ uuid: 'g4' }));
  const api3 = fakeApi(months);
  const imp3 = createImporter({ store, fetchImpl: api3.fetchImpl, retryDelays: [1], now: () => now });
  imp3.start('joueur');
  st = await waitDone(imp3);
  assert.equal(st.monthsToFetch, 1);
  assert.equal(st.added, 1, 'g4 déjà connu, seul g5 est ajouté');
  assert.deepEqual(api3.calls.filter((u) => !u.endsWith('archives')), [`${base}2026/11`]);
  assert.equal(Object.keys(store.loadGames('joueur')).length, 4);
});

test('import : pseudo inconnu et pseudo invalide', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-'));
  const store = createStore(dir);
  const imp = createImporter({ store, fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }), retryDelays: [] });
  imp.start('inconnu');
  const st = await waitDone(imp);
  assert.equal(st.status, 'error');
  assert.match(st.message, /introuvable/);
  assert.throws(() => imp.start('../etc'), /Pseudo invalide/);
});
