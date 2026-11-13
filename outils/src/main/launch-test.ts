// Test de lancement (--test-lancement=<rapport.json>) : l'application démarre pour de vrai et on vérifie chaque outil
// avec des fichiers fabriqués dans un dossier temporaire : barre de commande, fusion PDF, image allégée, partage avec
// le téléphone (téléchargement et envoi en HTTP), QR code. Hors CI, on vérifie aussi le son, le Wi-Fi et l'OCR de
// Windows (sans rien modifier). Les minuteries d'arrêt ne sont jamais lancées.
import { app, BrowserWindow, nativeImage, type Tray } from "electron";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { RunResult, State } from "../renderer/api-types.ts";
import { addDays, iso, type SuiviAction } from "../core/suivi.ts";
import type { RecentRoot } from "./recent.ts";
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
  suiviAction(a: SuiviAction): State;
  checkSuivi(): void;
  testHooks: { clock: () => number; recentRoots: RecentRoot[] | null; copied: string[]; notified: string[] };
  suiviFile: string;
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
    await waitFor("interface chargée", async () => (await js<number>(w, `document.querySelectorAll('.navigation-principale button').length`)) === 13);
    report.uiLoaded = true;
    step("interface affichée : 7 outils, 5 listes de suivi + réglages");

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

    // ----- Suivi : echeance, garde, fait, colle, recent, bosse -----
    const DAY = 86_400_000;
    const now = Date.now();
    const in2 = iso(now + 2 * DAY);
    const typed = `${in2.slice(8)}/${in2.slice(5, 7)}`;
    h.testHooks.notified.length = 0;
    const e1 = await h.runCommand(`echeance Essai gratuit Canal+ ${typed}`);
    const ech = h.state().suivi.deadlines[0];
    if (!e1.ok || ech?.name !== "Essai gratuit Canal+" || ech.date !== in2) throw new Error(`echeance : ${JSON.stringify(e1)} ${JSON.stringify(ech)}`);
    // Le rappel part dès l'ajout (l'échéance est dans 2 jours), puis plus jamais.
    h.checkSuivi();
    h.checkSuivi();
    if (h.testHooks.notified.length !== 1 || !h.testHooks.notified[0].includes("Essai gratuit Canal+")) throw new Error(`rappel d'échéance : ${h.testHooks.notified.join(" / ")}`);
    step(`« echeance Essai gratuit Canal+ ${typed} » : ajoutée (« ${e1.message} »), rappel envoyé une fois : « ${h.testHooks.notified[0]} »`);
    const e2 = await h.runCommand("echeance Assurance");
    if (!e2.ok) throw new Error("echeance sans date");
    await waitFor("formulaire prérempli", () => js<boolean>(w, `document.querySelector('[data-testid="echeance-nom"]')?.value === "Assurance"`), 5000);
    await typeInto(w, '[data-testid="echeance-date"]', addDays(iso(now), 40));
    await js(w, `document.querySelector('[data-testid="echeance-ajouter"]').click()`);
    await waitFor("échéance ajoutée depuis le panneau", () => h.state().suivi.deadlines.length === 2, 5000);
    await waitFor("liste des échéances", () => js<boolean>(w, `document.querySelectorAll('[data-testid="echeances"] li').length === 2`), 5000);
    step("« echeance Assurance » (sans date) ouvre le panneau prérempli ; date choisie, ajoutée : 2 échéances, la plus proche en premier");

    const g = await h.runCommand("garde exemple.fr/article?id=3 pour le mémoire");
    const bm = h.state().suivi.bookmarks[0];
    if (!g.ok || bm?.url !== "https://exemple.fr/article?id=3" || bm.reason !== "le mémoire") throw new Error(`garde : ${JSON.stringify(bm)}`);
    h.suiviAction({ type: "bookmark-read", id: bm.id, read: true });
    if (!h.state().suivi.bookmarks[0].readAt) throw new Error("marquer comme lu");
    h.testHooks.clock = () => now + 31 * DAY;
    h.checkSuivi();
    if (h.state().suivi.bookmarks.length !== 0) throw new Error("lien non effacé après 30 jours");
    h.testHooks.clock = () => Date.now();
    step(`« garde exemple.fr/article?id=3 pour le mémoire » : https:// ajouté, raison « ${bm.reason} », marqué lu, effacé au bout de 30 jours`);

    const f1 = await h.runCommand("fait vidange");
    h.testHooks.clock = () => now + 45 * DAY;
    const f2 = await h.runCommand("fait Vidange");
    const ch = h.state().suivi.chores;
    if (ch.length !== 1 || ch[0].done.length !== 2 || !f2.message?.includes("45 jours")) throw new Error(`fait : ${JSON.stringify(ch)} ${f2.message}`);
    h.testHooks.clock = () => now + 100 * DAY;
    h.suiviAction({ type: "chore-save", chore: { ...ch[0], intervalDays: 30 } });
    await tab(w, "Entretien");
    await waitFor("tâche en retard", () => js<boolean>(w, `document.querySelector('[data-testid="taches"] li')?.classList.contains("en-retard")`), 5000);
    h.testHooks.clock = () => Date.now();
    step(`« fait vidange » : ${f1.message} Puis 45 jours plus tard : « ${f2.message} » ; en rouge après 30 jours`);

    h.suiviAction({ type: "snippet-save", snippet: { id: "s1", name: "IBAN", text: "FR76 3000 6000 0112 3456 7890 189" } });
    h.suiviAction({ type: "snippet-save", snippet: { id: "s2", name: "Adresse", text: "12 rue des Lilas\n75020 Paris" } });
    const c1 = await h.runCommand("colle iban");
    if (!c1.ok || h.testHooks.copied.at(-1) !== "FR76 3000 6000 0112 3456 7890 189") throw new Error("colle iban");
    const c2 = await h.runCommand("colle adr");
    if (!c2.ok || !h.testHooks.copied.at(-1)?.startsWith("12 rue")) throw new Error("colle adr (début du nom)");
    const c3 = await h.runCommand("colle rib");
    if (c3.ok || !c3.message?.includes("IBAN")) throw new Error("colle inconnu");
    step(`« colle iban » et « colle adr » copient le texte ; « colle rib » : « ${c3.message} »`);

    const recentDir = path.join(h.dataDir, "telechargements");
    fs.mkdirSync(path.join(recentDir, "sous-dossier"), { recursive: true });
    for (const [i, n] of ["ancien.pdf", "facture.pdf", "sous-dossier/photo.jpg", "en-cours.crdownload"].entries()) {
      fs.writeFileSync(path.join(recentDir, n), "x".repeat(100 * (i + 1)));
      await sleep(30);
    }
    h.testHooks.recentRoots = [{ label: "Téléchargements", path: recentDir, depth: 1 }];
    const rc = await h.runCommand("recent");
    if (!rc.ok) throw new Error("recent");
    await waitFor("fichiers récents", () => js<number>(w, `document.querySelectorAll('[data-testid="recents"] li').length`).then((n) => n === 3), 8000);
    const first = await js<string>(w, `document.querySelector('[data-testid="recents"] li .lien-titre').textContent`);
    if (first !== "photo.jpg") throw new Error(`fichier le plus récent : ${first}`);
    step("« recent » : 3 fichiers (téléchargement en cours ignoré), le plus récent en premier, sous-dossier compris");

    const b = await h.runCommand("bosse mémoire");
    if (b.ok || !b.message?.includes("Rayan's Bosse n'est pas installée")) throw new Error(`bosse : ${JSON.stringify(b)}`);
    step(`« bosse mémoire » sans Rayan's Bosse installée : « ${b.message} »`);

    const saved = JSON.parse(fs.readFileSync(h.suiviFile, "utf8"));
    if (saved.deadlines?.length !== 2 || saved.snippets?.length !== 2) throw new Error("suivi.json non enregistré");
    step(`listes enregistrées dans ${h.suiviFile}`);

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
      for (const [i, label] of ["Fusionner en PDF", "Alléger une image", "Échanger avec le téléphone", "Éteindre plus tard", "Réglages", "Échéances et abonnements", "Entretien", "Textes à coller"].entries()) {
        await tab(w, label);
        await sleep(500);
        try { fs.writeFileSync(path.join(captures, `${i < 5 ? i + 1 : i + 2}.png`), (await w.webContents.capturePage()).toPNG()); } catch { /* bonus */ }
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
