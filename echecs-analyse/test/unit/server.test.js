'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startServer } = require('../../src/server/server');

const ROOT = path.join(__dirname, '..', '..');

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

test('serveur local : 127.0.0.1 uniquement, jeton, Host, Origin, pas de CORS', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-srv-'));
  fs.mkdirSync(path.join(dir, 'ui'));
  fs.writeFileSync(path.join(dir, 'ui', 'index.html'), '<p>ok</p>');
  const s = await startServer({
    dataDir: path.join(dir, 'donnees'), stockfishPath: path.join(dir, 'absent'), uiDir: path.join(dir, 'ui'),
    openingsFile: path.join(ROOT, 'data', 'openings.json'), fetchImpl: async () => { throw new Error('hors ligne'); },
  });
  try {
    assert.match(s.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    const host = `127.0.0.1:${s.port}`;
    assert.equal((await req(s.port, '/api/joueurs', { headers: { Host: host } })).status, 401, 'sans jeton');
    assert.equal((await req(s.port, '/api/joueurs', { headers: { Host: host, 'X-Jeton': 'faux'.padEnd(48, '0') } })).status, 401, 'mauvais jeton');
    const ok = await req(s.port, '/api/joueurs', { headers: { Host: host, 'X-Jeton': s.token } });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers['access-control-allow-origin'], undefined);
    assert.equal((await req(s.port, '/api/joueurs', { headers: { Host: `evil.example:${s.port}`, 'X-Jeton': s.token } })).status, 403, 'DNS rebinding');
    assert.equal((await req(s.port, '/api/joueurs', { headers: { Host: host, Origin: 'https://evil.example', 'X-Jeton': s.token } })).status, 403, 'origine tierce');
    assert.equal((await req(s.port, '/api/joueurs', { headers: { Host: host, 'Sec-Fetch-Site': 'cross-site', 'X-Jeton': s.token } })).status, 403);
    assert.equal((await req(s.port, '/api/import', { method: 'OPTIONS', headers: { Host: host, Origin: `http://${host}` } })).status, 403, 'pré-vérification CORS refusée');
    assert.equal((await req(s.port, '/api/import', { method: 'POST', headers: { Host: host, 'X-Jeton': s.token, 'Content-Type': 'text/plain' }, body: '{}' })).status, 415, 'POST simple (formulaire) refusé');
    assert.equal((await req(s.port, '/../../etc/passwd', { headers: { Host: host } })).status, 404);
    const page = await req(s.port, '/', { headers: { Host: host } });
    assert.equal(page.status, 200);
    assert.match(page.headers['content-security-policy'], /default-src 'self'/);
    const etat = JSON.parse((await req(s.port, '/api/etat', { headers: { Host: host, 'X-Jeton': s.token } })).body);
    assert.equal(etat.engine.available, false, 'moteur absent signalé sans planter');
  } finally {
    await s.close();
  }
});
