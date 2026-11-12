'use strict';
/**
 * Petit serveur HTTP local, lié exclusivement à 127.0.0.1 sur un port aléatoire.
 * Protections contre les requêtes de sites tiers :
 *  - en-tête Host obligatoirement 127.0.0.1:<port> (bloque le « DNS rebinding») ;
 *  - jeton secret aléatoire exigé dans l'en-tête X-Jeton pour toute route /api (un site tiers ne peut ni
 *    le connaître ni envoyer cet en-tête sans pré-vérification CORS, que le serveur refuse toujours) ;
 *  - Origin, si présent, doit être celui de l'application ; Sec-Fetch-Site « cross-site » refusé ;
 *  - aucun en-tête CORS n'est jamais renvoyé ; corps JSON limités à 64 Ko.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createStore } = require('./store');
const { Engine } = require('./engine');
const { createExternal } = require('./external');
const { createImporter } = require('./importer');
const { createAnalyzer, DEFAULT_SETTINGS, DEPTHS } = require('./analyzer');
const { createSummaries } = require('./summaries');
const { createOpenings } = require('../core/openings');
const { buildReport } = require('../core/report');
const { colorOf } = require('../core/bilan');
const { exerciseId, quickCheck, acceptedByClassification, nextState } = require('../core/exercises');
const { Chess } = require('../core/chessutil');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

function startServer(opts) {
  const {
    dataDir, stockfishPath, uiDir, openingsFile, fetchImpl = globalThis.fetch, appVersion = '1.0.0',
    engineOptions = {}, port = 0, stockfishRelease = null,
  } = opts;
  const store = createStore(dataDir);
  const openings = createOpenings(JSON.parse(fs.readFileSync(openingsFile, 'utf8')));
  const external = createExternal(fetchImpl);
  const engine = new Engine(stockfishPath, engineOptions);
  const getSettings = () => ({ ...DEFAULT_SETTINGS, ...store.loadSettings() });
  const importer = createImporter({ store, fetchImpl });
  const analyzer = createAnalyzer({ store, engineRef: () => engine, external, getSettings, openings });
  const summaries = createSummaries({ store, openings, getSettings });
  const token = crypto.randomBytes(24).toString('hex');
  let actualPort = null;

  function send(res, code, body, headers = {}) {
    const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(code, {
      'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      ...headers,
    });
    res.end(data);
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > 65536) { reject(Object.assign(new Error('Requête trop volumineuse'), { code: 413 })); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (!chunks.length) return resolve({});
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(Object.assign(new Error('JSON invalide'), { code: 400 })); }
      });
      req.on('error', reject);
    });
  }

  function tokenOk(req) {
    const t = req.headers['x-jeton'];
    if (typeof t !== 'string' || t.length !== token.length) return false;
    return crypto.timingSafeEqual(Buffer.from(t), Buffer.from(token));
  }

  /** Exercices du joueur : ses erreurs dans les parties analysées complètement (résumés en cache). */
  async function exerciseItems(username) {
    const out = [];
    for (const sm of await summaries.forPlayer(username)) {
      const c = colorOf(sm, username);
      if (!c || !sm.mistakes) continue;
      const me = c === 'w' ? sm.white : sm.black;
      const opp = c === 'w' ? sm.black : sm.white;
      for (const mk of sm.mistakes[c]) {
        out.push({ ...mk, id: exerciseId(sm.id, mk.ply), gameId: sm.id, endTime: sm.endTime, timeClass: sm.timeClass, url: sm.url, elo: me.rating, opponent: opp, depth: sm.depth });
      }
    }
    return out;
  }

  function gameList(username) {
    const games = Object.values(store.loadGames(username));
    const analyzed = store.listAnalyses();
    return games.sort((a, b) => (b.endTime || 0) - (a.endTime || 0)).map((g) => ({
      id: g.id, url: g.url, endTime: g.endTime, date: g.date, timeClass: g.timeClass, timeControl: g.timeControl, rated: g.rated,
      result: g.result, white: g.white, black: g.black, plyCount: g.plyCount, termination: g.termination,
      analysis: analyzed[g.id] || null,
    }));
  }

  async function api(req, res, url) {
    const p = url.pathname;
    const m = req.method;
    if (m === 'GET' && p === '/api/etat') {
      let engineInfo = { name: engine.name, available: true, threads: engine.threads, hash: engine.hash };
      try { await engine.start(); engineInfo.name = engine.name; } catch (e) { engineInfo = { available: false, error: e.message }; }
      return send(res, 200, { appVersion, engine: engineInfo, stockfishRelease, settings: getSettings(), depths: DEPTHS, dataDir, players: store.listPlayers() });
    }
    if (m === 'GET' && p === '/api/reglages') return send(res, 200, getSettings());
    if (m === 'POST' && p === '/api/reglages') {
      const b = await readBody(req);
      const cur = store.loadSettings();
      if (typeof b.leniency === 'number' && b.leniency >= 0 && b.leniency <= 0.5) cur.leniency = b.leniency;
      if (typeof b.useCloud === 'boolean') cur.useCloud = b.useCloud;
      if (typeof b.useTablebase === 'boolean') cur.useTablebase = b.useTablebase;
      if (DEPTHS.includes(b.depth)) cur.depth = b.depth;
      store.saveSettings(cur);
      return send(res, 200, getSettings());
    }
    if (m === 'GET' && p === '/api/joueurs') return send(res, 200, store.listPlayers());
    if (m === 'POST' && p === '/api/import') {
      const b = await readBody(req);
      try { return send(res, 200, importer.start(String(b.pseudo || '').trim())); } catch (e) { return send(res, 400, { error: e.message }); }
    }
    if (m === 'GET' && p === '/api/import') return send(res, 200, importer.status());
    if (m === 'POST' && p === '/api/import/annuler') { importer.cancel(); return send(res, 200, importer.status()); }
    if (m === 'GET' && p === '/api/parties') {
      const u = String(url.searchParams.get('joueur') || '');
      return send(res, 200, gameList(u));
    }
    let mm = p.match(/^\/api\/partie\/([A-Za-z0-9_.-]+)$/);
    if (m === 'GET' && mm) {
      const g = store.findGame(mm[1]);
      if (!g) return send(res, 404, { error: 'Partie introuvable' });
      const report = buildReport(g, store.loadAnalysis(g.id), openings, getSettings());
      return send(res, 200, { game: g, report });
    }
    mm = p.match(/^\/api\/analyse\/([A-Za-z0-9_.-]+)\/lancer$/);
    if (m === 'POST' && mm) {
      if (!store.findGame(mm[1])) return send(res, 404, { error: 'Partie introuvable' });
      const b = await readBody(req);
      return send(res, 200, await analyzer.start(mm[1], typeof b.depth === 'number' ? b.depth : undefined));
    }
    if (m === 'POST' && p === '/api/analyse/annuler') {
      const b = await readBody(req);
      if (typeof b.gameId === 'string') return send(res, 200, await analyzer.cancelGame(b.gameId));
      return send(res, 200, await analyzer.pause());
    }
    if (m === 'POST' && p === '/api/analyse/pause') return send(res, 200, await analyzer.pause());
    if (m === 'POST' && p === '/api/analyse/reprendre') return send(res, 200, analyzer.resume());
    if (m === 'POST' && p === '/api/analyse/vider') return send(res, 200, await analyzer.clear());
    if (m === 'POST' && p === '/api/analyse/lot') {
      // Sélection des parties d'un lot : les plus récentes du joueur, filtrées par cadence et couleur,
      // sans celles déjà analysées complètement à cette profondeur (ou plus) ni celles déjà en file.
      const b = await readBody(req);
      const joueur = String(b.joueur || '');
      const nombre = Math.max(1, Math.min(1000, parseInt(b.nombre, 10) || 10));
      const depth = DEPTHS.includes(b.depth) ? b.depth : getSettings().depth;
      const me = joueur.toLowerCase();
      const analyses = store.listAnalyses();
      const chosen = [];
      let already = 0;
      for (const g of gameList(joueur)) {
        if (chosen.length >= nombre) break;
        if (b.cadence && g.timeClass !== b.cadence) continue;
        const color = g.white.username.toLowerCase() === me ? 'w' : 'b';
        if (b.couleur && b.couleur !== color) continue;
        if (b.classees && !g.rated) continue;
        if (!g.plyCount) continue;
        const a = analyses[g.id];
        if (a && a.complete && a.depth >= depth) { already++; continue; }
        if (analyzer.isQueued(g.id)) continue;
        chosen.push(g.id);
      }
      const r = analyzer.enqueue(chosen, depth);
      return send(res, 200, { ajoutees: r.added, dejaAnalysees: already, depth, status: r.status });
    }
    if (m === 'GET' && p === '/api/analyse') return send(res, 200, analyzer.status());
    if (m === 'GET' && p === '/api/bilan') {
      const u = String(url.searchParams.get('joueur') || '');
      const list = (await summaries.forPlayer(u)).map(({ mistakes, ...rest }) => rest);
      return send(res, 200, { summaries: list, leniency: getSettings().leniency });
    }
    if (m === 'GET' && p === '/api/exercices') {
      const u = String(url.searchParams.get('joueur') || '');
      return send(res, 200, { items: await exerciseItems(u), states: store.loadExerciseStates(u) });
    }
    if (m === 'POST' && p === '/api/exercices/reponse') {
      const b = await readBody(req);
      const u = String(b.joueur || '');
      if (typeof b.id !== 'string' || typeof b.uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(b.uci)) return send(res, 400, { error: 'Paramètres invalides' });
      const ex = (await exerciseItems(u)).find((e) => e.id === b.id);
      if (!ex) return send(res, 404, { error: 'Exercice introuvable' });
      const chess = new Chess(ex.fen);
      let mv = null;
      try { mv = chess.move({ from: b.uci.slice(0, 2), to: b.uci.slice(2, 4), promotion: b.uci[4] }); } catch (e) { mv = null; }
      if (!mv) return send(res, 400, { error: 'Coup illégal' });
      let correct; let reason; let evaluation = null;
      const quick = quickCheck(ex, b.uci);
      if (quick) { correct = quick.accepted; reason = quick.reason; } else {
        try {
          evaluation = await analyzer.evaluateMove(ex.fen, b.uci, ex.elo);
        } catch (e) { return send(res, 500, { error: `Évaluation impossible : ${e.message}` }); }
        const cat = evaluation.classification && evaluation.classification.category;
        correct = acceptedByClassification(cat);
        reason = evaluation.classification ? `${evaluation.classification.label} selon Stockfish, perte ${evaluation.classification.loss.toFixed(1).replace('.', ',')} point(s)` : 'non évalué';
      }
      let state = null;
      if (b.compter) {
        const states = store.loadExerciseStates(u);
        state = states[ex.id] = nextState(states[ex.id], correct);
        store.saveExerciseStates(u, states);
      }
      return send(res, 200, {
        correct, reason, san: mv.san, state,
        evaluation: evaluation ? { score: evaluation.played && evaluation.played.score, pv: evaluation.played && evaluation.played.pv, classification: evaluation.classification, explanation: evaluation.explanation, depth: evaluation.engine && evaluation.engine.depth } : null,
      });
    }
    if (m === 'POST' && p === '/api/explorer') {
      const b = await readBody(req);
      if (typeof b.fen !== 'string' || typeof b.uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(b.uci)) return send(res, 400, { error: 'Paramètres invalides' });
      try {
        return send(res, 200, await analyzer.evaluateMove(b.fen, b.uci, typeof b.elo === 'number' ? b.elo : null));
      } catch (e) { return send(res, 400, { error: e.message }); }
    }
    return send(res, 404, { error: 'Route inconnue' });
  }

  function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(uiDir, rel));
    if (!file.startsWith(path.normalize(uiDir + path.sep))) return send(res, 403, 'Interdit');
    fs.readFile(file, (err, buf) => {
      if (err) return send(res, 404, 'Introuvable');
      send(res, 200, buf, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Security-Policy': CSP, 'X-Frame-Options': 'DENY' });
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host;
      if (host !== `127.0.0.1:${actualPort}` && host !== `localhost:${actualPort}`) return send(res, 403, 'Hôte refusé');
      const origin = req.headers.origin;
      if (origin && origin !== `http://127.0.0.1:${actualPort}` && origin !== `http://localhost:${actualPort}`) return send(res, 403, 'Origine refusée');
      if (req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, 'Requête inter-sites refusée');
      if (req.method === 'OPTIONS') return send(res, 403, 'Refusé');
      const url = new URL(req.url, `http://127.0.0.1:${actualPort}`);
      if (url.pathname.startsWith('/api/')) {
        if (!tokenOk(req)) return send(res, 401, { error: 'Jeton manquant ou invalide' });
        if (req.method === 'POST' && !(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'JSON attendu' });
        return await api(req, res, url);
      }
      if (req.method !== 'GET') return send(res, 405, 'Méthode refusée');
      return serveStatic(req, res, url);
    } catch (e) {
      if (!res.headersSent) send(res, e.code && Number.isInteger(e.code) ? e.code : 500, { error: e.message });
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      actualPort = server.address().port;
      resolve({
        port: actualPort,
        token,
        url: `http://127.0.0.1:${actualPort}/`,
        engine: () => engine,
        async close() {
          importer.cancel();
          try { await Promise.race([analyzer.close(), new Promise((r) => setTimeout(r, 3000))]); } catch (e) { /* */ }
          engine.stop();
          const closed = new Promise((r) => server.close(() => r()));
          if (server.closeAllConnections) server.closeAllConnections();
          await closed;
        },
      });
    });
  });
}

module.exports = { startServer };
