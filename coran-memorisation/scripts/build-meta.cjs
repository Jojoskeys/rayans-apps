'use strict';
// Convertit les métadonnées Tanzil (data/quran-data.js, CC BY 3.0, Tanzil Project) en src/core/quran-meta.json.
// À relancer seulement si data/quran-data.js change : node scripts/build-meta.cjs
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'data', 'quran-data.js'), 'utf8') + '\nthis.QuranData = QuranData;', ctx);
const Q = ctx.QuranData;
const suras = Q.Sura.slice(1, 115).map(([start, ayas, order, rukus, name, tname, ename, type]) => ({ start, ayas, order, name, tname, type }));
const pick = (arr) => arr.slice(1).filter((x) => x.length === 2).map(([s, a]) => [s, a]);
const meta = {
  source: 'Tanzil Project — Quran Metadata 1.0 (tanzil.net), CC BY 3.0',
  suras,
  juz: pick(Q.Juz).slice(0, 30),
  hizbQuarters: pick(Q.HizbQaurter).slice(0, 240),
  pages: pick(Q.Page).slice(0, 604),
  sajdas: Q.Sajda.slice(1).map(([s, a, t]) => [s, a]),
};
if (meta.suras.length !== 114 || meta.juz.length !== 30 || meta.hizbQuarters.length !== 240 || meta.pages.length !== 604) throw new Error('Métadonnées incomplètes');
fs.writeFileSync(path.join(root, 'src', 'core', 'quran-meta.json'), JSON.stringify(meta) + '\n');
console.log('src/core/quran-meta.json écrit');
