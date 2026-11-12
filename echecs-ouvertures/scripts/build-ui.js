'use strict';
// Regroupe l'interface (esbuild) dans dist-ui/.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const out = path.join(root, 'dist-ui');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
esbuild.buildSync({
  entryPoints: [path.join(root, 'src', 'ui', 'app.js')],
  bundle: true, format: 'iife', target: 'chrome120', outfile: path.join(out, 'app.js'), minify: true, legalComments: 'eof', logLevel: 'warning',
});
const cg = path.join(root, 'node_modules', 'chessground', 'assets');
fs.writeFileSync(path.join(out, 'chessground.css'), ['chessground.base.css', 'chessground.brown.css', 'chessground.cburnett.css']
  .map((f) => `/* chessground ${f} — GPL-3.0 (lichess-org/chessground) */\n` + fs.readFileSync(path.join(cg, f), 'utf8')).join('\n'));
for (const f of ['index.html', 'styles.css']) fs.copyFileSync(path.join(root, 'src', 'ui', f), path.join(out, f));
console.log('Interface construite dans dist-ui/');
