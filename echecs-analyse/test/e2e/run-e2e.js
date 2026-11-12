'use strict';
/**
 * Test de bout en bout sur une vraie partie publique Chess.com terminée, dans l'application Electron réelle :
 * import par l'API, analyse native à profondeur 22, classement, précisions, navigation du résumé,
 * « Demander à Claude », coup exploratoire, retour à la partie, réouverture hors ligne après redémarrage.
 * Usage (Linux sans écran) : xvfb-run -a node test/e2e/run-e2e.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert/strict');
const { _electron: electron } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const PSEUDO = process.env.E2E_PSEUDO || 'JokerSicilian';
const GAME_URL = process.env.E2E_GAME || 'https://www.chess.com/game/live/185803756742';
const OUT = path.join(__dirname, 'resultats');
fs.mkdirSync(OUT, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyse-echecs-e2e-'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = { platform: `${process.platform}-${process.arch}`, executable: process.env.E2E_EXECUTABLE || 'electron (développement)', pseudo: PSEUDO, gameUrl: GAME_URL, dataDir, steps: [] };
const stepOk = (name, details) => { results.steps.push({ name, ok: true, details }); log('✔', name, details ? JSON.stringify(details) : ''); };

async function launch(extraArgs = []) {
  const app = await electron.launch({
    executablePath: process.env.E2E_EXECUTABLE || require(path.join(ROOT, 'node_modules', 'electron')),
    args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), ...extraArgs, ...(process.env.E2E_EXECUTABLE ? [] : [ROOT])],
    env: { ...process.env, ANALYSE_ECHECS_DATA: dataDir },
  });
  const page = await app.firstWindow();
  global.__page = page;
  await page.waitForSelector('#engine-badge:not(:has-text("démarrage"))', { timeout: 60000 });
  return { app, page };
}
const apiIn = (page, p) => page.evaluate(async (pp) => {
  const r = await fetch(pp, { headers: { 'X-Jeton': sessionStorage.getItem('jeton') } });
  return r.json();
}, p);

async function main() {
  let { app, page } = await launch();
  const badge = await page.textContent('#engine-badge');
  assert.match(badge, /Stockfish 19/);
  stepOk('lancement de l’application et du moteur', { badge });

  // 1. Import par l'API Chess.com
  await page.fill('#pseudo', PSEUDO);
  await page.click('#btn-import');
  const t0 = Date.now();
  let st;
  for (;;) {
    st = await apiIn(page, '/api/import');
    if (st.status !== 'running') break;
    if (Date.now() - t0 > 15 * 60 * 1000) throw new Error('import trop long');
    await page.waitForTimeout(1000);
  }
  assert.equal(st.status, 'done', `import : ${st.status} ${st.message}`);
  await page.waitForSelector('#import-status.ok');
  stepOk('import complet par l’API', { mois: st.monthsTotal, parties: st.totalGames, ecartees: st.rejectedTotal, motifs: st.rejected, duree_s: Math.round((Date.now() - t0) / 1000) });

  const games = await apiIn(page, `/api/parties?joueur=${PSEUDO.toLowerCase()}`);
  const game = games.find((g) => g.url === GAME_URL);
  assert.ok(game, 'partie de test trouvée parmi les parties importées');
  const ids = new Set(games.map((g) => g.id));
  assert.equal(ids.size, games.length, 'aucun doublon');
  // Mise à jour immédiate : seuls les mois ouverts sont récupérés, sans doublon.
  await page.click('#btn-import');
  for (;;) { st = await apiIn(page, '/api/import'); if (st.status !== 'running') break; await page.waitForTimeout(500); }
  const games2 = await apiIn(page, `/api/parties?joueur=${PSEUDO.toLowerCase()}`);
  assert.equal(games2.length, games.length);
  stepOk('mise à jour : déduplication', { moisRecuperes: st.monthsToFetch, moisDejaAJour: st.monthsSkipped, ajoutees: st.added, total: games2.length });

  // 2. Analyse de la partie
  await page.fill('#game-filter', '');
  await page.click(`#games li[data-id="${game.id}"]`);
  await page.waitForSelector('#analysis-card:not([hidden])');
  await page.click('#btn-analyse');
  const t1 = Date.now();
  for (;;) {
    const a = await apiIn(page, '/api/analyse');
    if (a.status !== 'running' && a.gameId === game.id) { assert.equal(a.status, 'done', JSON.stringify(a)); break; }
    if (Date.now() - t1 > 30 * 60 * 1000) throw new Error('analyse trop longue');
    await page.waitForTimeout(1500);
  }
  await page.waitForSelector('#analysis-status.ok', { timeout: 20000 });
  const { report } = await apiIn(page, `/api/partie/${game.id}`);
  assert.equal(report.analysis.complete, true);
  assert.equal(report.analysis.engine.name, 'Stockfish 19');
  for (const p of report.plies) {
    assert.ok(p.analyzed, `demi-coup ${p.ply} analysé`);
    assert.equal(p.best.depth, 22, `profondeur meilleur coup ${p.ply}`);
    assert.equal(p.played.depth, 22, `profondeur coup joué ${p.ply}`);
  }
  const sm = report.plies.filter((p) => p.played.source.includes('searchmoves')).length;
  stepOk('analyse native profondeur 22', { demiCoups: report.plies.length, duree_s: Math.round((Date.now() - t1) / 1000), moteur: report.analysis.engine, rechercheSearchmoves: sm, ouverture: report.opening });
  await page.screenshot({ path: path.join(OUT, '1-analyse.png') });

  // 3. Classement d'un coup et précisions
  const cls = report.plies.map((p) => ({ ply: p.ply, san: p.san, cat: p.classification && p.classification.category, perte: p.classification && +p.classification.loss.toFixed(2), best: p.best.uci, joue: p.uci, src: p.played.source, cloud: !!p.cloud }));
  fs.writeFileSync(path.join(OUT, 'classement.json'), JSON.stringify(cls, null, 2));
  const last = report.plies[report.plies.length - 1];
  assert.ok(last.classification, 'dernier coup classé');
  const W = report.players.w; const B = report.players.b;
  assert.ok(W.accuracy > 0 && W.accuracy <= 100 && B.accuracy > 0 && B.accuracy <= 100);
  assert.equal(W.evaluatedMoves + B.evaluatedMoves, report.plies.length);
  const accTxt = await page.textContent('#summary [data-acc="w"]');
  assert.match(accTxt, /%/);
  stepOk('classement et précisions', {
    dernierCoup: { san: last.san, categorie: last.classification.label, perte: +last.classification.loss.toFixed(2), raisons: last.classification.reasons },
    precisionBlancs: +W.accuracy.toFixed(2), coupsBlancs: W.evaluatedMoves, eloEstimeBlancs: W.estimatedElo,
    precisionNoirs: +B.accuracy.toFixed(2), coupsNoirs: B.evaluatedMoves, eloEstimeNoirs: B.estimatedElo,
  });

  // 4. Navigation du résumé : clic sur une catégorie → premier coup, puis « Suivante »
  // a) catégorie la plus grave présente (ex. « Gaffe · 1 ») ; b) catégorie avec au moins 2 coups pour « Suivante ».
  let grave = null; let multi = null;
  for (const k of ['gaffe', 'erreur', 'occasion_manquee', 'imprecision']) for (const c of ['b', 'w']) {
    if (!grave && report.players[c].counts[k].length) grave = { c, k, list: report.players[c].counts[k] };
  }
  for (const c of ['w', 'b']) for (const k of ['meilleur', 'excellent', 'bon', 'theorie', 'imprecision', 'erreur', 'gaffe']) {
    if (!multi && report.players[c].counts[k].length >= 2) multi = { c, k, list: report.players[c].counts[k] };
  }
  assert.ok(grave && multi);
  await page.click(`#summary button[data-color="${grave.c}"][data-cat="${grave.k}"]`);
  const cur1 = await page.getAttribute('.mv.current', 'data-ply');
  assert.equal(+cur1, grave.list[0]);
  const btnLabel = await page.getAttribute(`#summary button[data-color="${grave.c}"][data-cat="${grave.k}"]`, 'aria-label');
  await page.click(`#summary button[data-color="${multi.c}"][data-cat="${multi.k}"]`);
  const seen = [+(await page.getAttribute('.mv.current', 'data-ply'))];
  for (let i = 1; i < multi.list.length; i++) { await page.click('#cat-next'); seen.push(+(await page.getAttribute('.mv.current', 'data-ply'))); }
  assert.deepEqual(seen, multi.list);
  const nextDisabled = await page.isDisabled('#cat-next');
  assert.ok(nextDisabled);
  const multiLabel = await page.getAttribute(`#summary button[data-color="${multi.c}"][data-cat="${multi.k}"]`, 'aria-label');
  stepOk('navigation du résumé', { bouton: btnLabel, premier: +cur1, parcours: { bouton: multiLabel, camp: multi.c, coupsVisites: seen } });

  // Coup raté pour « Demander à Claude » : le pire coup des Noirs (ou des Blancs).
  const worst = report.plies.filter((p) => !p.classification.category.match(/meilleur|theorie|brillant|tres_bon/)).sort((a, b) => b.classification.loss - a.classification.loss)[0];
  await page.click(`.mv[data-ply="${worst.ply}"]`);
  await page.waitForSelector('#btn-claude');
  const detailText = await page.textContent('#detail');
  await page.click('#btn-claude');
  await page.waitForSelector('#toast:not([hidden])');
  const toastTxt = await page.textContent('#toast');
  const clip = await app.evaluate(({ clipboard }) => clipboard.readText());
  fs.writeFileSync(path.join(OUT, 'question-claude.txt'), clip);
  const { frSan } = require('../../src/core/chessutil');
  for (const s of [worst.fenBefore, worst.color === 'w' ? 'Camp au trait : Blancs' : 'Camp au trait : Noirs', `Coup joué : `, frSan(worst.san), `UCI ${worst.uci}`, `UCI ${worst.best.uci}`, 'Meilleur coup selon Stockfish', 'profondeur 22', 'Variante Stockfish n° 1', 'Stockfish 19', 'en français']) {
    assert.ok(clip.includes(s), `presse-papiers : manque « ${s} »`);
  }
  await page.screenshot({ path: path.join(OUT, '2-coup-rate.png') });
  stepOk('Demander à Claude (presse-papiers)', { coup: `${worst.ply} ${worst.san}`, categorie: worst.classification.label, confirmation: toastTxt, longueur: clip.length, explication: detailText.match(/(Après|Aucun|.+ laisse|.+ menait|Dans la variante)[^]*?\./) ? 'présente' : 'voir capture' });

  // 5. Coup exploratoire joué sur l'échiquier
  const basePly = worst.ply - 1; // position avant le coup raté
  await page.click(`.mv[data-ply="${worst.ply}"]`);
  await page.keyboard.press('ArrowLeft');
  const curBase = await page.$('.mv.current');
  assert.equal(curBase ? +(await curBase.getAttribute('data-ply')) : 0, basePly);
  const alt = worst.best.uci; // on joue le meilleur coup à la place du coup raté
  const box = await page.locator('#board').boundingBox();
  const orient = await page.evaluate(() => document.querySelector('.cg-wrap').classList.contains('orientation-black') ? 'black' : 'white');
  const center = (sq) => {
    const f = sq.charCodeAt(0) - 97; const r = +sq[1] - 1;
    const x = orient === 'white' ? f : 7 - f; const y = orient === 'white' ? 7 - r : r;
    return { x: box.x + (x + 0.5) * box.width / 8, y: box.y + (y + 0.5) * box.height / 8 };
  };
  const a = center(alt.slice(0, 2)); const b = center(alt.slice(2, 4));
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
  if (alt.length > 4) await page.click(`#promo button[data-p="${alt[4]}"]`);
  await page.waitForSelector('#explore-banner:not([hidden])');
  await page.waitForSelector('#detail .badge', { timeout: 120000 });
  const explTxt = await page.textContent('#detail h3');
  const banner = await page.textContent('#explore-text');
  await page.screenshot({ path: path.join(OUT, '3-exploration.png') });
  assert.match(explTxt, /Meilleur|Très bon|Brillant|Excellent/);
  // Second coup exploratoire, ni le meilleur ni celui de la partie : il doit passer par searchmoves.
  const { Chess } = require('chess.js');
  const other = new Chess(worst.fenBefore).moves({ verbose: true }).map((m) => m.lan).find((u) => u !== worst.best.uci && u !== worst.uci && (!worst.second || u !== worst.second.uci));
  const evalAlt = await page.evaluate(async ({ fen, uci }) => {
    const c = await fetch('/api/explorer', { method: 'POST', headers: { 'X-Jeton': sessionStorage.getItem('jeton'), 'Content-Type': 'application/json' }, body: JSON.stringify({ fen, uci }) });
    return c.json();
  }, { fen: worst.fenBefore, uci: other });
  assert.equal(evalAlt.played.depth, 22);
  assert.ok(evalAlt.classification && evalAlt.classification.label);
  await page.click('#btn-back-game');
  await page.waitForSelector('#explore-banner[hidden]', { state: 'attached' });
  const back = await page.$('.mv.current');
  assert.equal(back ? +(await back.getAttribute('data-ply')) : 0, basePly);
  stepOk('coup exploratoire noté par Stockfish puis retour à la partie', { depuis: basePly, coup: alt, titre: explTxt.trim().replace(/\s+/g, ' '), bandeau: banner.trim(), autreCoup: { uci: other, san: evalAlt.san, categorie: evalAlt.classification.label, perte: +evalAlt.classification.loss.toFixed(2), source: evalAlt.played.source, profondeur: evalAlt.played.depth } });

  // 6. Redémarrage hors ligne : réouverture sans recalcul ni connexion
  const file = fs.readdirSync(path.join(dataDir, 'analyses'))[0];
  const mtime = fs.statSync(path.join(dataDir, 'analyses', file)).mtimeMs;
  await app.close();
  ({ app, page } = await launch(['--proxy-server=127.0.0.1:9'])); // tout accès réseau échoue
  await page.click(`#games li[data-id="${game.id}"]`);
  const t2 = Date.now();
  await page.waitForSelector('#analysis-status.ok', { timeout: 10000 });
  const reopenMs = Date.now() - t2;
  const { report: r2 } = await apiIn(page, `/api/partie/${game.id}`);
  const a2 = await apiIn(page, '/api/analyse');
  assert.equal(a2.status, 'idle', 'aucune analyse relancée');
  assert.equal(r2.players.w.accuracy, W.accuracy);
  assert.equal(r2.players.b.accuracy, B.accuracy);
  assert.equal(fs.statSync(path.join(dataDir, 'analyses', file)).mtimeMs, mtime, 'fichier d’analyse inchangé');
  await page.screenshot({ path: path.join(OUT, '4-reouverture.png') });
  stepOk('réouverture après redémarrage, hors ligne, sans recalcul', { reouverture_ms: reopenMs, precisions: [r2.players.w.accuracy, r2.players.b.accuracy] });

  // 7. Lot en arrière-plan (2 parties blitz, profondeur 12), puis vue Bilan et Elo de performance.
  await page.selectOption('#lot-n', '5');
  await page.evaluate(() => { const s = document.getElementById('lot-n'); s.add(new Option('2', '2')); s.value = '2'; });
  await page.selectOption('#lot-cadence', 'blitz');
  await page.selectOption('#lot-depth', '12');
  await page.waitForTimeout(500);
  await page.click('#btn-lot');
  await page.waitForSelector('#games li:has-text("en file")', { timeout: 10000 });
  const t3 = Date.now();
  let q;
  for (;;) {
    q = await apiIn(page, '/api/analyse');
    if (q.status !== 'running' && q.queue.length === 0) break;
    if (Date.now() - t3 > 15 * 60 * 1000) throw new Error('lot trop long');
    await page.waitForTimeout(1000);
  }
  assert.equal(q.status, 'done', JSON.stringify(q));
  assert.equal(q.queue.processed, 2);
  await page.waitForSelector('#queue-status.ok');
  const lotDepths = (await apiIn(page, `/api/parties?joueur=${PSEUDO.toLowerCase()}`)).filter((g) => g.analysis && g.analysis.depth === 12 && g.analysis.complete);
  assert.equal(lotDepths.length, 2);
  await page.click('#tab-bilan');
  await page.waitForSelector('#bilan-card .tiles', { timeout: 120000 });
  const tiles = await page.textContent('#bilan-card .tiles');
  assert.match(tiles, /parties analysées/);
  const perfTxt = await page.textContent('#perf-card');
  assert.match(perfTxt, /Blitz/);
  assert.match(perfTxt, /IC 95 %/);
  await page.screenshot({ path: path.join(OUT, '5-bilan.png') });
  const bilan = await apiIn(page, `/api/bilan?joueur=${PSEUDO.toLowerCase()}`);
  assert.ok(bilan.summaries.length >= 3, 'partie de test + lot');
  stepOk('analyse en lot (profondeur 12) et bilan', { duree_s: Math.round((Date.now() - t3) / 1000), vitesse_ms_par_demi_coup: q.queue.msPerPly, partiesBilan: bilan.summaries.length, tuiles: tiles.replace(/\s+/g, ' ').trim() });
  await app.close();
  results.ok = true;
}

main().then(() => {
  fs.writeFileSync(path.join(OUT, 'resultats.json'), JSON.stringify(results, null, 2));
  log('E2E réussi');
  process.exit(0);
}, async (e) => {
  try { if (global.__page) await global.__page.screenshot({ path: path.join(OUT, 'echec.png') }); } catch (err) { /* */ }
  results.ok = false; results.error = e.stack;
  fs.writeFileSync(path.join(OUT, 'resultats.json'), JSON.stringify(results, null, 2));
  console.error(e);
  process.exit(1);
});
