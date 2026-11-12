#!/usr/bin/env node
// Faux moteur UCI pour les tests : plante (code 3) aux N premiers « go », N = FAUX_MOTEUR_PLANTAGES.
const fs = require('fs');
const counter = process.env.FAUX_MOTEUR_COMPTEUR;
const max = parseInt(process.env.FAUX_MOTEUR_PLANTAGES || '0', 10);
require('readline').createInterface({ input: process.stdin }).on('line', (l) => {
  if (l === 'uci') console.log('id name Faux 1\nuciok');
  else if (l === 'isready') console.log('readyok');
  else if (l.startsWith('go')) {
    const n = counter && fs.existsSync(counter) ? +fs.readFileSync(counter, 'utf8') : 0;
    if (counter) fs.writeFileSync(counter, String(n + 1));
    if (n < max) { process.stderr.write('Illegal instruction (simulé)\n'); process.exit(3); }
    console.log('info depth 22 multipv 1 score cp 30 nodes 1 pv e2e4 e7e5');
    console.log('info depth 22 multipv 2 score cp 20 nodes 1 pv d2d4 d7d5');
    console.log('bestmove e2e4');
  } else if (l === 'quit') process.exit(0);
});
