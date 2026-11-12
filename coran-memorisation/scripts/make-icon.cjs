'use strict';
// Dessine build/icon.png (512 × 512) avec la police Amiri Quran. Usage : npx electron scripts/make-icon.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const font = fs.readFileSync(path.join(root, 'fonts', 'AmiriQuran.ttf')).toString('base64');
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:A;src:url(data:font/ttf;base64,${font})}
html,body{margin:0;width:512px;height:512px;background:transparent;overflow:hidden}
div{width:472px;height:472px;margin:20px;border-radius:100px;background:linear-gradient(160deg,#2a8a69,#174f3d);
display:grid;place-items:center;color:#f6efd9;font:210px/1 A;direction:rtl;padding-bottom:30px;box-sizing:border-box}
</style><div>حفظ</div>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, useContentSize: true });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => new Promise(r => setTimeout(r, 300)))');
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  fs.writeFileSync(path.join(root, 'build', 'icon.png'), img.resize({ width: 512, height: 512 }).toPNG());
  console.log('build/icon.png écrit');
  app.quit();
});
