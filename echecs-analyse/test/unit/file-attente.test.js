'use strict';
// File d'attente d'analyses en arrière-plan, avec un faux moteur UCI (aucun calcul réel).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Engine } = require('../../src/server/engine');
const { createAnalyzer } = require('../../src/server/analyzer');
const { createStore } = require('../../src/server/store');
const { createSummaries } = require('../../src/server/summaries');
const { createOpenings } = require('../../src/core/openings');

const FAKE = path.join(__dirname, '..', 'fixtures', 'faux-moteur.js');
const skip = process.platform === 'win32' && 'script shebang';
const PGN = '[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 1-0';

function setup(delay) {
  process.env.FAUX_MOTEUR_DELAI = String(delay);
  delete process.env.FAUX_MOTEUR_PLANTAGES;
  delete process.env.FAUX_MOTEUR_COMPTEUR;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-file-'));
  const store = createStore(dir);
  const games = ['a', 'b', 'c'].map((id, i) => ({
    id, pgn: PGN, plyCount: 8, endTime: 1700000000 + i, timeClass: 'blitz', rated: true, result: '1-0',
    white: { username: 'Moi', rating: 1500 }, black: { username: 'Autre', rating: 1500 },
  }));
  store.saveMonth('moi', '2023-11', games);
  const engine = new Engine(FAKE, { threads: 1, hash: 16 });
  const settings = { depth: 22, multipv: 2, leniency: 0.15, useCloud: false, useTablebase: false };
  const mk = () => createAnalyzer({ store, engineRef: () => engine, external: null, getSettings: () => settings });
  return { dir, store, engine, mk, settings };
}

const waitFor = async (cond, ms = 10000) => {
  const t0 = Date.now();
  while (!cond()) { if (Date.now() - t0 > ms) throw new Error('délai dépassé'); await new Promise((r) => setTimeout(r, 10)); }
};

test('file d’attente : lot traité dans l’ordre, profondeur conservée, enregistré sur disque', { skip, timeout: 30000 }, async (t) => {
  const { store, engine, mk } = setup(0);
  t.after(() => engine.stop());
  const an = mk();
  const r = an.enqueue(['a', 'b', 'a', 'c'], 16);
  assert.equal(r.added, 3, 'doublon ignoré');
  await an.idle();
  for (const id of ['a', 'b', 'c']) {
    const a = store.loadAnalysis(id);
    assert.equal(a.complete, true);
    assert.equal(a.settings.depth, 16);
    assert.equal(a.plies.length, 8);
  }
  const st = an.status();
  assert.equal(st.status, 'done');
  assert.equal(st.queue.length, 0);
  assert.equal(st.queue.processed, 3);
  assert.ok(st.queue.msPerPly['16'] >= 0);
  assert.deepEqual(store.loadQueue().items, []);
  assert.equal(store.listAnalyses().a.depth, 16);

  // Résumés du bilan : calculés une fois puis relus depuis le cache.
  const openings = createOpenings(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'openings.json'), 'utf8')));
  const sm = createSummaries({ store, openings, getSettings: () => ({ leniency: 0.15 }) });
  const s1 = await sm.forPlayer('moi');
  assert.equal(s1.length, 3);
  assert.equal(s1[0].depth, 16);
  assert.ok(store.loadCache('bilan', null).entries.a);
  const sm2 = createSummaries({ store, openings, getSettings: () => ({ leniency: 0.15 }) });
  assert.deepEqual(await sm2.forPlayer('moi'), s1);
});

test('file d’attente : priorité, pause, reprise après redémarrage, retrait, vidage', { skip, timeout: 30000 }, async (t) => {
  const { store, engine, mk } = setup(40);
  t.after(() => engine.stop());
  let an = mk();
  an.enqueue(['a', 'b'], 22);
  await waitFor(() => an.status().status === 'running' && an.status().done >= 1);
  assert.equal(an.status().gameId, 'a');
  // « Analyser » sur c : passe en tête et interrompt a, qui reste dans la file.
  await an.start('c', 22);
  await waitFor(() => an.status().gameId === 'c' && an.status().status === 'running');
  assert.deepEqual(an.status().queue.items.map((i) => i.gameId), ['c', 'a', 'b']);
  const partialA = store.loadAnalysis('a').plies.length;
  assert.ok(partialA >= 1 && partialA < 8, 'avancement de a conservé');
  // Pause : rien ne tourne, la file est gardée.
  const paused = await an.pause();
  assert.equal(paused.status, 'paused');
  assert.equal(paused.queue.length, 3);
  // Redémarrage : la file enregistrée revient en pause.
  await an.close();
  an = mk();
  const st = an.status();
  assert.equal(st.status, 'paused');
  assert.deepEqual(st.queue.items.map((i) => i.gameId), ['c', 'a', 'b']);
  assert.match(st.queue.message, /redémarrage/);
  // Retrait de b, reprise : c puis a terminés, a repris là où il s'était arrêté.
  await an.cancelGame('b');
  an.resume();
  await an.idle();
  assert.equal(store.loadAnalysis('c').complete, true);
  assert.equal(store.loadAnalysis('a').complete, true);
  assert.equal(store.loadAnalysis('b'), null);
  // Vidage pendant un calcul.
  an.enqueue(['b'], 18);
  await waitFor(() => an.status().status === 'running');
  const cleared = await an.clear();
  assert.equal(cleared.queue.length, 0);
  assert.notEqual(cleared.status, 'running');
});
