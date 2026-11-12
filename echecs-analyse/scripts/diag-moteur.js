'use strict';
/**
 * Diagnostic du binaire Stockfish embarqué, avec les réglages exacts de l'application
 * (fils = cœurs − 1, 256 Mo, ucinewgame, MultiPV 2, profondeur 22). Affiche le code de sortie et stderr en cas d'échec.
 * Usage : node scripts/diag-moteur.js <chemin du binaire>
 */
const { spawn } = require('child_process');
const os = require('os');

const bin = process.argv[2];
const threads = Math.max(1, Math.min(16, os.cpus().length - 1));
const p = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'] });
let out = ''; let err = '';
p.stdout.on('data', (d) => { out += d; });
p.stderr.on('data', (d) => { err += d; });
const cmds = ['uci', `setoption name Threads value ${threads}`, 'setoption name Hash value 256', 'isready', 'ucinewgame', 'isready',
  'setoption name MultiPV value 2', 'isready', 'position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'go depth 22'];
for (const c of cmds) p.stdin.write(c + '\n');
const t0 = Date.now();
const timer = setInterval(() => {
  if (/bestmove/.test(out)) { p.stdin.write('quit\n'); clearInterval(timer); }
  if (Date.now() - t0 > 120000) { p.kill(); clearInterval(timer); }
}, 200);
p.on('exit', (code, signal) => {
  clearInterval(timer);
  const lines = out.split('\n');
  console.log(JSON.stringify({
    plateforme: `${process.platform}-${process.arch}`, cpus: os.cpus().length, modele: os.cpus()[0] && os.cpus()[0].model, threads,
    code, signal, duree_ms: Date.now() - t0,
    id: lines.find((l) => l.startsWith('id name')), info: lines.filter((l) => l.startsWith('info string')).slice(0, 6),
    derniere: lines.filter((l) => / depth 22 /.test(l)).slice(-2), bestmove: lines.find((l) => l.startsWith('bestmove')), stderr: err.trim(),
  }, null, 2));
  process.exit(/bestmove/.test(out) ? 0 : 1);
});
