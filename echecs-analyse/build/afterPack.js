'use strict';
// Signature « ad hoc » de l'application macOS (sans certificat payant) : indispensable sur Apple Silicon,
// où une application modifiée sans signature valide est refusée comme « endommagée ».
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.platform !== 'darwin') {
    console.warn('afterPack : signature ad hoc ignorée (construction hors macOS)');
    return;
  }
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const sf = path.join(app, 'Contents', 'Resources', 'stockfish', 'stockfish');
  execFileSync('codesign', ['--force', '--sign', '-', sf], { stdio: 'inherit' });
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  console.log(`afterPack : ${app} signé ad hoc`);
};
