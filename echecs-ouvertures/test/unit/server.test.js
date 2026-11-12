'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startServer } = require('../../src/server/server');
const { OPENINGS_FILE, rawGame, fakeEngine } = require('../helpers');

function req(port, p, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method, headers }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ro-srv-'));
  fs.mkdirSync(path.join(dir, 'ui'));
  fs.writeFileSync(path.join(dir, 'ui', 'index.html'), '<p>ok</p>');
  return dir;
}

test('serveur local : 127.0.0.1 uniquement, jeton, Host, Origin, pas de CORS', async () => {
  const dir = tmp();
  const s = await startServer({
    dataDir: path.join(dir, 'donnees'), stockfishPath: path.join(dir, 'absent'), uiDir: path.join(dir, 'ui'),
    openingsFile: OPENINGS_FILE, fetchImpl: async () => { throw new Error('hors ligne'); },
  });
  try {
    assert.match(s.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    const host = `127.0.0.1:${s.port}`;
    assert.equal((await req(s.port, '/api/joueurs', { headers: { Host: host } })).status, 401, 'sans jeton');
    const ok = await req(s.port, '/api/joueurs', { headers: { Host: host, 'X-Jeton': s.token } });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers['access-control-allow-origin'], undefined);
    assert.equal((await req(s.port, '/api/joueurs', { headers: { Host: `evil.example:${s.port}`, 'X-Jeton': s.token } })).status, 403, 'DNS rebinding');
    assert.equal((await req(s.port, '/api/joueurs', { headers: { Host: host, Origin: 'https://evil.example', 'X-Jeton': s.token } })).status, 403, 'origine tierce');
    assert.equal((await req(s.port, '/api/import', { method: 'POST', headers: { Host: host, 'X-Jeton': s.token, 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
    assert.equal((await req(s.port, '/../../etc/passwd', { headers: { Host: host } })).status, 404);
    const page = await req(s.port, '/', { headers: { Host: host } });
    assert.match(page.headers['content-security-policy'], /default-src 'self'/);
    const etat = JSON.parse((await req(s.port, '/api/etat', { headers: { Host: host, 'X-Jeton': s.token } })).body);
    assert.equal(etat.engine.available, false, 'moteur absent signalé sans planter');
  } finally {
    await s.close();
  }
});

test('parcours complet : import Chess.com simulé → analyse → répertoire → exercice', async () => {
  const dir = tmp();
  const games = [
    rawGame(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Qh5', 'e6'], { white: 'Moi', black: 'A1' }),
    rawGame(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Qh5', 'g6'], { white: 'Moi', black: 'A2', result: '0-1' }),
    rawGame(['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qd3'], { white: 'A3', black: 'Moi', result: '0-1' }),
  ];
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    const body = url.endsWith('/games/archives') ? { archives: ['https://api.chess.com/pub/player/moi/games/2026/10'] } : { games };
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
  };
  const engine = fakeEngine();
  const s = await startServer({ dataDir: path.join(dir, 'donnees'), stockfishPath: 'absent', uiDir: path.join(dir, 'ui'), openingsFile: OPENINGS_FILE, fetchImpl, engine });
  const host = `127.0.0.1:${s.port}`;
  const get = async (p) => JSON.parse((await req(s.port, p, { headers: { Host: host, 'X-Jeton': s.token } })).body);
  const post = async (p, b) => { const r = await req(s.port, p, { method: 'POST', headers: { Host: host, 'X-Jeton': s.token, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, json: JSON.parse(r.body) }; };
  const until = async (p) => { for (;;) { const st = await get(p); if (st.status !== 'running') return st; await new Promise((r) => setTimeout(r, 10)); } };
  try {
    assert.equal((await post('/api/import', { pseudo: 'Moi' })).status, 200);
    const imp = await until('/api/import');
    assert.equal(imp.status, 'done', JSON.stringify(imp));
    assert.equal(imp.totalGames, 3);
    assert.ok(urls[0].includes('/pub/player/moi/games/archives'));

    let rep = await get('/api/repertoire?joueur=Moi');
    assert.equal(rep.games, 3);
    assert.equal(rep.analysed, 0);
    assert.equal(rep.repertoire.w[0].family, 'Sicilian Defense');
    assert.equal(rep.repertoire.b[0].family, 'Nimzo-Indian Defense');

    assert.equal((await post('/api/analyse', { joueur: 'moi', nombre: 50, depth: 10 })).status, 200);
    const an = await until('/api/analyse');
    assert.equal(an.status, 'done', JSON.stringify(an));
    assert.equal(an.done, 3);

    rep = await get('/api/repertoire?joueur=moi');
    assert.equal(rep.analysed, 3);
    const sic = rep.repertoire.w[0];
    assert.equal(sic.games, 2);
    assert.equal(sic.drills, 1, 'même position dans deux parties = un exercice');

    const ex = await get('/api/exercices?joueur=moi');
    const d = ex.drills.find((x) => x.opening.family === 'Sicilian Defense');
    assert.equal(d.occurrences.length, 2);
    assert.equal(d.color, 'w');
    // Mauvaise réponse (le coup joué dans les parties) puis bonne réponse.
    let r = await post('/api/exercices/reponse', { joueur: 'moi', id: d.id, uci: 'd1h5', compter: true });
    assert.equal(r.json.correct, false);
    assert.equal(r.json.state.box, 0);
    r = await post('/api/exercices/reponse', { joueur: 'moi', id: d.id, uci: d.best.uci, compter: false });
    assert.equal(r.json.correct, true);
    // Coup quelconque : évalué par le moteur (ici −2,00 → refusé).
    const other = ['h2h3', 'a2a3', 'g2g4'].find((u) => u !== d.best.uci && (!d.second || u !== d.second.uci));
    r = await post('/api/exercices/reponse', { joueur: 'moi', id: d.id, uci: other, compter: false });
    assert.equal(r.json.correct, false);
    assert.ok(r.json.score);
    assert.equal((await post('/api/exercices/reponse', { joueur: 'moi', id: d.id, uci: 'e1e8' })).status, 400, 'coup illégal');
    assert.equal((await post('/api/exercices/reponse', { joueur: 'moi', id: 'inconnu', uci: 'e2e4' })).status, 404);
    rep = await get('/api/repertoire?joueur=moi');
    assert.equal(rep.repertoire.w[0].attempts, 1);
    assert.equal(rep.repertoire.w[0].successRate, 0);
  } finally {
    await s.close();
  }
});
