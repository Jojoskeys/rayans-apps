'use strict';
// Signature « ad hoc » de l'application macOS (sans certificat payant) : indispensable sur Apple Silicon,
// où une application modifiée sans signature valide est refusée comme « endommagée ».
// Le binaire officiel Stockfish n'est PAS re-signé : dans le binaire « universal » macOS, la partie Intel lit
// le réseau NNUE à un décalage fixe dans le fichier ; une nouvelle signature déplace ces octets et fait planter
// le moteur sur les Mac Intel. On vérifie donc après signature que le binaire est resté identique à l'octet près.
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.platform !== 'darwin') {
    console.warn('afterPack : signature ad hoc ignorée (construction hors macOS)');
    return;
  }
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const sf = path.join(app, 'Contents', 'Resources', 'stockfish', 'stockfish');
  const sha = () => crypto.createHash('sha256').update(fs.readFileSync(sf)).digest('hex');
  const expected = JSON.parse(fs.readFileSync(path.join(path.dirname(sf), 'release.json'), 'utf8')).binarySha256;
  if (sha() !== expected) throw new Error('Binaire Stockfish modifié avant signature');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  if (sha() !== expected) throw new Error('La signature a modifié le binaire Stockfish : il planterait sur Mac Intel');
  console.log('afterPack : binaire Stockfish officiel inchangé (SHA-256 vérifié)');
  console.log(`afterPack : ${app} signé ad hoc`);
};
