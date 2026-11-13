// Test de lancement (--test-lancement=<rapport.json>) : l'application démarre pour de vrai et on vérifie chaque outil
// avec des fichiers fabriqués dans un dossier temporaire : barre de commande, fusion PDF, image allégée, partage avec
// le téléphone (téléchargement et envoi en HTTP), QR code. Hors CI, on vérifie aussi le son, le Wi-Fi et l'OCR de
// Windows (sans rien modifier). Les minuteries d'arrêt ne sont jamais lancées.
import { app, BrowserWindow, nativeImage, type Tray } from "electron";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { RunResult, State } from "../renderer/api-types.ts";
import { compressImage } from "./image.ts";
import { mergeToPdf } from "./pdf.ts";
import type { ShareServer } from "./share.ts";
import { listOutputs, ocr, readWifi } from "./windows.ts";

interface Hooks {
  getMain(): BrowserWindow | null;
  getPalette(): BrowserWindow | null;
  getTray(): Tray | null;
  state(): State;
  runCommand(t: string): Promise<RunResult>;
  share: ShareServer;
  dataDir: string;
  openPalette(): void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor<T>(what: string, fn: () => T | Promise<T>, timeout = 20_000): Promise<T> {
  const t0 = Date.now();
  let last: unknown;
  while (Date.now() - t0 < timeout) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await sleep(100);
  }
  throw new Error(`Délai dépassé : ${what}${last ? ` (${String(last)})` : ""}`);
}
const js = <T = unknown>(w: BrowserWindow, code: string) => w.webContents.executeJavaScript(code, true) as Promise<T>;
const typeInto = (w: BrowserWindow, css: string, value: string) => js(w, `(() => { const i = document.querySelector(${JSON.stringify(css)});
  const proto = i instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(i, ${JSON.stringify(value)});
  i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
const tab = (w: BrowserWindow, label: string) => js(w, `[...document.querySelectorAll('.navigation-principale button')].find(b => b.textContent.includes(${JSON.stringify(label)})).click()`);

/** Image « photo » de bruit coloré (difficile à compresser, comme une vraie photo). */
function noiseImage(width: number, height: number) {
  const buf = Buffer.alloc(width * height * 4);
  let seed = 12345;
  for (let i = 0; i < buf.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const x = (i / 4) % width, y = Math.floor(i / 4 / width);
    buf[i] = (x * 255) / width + (seed & 63); buf[i + 1] = (y * 255) / height + ((seed >> 6) & 63); buf[i + 2] = (seed >> 12) & 255; buf[i + 3] = 255;
  }
  return nativeImage.createFromBitmap(buf, { width, height });
}

export function runLaunchTest(reportPath: string, h: Hooks) {
  const report: Record<string, unknown> = {
    ok: false, uiLoaded: false, packaged: app.isPackaged, version: app.getVersion(),
    plateforme: `${process.platform}-${process.arch}`, electron: process.versions.electron, etapes: [] as string[],
  };
  const step = (s: string) => { (report.etapes as string[]).push(s); console.log(`[test-lancement] ${s}`); };
  const finish = () => {
    try { fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); } catch (e) { console.error(e); }
    app.exit(report.ok ? 0 : 1);
  };
  const watchdog = setTimeout(() => { report.erreur = "délai global dépassé (150 s)"; finish(); }, 150_000);

  (async () => {
    const w = (await waitFor("fenêtre principale", () => h.getMain()))!;
    await waitFor("interface chargée", async () => (await js<number>(w, `document.querySelectorAll('.navigation-principale button').length`)) === 8);
    report.uiLoaded = true;
    step("interface affichée : 7 outils + réglages");

    // Barre de commande
    h.openPalette();
    const p = (await waitFor("barre de commande", () => h.getPalette()))!;
    await waitFor("champ de la barre", () => js<boolean>(p, `!!document.querySelector('[data-testid="palette-champ"]')`));
    await typeInto(p, '[data-testid="palette-champ"]', "ete");
    await waitFor("suggestion « eteins »", () => js<boolean>(p, `document.querySelector('.palette li button.actif code')?.textContent === "eteins 45"`), 5000);
    step("barre de commande : « ete » propose « eteins 45 »");
    const bad = await h.runCommand("bonjour");
    if (bad.ok) throw new Error("commande inconnue acceptée");
    const img = await h.runCommand("img 500ko");
    if (!img.ok) throw new Error("img 500ko refusé");
    await waitFor("outil image ouvert avec 500 Ko", () => js<boolean>(w, `document.querySelector('[data-testid="cible"]')?.value === "500 Ko"`), 5000);
    step("« img 500ko » ouvre l'outil image réglé sur 500 Ko ; « bonjour » est refusé");

    // Fichiers d'essai
    const dir = path.join(h.dataDir, "essais");
    fs.mkdirSync(dir, { recursive: true });
    const photo = path.join(dir, "photo.jpg");
    fs.writeFileSync(photo, noiseImage(3000, 2000).toJPEG(95));
    const scan = path.join(dir, "scan.png");
    fs.writeFileSync(scan, noiseImage(1200, 1700).toPNG());
    const docPdf = await PDFDocument.create();
    docPdf.addPage().drawText("Page de test", { x: 50, y: 700, size: 24, font: await docPdf.embedFont(StandardFonts.Helvetica) });
    const pdfIn = path.join(dir, "document.pdf");
    fs.writeFileSync(pdfIn, await docPdf.save());

    // PDF
    const out = path.join(dir, "fusion.pdf");
    const r = await mergeToPdf([photo, pdfIn, scan], out, "legere");
    const check = await PDFDocument.load(fs.readFileSync(out));
    if (r.pages !== 3 || check.getPageCount() !== 3) throw new Error(`PDF : ${r.pages} pages`);
    const [w1, h1] = [check.getPage(0).getWidth(), check.getPage(0).getHeight()];
    if (!(w1 > h1)) throw new Error("la photo paysage n'est pas sur une page paysage");
    step(`PDF : photo 3000×2000 + PDF + scan → 3 pages (A4 paysage puis portrait), ${Math.round(r.bytes / 1024)} Ko au lieu de ${Math.round((fs.statSync(photo).size + fs.statSync(scan).size) / 1024)} Ko`);

    // Image
    const c = await compressImage(photo, 300);
    if (!c.ok || c.bytes > 300 * 1024 || !fs.existsSync(c.out) || !fs.existsSync(photo)) throw new Error(`image : ${JSON.stringify(c)}`);
    step(`image : ${Math.round(c.before / 1024)} Ko → ${Math.round(c.bytes / 1024)} Ko (${c.width}×${c.height}), original intact, copie « ${path.basename(c.out)} »`);

    // Partage avec le téléphone (sur 127.0.0.1 : le runner n'a pas forcément de Wi-Fi)
    const info = await h.share.start([pdfIn], 15, "127.0.0.1");
    const pageHtml = await (await fetch(info.url)).text();
    if (!pageHtml.includes("document.pdf")) throw new Error("page du partage incomplète");
    const dl = Buffer.from(await (await fetch(`${info.url}f/0/document.pdf`)).arrayBuffer());
    if (!dl.equals(fs.readFileSync(pdfIn))) throw new Error("fichier téléchargé différent");
    const up = await fetch(`${info.url}envoi?nom=${encodeURIComponent("IMG_0001.jpg")}`, { method: "PUT", body: fs.readFileSync(c.out) });
    if (!up.ok) throw new Error(`envoi : ${up.status}`);
    const got = info.received[0];
    if (!got || !fs.readFileSync(got).equals(fs.readFileSync(c.out))) throw new Error("fichier reçu absent ou différent");
    const port = new URL(info.url).port;
    if ((await fetch(`http://127.0.0.1:${port}/mauvais-jeton/`)).status !== 404) throw new Error("accès sans jeton accepté");
    await h.share.stop();
    let closed = false;
    try { await fetch(info.url); } catch { closed = true; }
    if (!closed) throw new Error("serveur toujours ouvert après l'arrêt");
    step("partage : page, téléchargement et envoi depuis le « téléphone » corrects, jeton exigé, serveur fermé à l'arrêt");

    // QR code d'un texte
    await tab(w, "Échanger avec le téléphone");
    await waitFor("outil téléphone", () => js<boolean>(w, `!!document.querySelector('[data-testid="texte-qr"]')`), 5000);
    await typeInto(w, '[data-testid="texte-qr"]', "https://exemple.fr");
    await waitFor("QR code affiché", () => js<boolean>(w, `(document.querySelector('[data-testid="qr-texte"]')?.src ?? "").startsWith("data:image/png")`), 5000);
    step("QR code d'un lien affiché");

    // Windows : lecture seule, hors CI
    if (!process.env.CI && process.platform === "win32") {
      const outs = await listOutputs();
      step(`son : ${outs.length} sortie(s) audio, par défaut « ${outs.find((o) => o.parDefaut)?.nom ?? "?"} » (rien n'est changé)`);
      const wifi = await readWifi();
      step(`Wi-Fi : ${wifi.connecte ? `connecté, clé ${wifi.cle ? "lue" : "absente"}` : "non connecté"}`);
      const tw = new BrowserWindow({ show: false, width: 900, height: 200, webPreferences: { offscreen: true } });
      await tw.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<body style="margin:0;background:#fff;font:40px Segoe UI">Rendez-vous mardi à 14 h 30</body>')}`);
      await sleep(400);
      const png = path.join(dir, "texte.png");
      fs.writeFileSync(png, (await tw.webContents.capturePage()).toPNG());
      tw.destroy();
      const t = await ocr(png);
      if (!/mardi/i.test(t.texte)) throw new Error(`OCR : « ${t.texte} »`);
      step(`OCR Windows (${t.langue}) : « ${t.texte} »`);
    }

    const tray = h.getTray();
    if (!tray || tray.isDestroyed()) throw new Error("icône de la zone de notification absente");
    step("icône de la zone de notification présente");

    const captures = process.env.OUTILS_CAPTURES;
    if (captures) {
      fs.mkdirSync(captures, { recursive: true });
      w.setSize(1060, 720);
      w.show();
      for (const [i, label] of ["Fusionner en PDF", "Alléger une image", "Échanger avec le téléphone", "Éteindre plus tard", "Réglages"].entries()) {
        await tab(w, label);
        await sleep(500);
        try { fs.writeFileSync(path.join(captures, `${i + 1}.png`), (await w.webContents.capturePage()).toPNG()); } catch { /* bonus */ }
      }
      h.openPalette();
      await typeInto(p, '[data-testid="palette-champ"]', "");
      await sleep(400);
      try { fs.writeFileSync(path.join(captures, "6-barre.png"), (await p.webContents.capturePage()).toPNG()); } catch { /* bonus */ }
      step(`captures d'écran dans ${captures}`);
    }
    report.ok = true;
  })()
    .catch((e) => { report.erreur = String(e?.stack ?? e); })
    .finally(() => { clearTimeout(watchdog); finish(); });
}
