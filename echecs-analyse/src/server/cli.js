'use strict';
// Démarrage du serveur sans Electron (tests automatisés). Affiche { url, token } sur une ligne JSON.
const path = require('path');
const { startServer } = require('./server');

const root = path.join(__dirname, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
startServer({
  dataDir: args.data || path.join(root, '.donnees-dev'),
  stockfishPath: args.stockfish || path.join(root, 'vendor', 'stockfish', process.platform === 'win32' ? 'stockfish.exe' : 'stockfish'),
  stockfishRelease: (() => { try { return require(path.join(root, 'vendor', 'stockfish', 'release.json')); } catch (e) { return null; } })(),
  uiDir: path.join(root, 'dist-ui'),
  openingsFile: path.join(root, 'data', 'openings.json'),
  port: args.port ? +args.port : 0,
}).then((s) => {
  console.log(JSON.stringify({ url: s.url, token: s.token, port: s.port }));
  const stop = async () => { await s.close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
});
