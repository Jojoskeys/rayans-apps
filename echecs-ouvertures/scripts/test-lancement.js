'use strict';
/**
 * Test de lancement du paquet construit, comme un double-clic :
 *  - macOS : « open » (LaunchServices, même chemin que le Finder) sur le .app ;
 *  - Windows : « start » (ShellExecute, même chemin que l'Explorateur) sur l'.exe ;
 *  - Linux : exécution directe du binaire.
 * L'application démarre serveur et moteur, vérifie que l'interface et Stockfish répondent, écrit un rapport et
 * se ferme. Usage : node scripts/test-lancement.js <chemin du .app ou de l'.exe>
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const target = path.resolve(process.argv[2]);
const report = path.join(os.tmpdir(), `test-lancement-${Date.now()}.json`);
const arg = `--test-lancement=${report}`;
const t0 = Date.now();
if (process.platform === 'darwin') {
  execFileSync('open', ['-n', '-W', target, '--args', arg], { stdio: 'inherit', timeout: 180000 });
} else if (process.platform === 'win32') {
  spawnSync('cmd.exe', ['/c', 'start', '""', '/wait', target, arg], { stdio: 'inherit', timeout: 180000, windowsVerbatimArguments: false });
} else {
  spawnSync(target, ['--no-sandbox', arg], { stdio: 'inherit', timeout: 180000 });
}
for (let i = 0; i < 60 && !fs.existsSync(report); i++) execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},1000)']);
if (!fs.existsSync(report)) { console.error('Aucun rapport : l’application ne s’est pas lancée correctement'); process.exit(1); }
const r = JSON.parse(fs.readFileSync(report, 'utf8'));
r.duree_s = Math.round((Date.now() - t0) / 1000);
r.cible = target;
console.log(JSON.stringify(r, null, 2));
process.exit(r.ok && r.uiLoaded && r.packaged ? 0 : 1);
