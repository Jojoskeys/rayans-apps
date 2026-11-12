'use strict';
// Construit data/openings.json à partir des fichiers TSV de lichess-org/chess-openings (CC0).
const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');

const dir = path.join(__dirname, '..', 'third_party', 'chess-openings');
const named = {};
const book = new Set();
const epd = (fen) => fen.split(' ').slice(0, 4).join(' ');
let count = 0;
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const lines = fs.readFileSync(path.join(dir, `${f}.tsv`), 'utf8').split('\n').slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const [eco, name, pgn] = line.split('\t');
    const c = new Chess();
    c.loadPgn(pgn);
    const hist = c.history({ verbose: true });
    for (const m of hist) book.add(epd(m.after));
    const key = epd(c.fen());
    // En cas de transposition, on garde le nom le plus long (le plus précis).
    if (!named[key] || named[key][1].length < name.length) named[key] = [eco, name];
    count += 1;
  }
}
const out = { source: 'lichess-org/chess-openings (CC0 1.0)', lines: count, named, book: [...book].sort() };
fs.writeFileSync(path.join(__dirname, '..', 'data', 'openings.json'), JSON.stringify(out));
console.log(`openings.json : ${count} lignes, ${Object.keys(named).length} positions nommées, ${book.size} positions de théorie`);
