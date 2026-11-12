'use strict';
/**
 * Serveur HTTP local, lié exclusivement à 127.0.0.1 sur un port aléatoire (mêmes protections qu'Analyse Échecs) :
 *  - en-tête Host obligatoirement 127.0.0.1:<port> (bloque le « DNS rebinding ») ;
 *  - jeton secret aléatoire exigé dans l'en-tête X-Jeton pour toute route /api ;
 *  - Origin, si présent, doit être celui de l'application ; Sec-Fetch-Site « cross-site » refusé ;
 *  - aucun en-tête CORS n'est jamais renvoyé ; corps JSON limités à 64 Ko.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createStore } = require('./store');
const { Engine } = require('./engine');
const { createImporter } = require('./importer');
const { createAnalyzer, DEPTHS, DEFAULT_SETTINGS } = require('./analyzer');
const { createOpenings } = require('../core/openings');
const { Chess } = require('../core/chessutil');
const R = require('../core/repertoire');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

function startServer(opts) {
  const {
    dataDir, stockfishPath, uiDir, openingsFile, fetchImpl = globalThis.fetch, appVersion = '1.0.0',
    engineOptions = {}, port = 0, stockfishRelease = null, engine: injectedEngine = null,
  } = opts;
  const store = createStore(dataDir);
  const openings = createOpenings(JSON.parse(fs.readFileSync(openingsFile, 'utf8')));
  const engine = injectedEngine || new Engine(stockfishPath, engineOptions);
  const getSettings = () => ({ ...DEFAULT_SETTINGS, ...store.loadSettings() });
  const importer = createImporter({ store, fetchImpl });
  const token = crypto.randomBytes(24).toString('hex');
  let actualPort = null;

  // Ouverture de chaque partie, calculée une fois par partie et par joueur.
  const infoCache = new Map();
  function infosFor(username) {
    const u = String(username || '').toLowerCase();
    if (!u) return [];
    const out = [];
    for (const g of Object.values(store.loadGames(u))) {
      const k = `${u}|${g.id}`;
      if (!infoCache.has(k)) infoCache.set(k, R.gameOpening(g, u, openings));
      const info = infoCache.get(k);
      if (info) out.push(info);
    }
    return out;
  }
  const analyzer = createAnalyzer({ store, engineRef: () => engine, infosFor });

  function drillsFor(username) {
    const analyses = store.loadAnalyses(username);
    return R.buildDrills(infosFor(username).map((info) => ({ info, analysis: analyses[info.gameId] || null })), openings);
  }

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

  async function api(req, res, url) {
    const p = url.pathname;
    const m = req.method;
    const joueur = () => String(url.searchParams.get('joueur') || '').toLowerCase();
    if (m === 'GET' && p === '/api/etat') {
      let engineInfo = { name: engine.name, available: true, threads: engine.threads, hash: engine.hash };
      try { await engine.start(); engineInfo.name = engine.name; } catch (e) { engineInfo = { available: false, error: e.message }; }
      return send(res, 200, { appVersion, engine: engineInfo, stockfishRelease, settings: getSettings(), depths: DEPTHS, dataDir, players: store.listPlayers() });
    }
    if (m === 'POST' && p === '/api/reglages') {
      const b = await readBody(req);
      const cur = store.loadSettings();
      if (DEPTHS.includes(b.depth)) cur.depth = b.depth;
      if (Number.isInteger(b.nombre) && b.nombre >= 1 && b.nombre <= 2000) cur.nombre = b.nombre;
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
    if (m === 'POST' && p === '/api/analyse') {
      const b = await readBody(req);
      const s = getSettings();
      try {
        return send(res, 200, analyzer.start(String(b.joueur || '').toLowerCase(), {
          nombre: Number.isInteger(b.nombre) ? b.nombre : s.nombre, depth: DEPTHS.includes(b.depth) ? b.depth : s.depth,
          cadence: typeof b.cadence === 'string' && b.cadence ? b.cadence : null,
        }));
      } catch (e) { return send(res, 409, { error: e.message }); }
    }
    if (m === 'GET' && p === '/api/analyse') return send(res, 200, analyzer.status());
    if (m === 'POST' && p === '/api/analyse/annuler') { analyzer.cancel(); return send(res, 200, analyzer.status()); }
    if (m === 'GET' && p === '/api/repertoire') {
      const u = joueur();
      const infos = infosFor(u);
      const analyses = store.loadAnalyses(u);
      const rep = R.buildRepertoire(infos, analyses, drillsFor(u), store.loadDrillStates(u));
      return send(res, 200, { repertoire: rep, games: infos.length, analysed: infos.filter((i) => analyses[i.gameId]).length });
    }
    if (m === 'GET' && p === '/api/exercices') {
      const u = joueur();
      return send(res, 200, { drills: drillsFor(u), states: store.loadDrillStates(u) });
    }
    if (m === 'POST' && p === '/api/exercices/reponse') {
      const b = await readBody(req);
      const u = String(b.joueur || '').toLowerCase();
      if (typeof b.id !== 'string' || typeof b.uci !== 'string' || !UCI_RE.test(b.uci)) return send(res, 400, { error: 'Paramètres invalides' });
      const d = drillsFor(u).find((x) => x.id === b.id);
      if (!d) return send(res, 404, { error: 'Exercice introuvable' });
      const chess = new Chess(d.fen);
      let mv = null;
      try { mv = chess.move({ from: b.uci.slice(0, 2), to: b.uci.slice(2, 4), promotion: b.uci[4] }); } catch (e) { mv = null; }
      if (!mv) return send(res, 400, { error: 'Coup illégal' });
      let verdict = R.quickCheck(d, b.uci);
      let score = null;
      if (!verdict) {
        try { score = await analyzer.scoreMove(d.fen, b.uci, d.depth || getSettings().depth); } catch (e) { return send(res, 500, { error: `Évaluation impossible : ${e.message}` }); }
        verdict = R.judgeScore(d, b.uci, score);
      }
      let state = null;
      if (b.compter) {
        const states = store.loadDrillStates(u);
        state = states[d.id] = R.nextState(states[d.id], verdict.accepted);
        store.saveDrillStates(u, states);
      }
      return send(res, 200, { correct: verdict.accepted, reason: verdict.reason, san: mv.san, score, state });
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

  // Connexions persistantes gardées longtemps : un calcul long (premier chargement de milliers de parties) ne doit
  // pas faire fermer une connexion au moment où l'interface la réutilise (ECONNRESET).
  server.keepAliveTimeout = 60000;
  server.headersTimeout = 65000;

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
