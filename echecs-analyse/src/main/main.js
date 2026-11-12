'use strict';
/**
 * Processus principal Electron : démarre le serveur local (127.0.0.1) et le moteur, ouvre la fenêtre,
 * puis arrête proprement serveur et moteur à la fermeture.
 */
const { app, BrowserWindow, ipcMain, clipboard, shell, net, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer } = require('../server/server');

const ROOT = path.join(__dirname, '..', '..');
const isPackaged = app.isPackaged;
const resources = isPackaged ? process.resourcesPath : path.join(ROOT, 'vendor');

function stockfishPath() {
  const exe = process.platform === 'win32' ? 'stockfish.exe' : 'stockfish';
  return path.join(resources, 'stockfish', exe);
}
function stockfishRelease() {
  try { return JSON.parse(fs.readFileSync(path.join(resources, 'stockfish', 'release.json'), 'utf8')); } catch (e) { return null; }
}

let server = null;
let win = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(start);
}

async function start() {
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([
    { role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' },
  ]) : null);
  const dataDir = process.env.ANALYSE_ECHECS_DATA || path.join(app.getPath('userData'), 'donnees');
  try {
    server = await startServer({
      dataDir,
      stockfishPath: stockfishPath(),
      stockfishRelease: stockfishRelease(),
      uiDir: path.join(ROOT, 'dist-ui'),
      openingsFile: path.join(ROOT, 'data', 'openings.json'),
      fetchImpl: (url, opts) => net.fetch(url, opts),
      appVersion: app.getVersion(),
    });
  } catch (e) {
    dialog.showErrorBox('Analyse Échecs', `Impossible de démarrer le serveur local : ${e.message}`);
    app.quit();
    return;
  }
  ipcMain.handle('copier-texte', (_e, text) => { clipboard.writeText(String(text)); return true; });
  ipcMain.handle('ouvrir-lien', (_e, url) => {
    if (/^https:\/\/(www\.)?chess\.com\//.test(url) || /^https:\/\/claude\.ai\/?$/.test(url)) shell.openExternal(url);
    return true;
  });
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    title: 'Analyse Échecs',
    backgroundColor: '#1d1f24',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const origin = server.url.replace(/\/$/, '');
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(origin)) e.preventDefault(); });
  win.loadURL(`${server.url}#jeton=${server.token}`);
  const smokeArg = process.argv.find((a) => a.startsWith('--test-lancement='));
  const smokeFile = process.env.ANALYSE_ECHECS_SMOKE || (smokeArg && smokeArg.slice('--test-lancement='.length));
  if (smokeFile) {
    // Test automatique de lancement : vérifie que l'interface et le moteur répondent, puis quitte.
    win.webContents.once('did-finish-load', async () => {
      try {
        const r = await net.fetch(`${server.url}api/etat`, { headers: { 'X-Jeton': server.token } });
        const j = await r.json();
        const ok = r.ok && j.engine && j.engine.available;
        fs.writeFileSync(smokeFile, JSON.stringify({ ok, engine: j.engine, stockfishRelease: j.stockfishRelease, title: win.getTitle(), packaged: app.isPackaged, platform: process.platform, arch: process.arch, stockfishPath: stockfishPath(), uiLoaded: await win.webContents.executeJavaScript('!!document.querySelector("#board .cg-wrap, .cg-wrap")') }, null, 2));
      } catch (e) {
        fs.writeFileSync(smokeFile, JSON.stringify({ ok: false, error: e.message }));
      }
      app.quit();
    });
  }
  win.on('closed', () => { win = null; });
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', async (e) => {
  if (quitting || !server) return;
  e.preventDefault();
  quitting = true;
  try { await server.close(); } catch (err) { /* arrêt au mieux */ }
  app.quit();
});
