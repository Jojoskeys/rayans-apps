// Regroupe l'interface (esbuild) dans dist-ui/ avec la police Amiri Quran.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-ui');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
esbuild.buildSync({
  entryPoints: [path.join(root, 'src', 'ui', 'main.tsx')],
  bundle: true,
  format: 'iife',
  target: 'chrome130',
  jsx: 'automatic',
  outfile: path.join(out, 'app.js'),
  minify: true,
  legalComments: 'eof',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
for (const f of ['index.html', 'styles.css']) fs.copyFileSync(path.join(root, 'src', 'ui', f), path.join(out, f));
fs.copyFileSync(path.join(root, 'fonts', 'AmiriQuran.ttf'), path.join(out, 'fonts', 'AmiriQuran.ttf'));
console.log('Interface construite dans dist-ui/');
