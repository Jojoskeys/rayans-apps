'use strict';
// Processus principal de Rayan's Hifz : fenêtre, protocole hifz:// (interface, texte, audio en cache),
// sauvegarde locale des données et test de lancement.
const { app, BrowserWindow, ipcMain, protocol, net, dialog, shell, Menu } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const RECITER = 'Husary_128kbps';
const AUDIO_BASE = `https://everyayah.com/data/${RECITER}/`;
const ALLOWED_LINKS = /^https:\/\/(tanzil\.net|everyayah\.com|github\.com\/aliftype|openfontlicense\.org|scripts\.sil\.org)(\/|$)/;

const testArg = process.argv.find((a) => a.startsWith('--test-lancement='));
const testReport = testArg ? testArg.slice('--test-lancement='.length) : null;

if (testReport) app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'rayans-hifz-test-')));
else if (process.env.HIFZ_DATA_DIR) app.setPath('userData', path.resolve(process.env.HIFZ_DATA_DIR));

if (!testReport && !app.requestSingleInstanceLock()) app.quit();

protocol.registerSchemesAsPrivileged([
  { scheme: 'hifz', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const root = path.join(__dirname, '..', '..');
const uiDir = path.join(root, 'dist-ui');
const dataDir = app.isPackaged ? path.join(process.resourcesPath, 'data') : path.join(root, 'data');
const userDir = () => app.getPath('userData');
const dataFile = () => path.join(userDir(), 'hifz-donnees.json');
const audioDir = () => path.join(userDir(), 'audio', RECITER);

let win = null;

function inside(base, rel) {
  const p = path.normalize(path.join(base, rel));
  return p.startsWith(base + path.sep) ? p : null;
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

const AUDIO_NAME = /^\d{6}\.mp3$/;
const pending = new Map();

/** Fichier audio d'un verset : depuis le cache, sinon téléchargé une fois puis gardé. */
function ensureAudio(name) {
  const file = path.join(audioDir(), name);
  if (fs.existsSync(file)) return Promise.resolve(file);
  if (pending.has(name)) return pending.get(name);
  const job = (async () => {
    const res = await net.fetch(AUDIO_BASE + name);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) throw new Error('Fichier audio incomplet');
    writeAtomic(file, buf);
    return file;
  })().finally(() => pending.delete(name));
  pending.set(name, job);
  return job;
}

async function handleProtocol(request) {
  const url = new URL(request.url);
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (url.host === 'audio') {
    if (!AUDIO_NAME.test(rel)) return new Response('Introuvable', { status: 404 });
    try {
      const file = await ensureAudio(rel);
      return new Response(fs.readFileSync(file), { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } });
    } catch (e) {
      return new Response(`Audio indisponible : ${e.message}`, { status: 503 });
    }
  }
  if (url.host !== 'app') return new Response('Introuvable', { status: 404 });
  const file = rel.startsWith('data/') ? inside(dataDir, rel.slice(5)) : inside(uiDir, rel || 'index.html');
  if (!file || !fs.existsSync(file)) return new Response('Introuvable', { status: 404 });
  return net.fetch(pathToFileURL(file).toString());
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Rayan's Hifz",
    backgroundColor: '#f6f3ec',
    show: !testReport,
    icon: path.join(root, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (ALLOWED_LINKS.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('hifz://app/')) e.preventDefault();
  });
  win.loadURL('hifz://app/index.html');
}

// ---------- IPC ----------
ipcMain.handle('data:load', () => {
  for (const f of [dataFile(), `${dataFile()}.bak`]) {
    try {
      if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch {
      /* fichier abîmé : on essaie la copie de secours */
    }
  }
  return null;
});

ipcMain.handle('data:save', (_e, json) => {
  if (typeof json !== 'string' || json.length > 20_000_000) throw new Error('Données invalides');
  JSON.parse(json);
  if (fs.existsSync(dataFile())) fs.copyFileSync(dataFile(), `${dataFile()}.bak`);
  writeAtomic(dataFile(), json);
  return true;
});

ipcMain.handle('data:export', async (_e, json) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Exporter ma progression',
    defaultPath: path.join(app.getPath('documents'), `rayans-hifz-${new Date().toISOString().slice(0, 10)}.json`),
    filters: [{ name: 'Sauvegarde Rayan\'s Hifz', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return false;
  writeAtomic(r.filePath, json);
  return true;
});

ipcMain.handle('data:import', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Importer une progression',
    properties: ['openFile'],
    filters: [{ name: 'Sauvegarde Rayan\'s Hifz', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
});

ipcMain.handle('audio:cached', (_e, names) => {
  if (!Array.isArray(names)) return [];
  return names.filter((n) => AUDIO_NAME.test(n) && fs.existsSync(path.join(audioDir(), n)));
});

ipcMain.handle('audio:download', async (e, names) => {
  if (!Array.isArray(names)) return { ok: 0, failed: 0 };
  let ok = 0;
  let failed = 0;
  const queue = names.filter((n) => AUDIO_NAME.test(n));
  const worker = async () => {
    while (queue.length) {
      const n = queue.shift();
      try {
        await ensureAudio(n);
        ok++;
      } catch {
        failed++;
      }
      if (!e.sender.isDestroyed()) e.sender.send('audio:progress', { done: ok + failed, total: names.length, failed });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { ok, failed };
});

ipcMain.handle('audio:info', () => {
  let files = 0;
  let bytes = 0;
  try {
    for (const f of fs.readdirSync(audioDir())) {
      if (!AUDIO_NAME.test(f)) continue;
      files++;
      bytes += fs.statSync(path.join(audioDir(), f)).size;
    }
  } catch {
    /* pas encore de cache */
  }
  return { files, bytes, dir: audioDir() };
});

ipcMain.handle('audio:clear', () => {
  fs.rmSync(audioDir(), { recursive: true, force: true });
  return true;
});

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  dataFile: dataFile(),
  packaged: app.isPackaged,
  test: !!testReport,
  demo: !!captureDir,
}));

ipcMain.handle('app:open-link', (_e, url) => {
  if (typeof url === 'string' && ALLOWED_LINKS.test(url)) shell.openExternal(url);
});

ipcMain.handle('app:open-data-folder', () => shell.openPath(userDir()));

// ---------- Test de lancement ----------
function finishTest(result) {
  const r = { ...result, packaged: app.isPackaged, version: app.getVersion(), platform: process.platform };
  try {
    writeAtomic(testReport, JSON.stringify(r, null, 2));
  } finally {
    app.exit(r.ok ? 0 : 1);
  }
}

const captureArg = process.argv.find((a) => a.startsWith('--captures='));
const captureDir = testReport && captureArg ? path.resolve(captureArg.slice('--captures='.length)) : null;
const CAPTURES = [
  ['1-aujourdhui', { name: 'today' }],
  ['2-sourates', { name: 'surahs' }],
  ['3-sourate-ad-duha', { name: 'surah', sura: 93 }],
  ['4-revision', { name: 'review', mode: 'due' }],
  ['5-revision-devoilee', 'reveal'],
  ['6-progression', { name: 'progress' }],
  ['7-reglages', { name: 'settings' }],
];

async function captureScreens() {
  fs.mkdirSync(captureDir, { recursive: true });
  win.setSize(1280, 860);
  for (const [name, view] of CAPTURES) {
    win.webContents.send('smoke:go', view);
    await new Promise((r) => setTimeout(r, 900));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(captureDir, `${name}.png`), img.toPNG());
  }
}

ipcMain.on('smoke:report', async (_e, result) => {
  if (!testReport) return;
  let captures = null;
  if (captureDir) {
    try {
      await captureScreens();
      captures = captureDir;
    } catch (e) {
      captures = `échec : ${e.message}`;
    }
  }
  finishTest({ ok: !!result?.ok, uiLoaded: true, ...result, ...(captures ? { captures } : {}) });
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('hifz', handleProtocol);
  createWindow();
  if (testReport) setTimeout(() => finishTest({ ok: false, uiLoaded: false, erreur: "L'interface n'a pas répondu en 90 s" }), 90_000);
});

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('window-all-closed', () => app.quit());
