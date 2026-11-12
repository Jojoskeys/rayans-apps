'use strict';
/**
 * Télécharge le binaire officiel Stockfish (github.com/official-stockfish/Stockfish, release sf_19),
 * vérifie son empreinte SHA-256 (épinglée ci-dessous, relevée le 2026-11-12) et l'installe dans
 * vendor/stockfish/ avec sa licence (GPL v3) et ses fichiers d'accompagnement.
 * Usage : node scripts/fetch-stockfish.js <linux-x64|win-x64|mac>
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const TAG = 'sf_19';
const VERSION = 'Stockfish 19';
const ASSETS = {
  'linux-x64': { file: 'stockfish-linux-x86-64-universal.tar.gz', bin: 'stockfish-linux-x86-64-universal', sha256: '9defc0d4e55d49c65a6d042f3e571a39fcea499ade6dbe741b53b8c65e03611f' },
  'win-x64': { file: 'stockfish-windows-x86-64-universal.zip', bin: 'stockfish-windows-x86-64-universal.exe', sha256: '3c8bf1f9ea66a09350a40df4f632288285ac206d99f33ab5842c408fc30b48a7' },
  mac: { file: 'stockfish-macos-universal.tar.gz', bin: 'stockfish-macos-universal', sha256: 'a1f0e3bcc5a6927a11fe6fc8e54a779754645f3c2bae2cf13420fd1957adaa77' },
};

async function main() {
  const target = process.argv[2] || ({ linux: 'linux-x64', win32: 'win-x64', darwin: 'mac' }[process.platform]);
  const asset = ASSETS[target];
  if (!asset) throw new Error(`Cible inconnue : ${target}`);
  const root = path.join(__dirname, '..');
  const cacheDir = process.env.STOCKFISH_CACHE || path.join(root, '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const archive = path.join(cacheDir, asset.file);
  if (!fs.existsSync(archive)) {
    const url = `https://github.com/official-stockfish/Stockfish/releases/download/${TAG}/${asset.file}`;
    console.log(`Téléchargement de ${url}`);
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) throw new Error(`Téléchargement impossible (${r.status})`);
    fs.writeFileSync(archive, Buffer.from(await r.arrayBuffer()));
  }
  const sum = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
  if (sum !== asset.sha256) throw new Error(`Empreinte SHA-256 inattendue pour ${asset.file} : ${sum}`);
  const tmp = path.join(cacheDir, `extract-${target}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  // tar sait extraire .tar.gz partout, et .zip sous Windows (bsdtar) ; sinon unzip.
  // (Sous Windows, on appelle explicitement le tar.exe du système : le « tar » GNU de Git Bash lit « D: » comme un hôte distant.)
  if (process.platform === 'win32') execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', archive, '-C', tmp]);
  else if (asset.file.endsWith('.zip')) execFileSync('unzip', ['-q', archive, '-d', tmp]);
  else execFileSync('tar', ['-xf', archive, '-C', tmp]);
  const src = path.join(tmp, 'stockfish');
  const out = path.join(root, 'vendor', 'stockfish');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const binName = target === 'win-x64' ? 'stockfish.exe' : 'stockfish';
  fs.copyFileSync(path.join(src, asset.bin), path.join(out, binName));
  fs.chmodSync(path.join(out, binName), 0o755);
  for (const f of ['Copying.txt', 'AUTHORS', 'README.md', 'CITATION.cff', 'Top CPU Contributors.txt']) {
    if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(out, f));
  }
  fs.writeFileSync(path.join(out, 'SOURCE.txt'), [
    `${VERSION} — version stable officielle (tag ${TAG}).`,
    `Binaire : ${asset.file} (SHA-256 ${asset.sha256})`,
    `Téléchargé depuis https://github.com/official-stockfish/Stockfish/releases/tag/${TAG}`,
    'Licence : GNU GPL v3 (voir Copying.txt).',
    `Code source correspondant : https://github.com/official-stockfish/Stockfish/tree/${TAG}`,
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(out, 'release.json'), JSON.stringify({ version: VERSION, tag: TAG, asset: asset.file, sha256: asset.sha256 }, null, 2));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${VERSION} installé dans vendor/stockfish (${target})`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
