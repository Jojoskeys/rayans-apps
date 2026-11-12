// Test de lancement : démarre l'application (l'.exe construit, ou Electron en développement sans argument),
// qui vérifie texte arabe, traduction, police Amiri Quran et sens d'écriture droite-à-gauche, écrit un
// rapport puis se ferme. Sous Windows, l'.exe est lancé avec « start » comme un double-clic.
// Usage : node scripts/test-lancement.js [chemin de l'.exe]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = path.join(os.tmpdir(), `rayans-hifz-lancement-${Date.now()}.json`);
const captures = process.env.CAPTURES_DIR ? [`--captures=${path.resolve(process.env.CAPTURES_DIR)}`] : [];
const arg = `--test-lancement=${report}`;
const target = process.argv[2] ? path.resolve(process.argv[2]) : null;
const t0 = Date.now();

if (!target) {
  const electron = createRequire(import.meta.url)('electron');
  spawnSync(electron, [root, arg, ...captures], { stdio: 'inherit', timeout: 180000 });
} else if (process.platform === 'win32') {
  spawnSync('cmd.exe', ['/c', 'start', '""', '/wait', target, arg, ...captures], { stdio: 'inherit', timeout: 180000 });
} else {
  spawnSync(target, ['--no-sandbox', arg, ...captures], { stdio: 'inherit', timeout: 180000 });
}
for (let i = 0; i < 60 && !fs.existsSync(report); i++) await new Promise((r) => setTimeout(r, 1000));
if (!fs.existsSync(report)) {
  console.error("Aucun rapport : l'application ne s'est pas lancée correctement");
  process.exit(1);
}
const r = JSON.parse(fs.readFileSync(report, 'utf8'));
r.duree_s = Math.round((Date.now() - t0) / 1000);
r.cible = target ?? 'electron (développement)';
console.log(JSON.stringify(r, null, 2));
if (!r.audio) console.log('Remarque : audio en ligne non joignable pendant le test (non bloquant).');
process.exit(r.ok && r.uiLoaded && (!target || r.packaged) ? 0 : 1);
