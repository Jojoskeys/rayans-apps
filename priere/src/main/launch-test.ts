// Test de lancement (--test-lancement=<rapport.json>) : l'application démarre pour de vrai, on vérifie le premier écran,
// on choisit Paris, on compare les horaires affichés au calcul, on déclenche un rappel avec une horloge avancée, on
// parcourt les onglets, puis on écrit un rapport et on quitte. Les données sont dans un dossier temporaire.
import { app, type BrowserWindow, type Tray } from "electron";
import fs from "node:fs";
import path from "node:path";
import { dayAt, reminders } from "../core/schedule.ts";
import type { AppData, Settings } from "../core/settings.ts";
import type { Store } from "./store.ts";

interface Hooks {
  getMain(): BrowserWindow | null;
  getTray(): Tray | null;
  store: Store;
  getData(): AppData;
  updateSettings(p: Partial<Settings>): void;
  tick(): void;
  setClock(f: () => number): void;
  sent: Set<string>;
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
const sel = (w: BrowserWindow, css: string) => js<string>(w, `document.querySelector(${JSON.stringify(css)})?.textContent ?? ""`);
const tab = (w: BrowserWindow, label: string) => js(w, `[...document.querySelectorAll('.navigation-principale button')].find(b => b.textContent.includes(${JSON.stringify(label)})).click()`);

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
  const watchdog = setTimeout(() => { report.erreur = "délai global dépassé (90 s)"; finish(); }, 90_000);

  (async () => {
    const w = (await waitFor("fenêtre principale", () => h.getMain()))!;
    await waitFor("écran d'accueil", () => js<boolean>(w, `!!document.querySelector('[data-testid="commencer"]')?.disabled`));
    report.uiLoaded = true;
    step("premier lancement : écran de choix de la ville, bouton Commencer désactivé");

    await js(w, `(() => { const i = document.querySelector('[data-testid="recherche-ville"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "par");
      i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    await waitFor("Paris proposé", () => js<boolean>(w, `[...document.querySelectorAll('.resultats button')].some(b => b.textContent.startsWith("Paris"))`), 5000);
    await js(w, `[...document.querySelectorAll('.resultats button')].find(b => b.textContent.startsWith("Paris")).click()`);
    await waitFor("Commencer activé", () => js<boolean>(w, `document.querySelector('[data-testid="commencer"]')?.disabled === false`), 5000);
    await js(w, `document.querySelector('[data-testid="commencer"]').click()`);
    await waitFor("ville enregistrée", () => h.getData().settings.place?.name === "Paris", 5000);
    await waitFor("horaires affichés", async () => (await sel(w, '[data-testid="lieu"]')) === "Paris", 5000);
    step("recherche « par », clic sur Paris, Commencer : horaires de Paris affichés");

    const s = h.getData().settings;
    const v = dayAt(s, Date.now())!;
    const fmt = (ms: number) => new Intl.DateTimeFormat("fr-FR", { timeZone: s.place!.tz, hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
    const shown = await js<string[]>(w, `[...document.querySelectorAll('[data-testid="horaires"] .heure')].map(e => e.textContent)`);
    const expected = (["fajr", "lever", "dhuhr", "asr", "maghrib", "isha"] as const).map((id) => fmt(v.times[id]));
    if (JSON.stringify(shown) !== JSON.stringify(expected)) throw new Error(`horaires affichés ${shown} au lieu de ${expected}`);
    report.horaires = Object.fromEntries((["fajr", "lever", "dhuhr", "asr", "maghrib", "isha"] as const).map((id, i) => [id, shown[i]]));
    step(`horaires du jour conformes au calcul : ${shown.join(" · ")}`);
    if (!/\d\d:\d\d/.test(await sel(w, '[data-testid="decompte"]'))) throw new Error("compte à rebours absent");
    step(`prochaine prière : ${await sel(w, '[data-testid="prochaine"]')} dans ${await sel(w, '[data-testid="decompte"]')}`);

    // Rappel : horloge placée 30 s après l'heure d'Asr.
    const asr = reminders(s, Date.now()).find((r) => r.prayer === "asr" && r.kind === "heure" && r.key.startsWith(v.date.join("-")))!;
    h.sent.clear();
    h.setClock(() => asr.at + 30_000);
    h.tick();
    if (!h.sent.has(asr.key)) throw new Error("rappel d'Asr non envoyé");
    const count = h.sent.size;
    h.tick();
    if (h.sent.size !== count) throw new Error("rappel envoyé deux fois");
    h.setClock(() => Date.now());
    step(`notification « ${asr.title} » envoyée une seule fois`);

    h.updateSettings({ pausedUntil: asr.at + 3_600_000 });
    h.sent.clear();
    h.setClock(() => asr.at + 30_000);
    h.tick();
    if (h.sent.size) throw new Error("rappel envoyé malgré la suspension");
    h.updateSettings({ pausedUntil: null });
    h.setClock(() => Date.now());
    step("notifications suspendues : aucun rappel");

    await tab(w, "Calendrier");
    await waitFor("calendrier", async () => (await js<number>(w, `document.querySelectorAll('.tableau tbody tr').length`)) >= 28, 5000);
    if ((await js<number>(w, `document.querySelectorAll('.tableau tr.aujourdhui').length`)) !== 1) throw new Error("jour courant non surligné");
    step(`calendrier : ${await sel(w, '[data-testid="titre-mois"]')}, aujourd'hui surligné`);
    await tab(w, "Réglages");
    await waitFor("réglages", () => js<boolean>(w, `document.body.textContent.includes("Ajuster sur sa mosquée")`), 5000);
    step("réglages affichés");

    const tray = h.getTray();
    if (!tray || tray.isDestroyed()) throw new Error("icône de la zone de notification absente");
    step("icône de la zone de notification présente");
    const saved = JSON.parse(fs.readFileSync(h.store.file, "utf8"));
    if (saved.settings?.place?.name !== "Paris") throw new Error("réglages non enregistrés");
    step(`réglages enregistrés dans ${h.store.file}`);

    const dir = process.env.PRIERE_CAPTURES;
    if (dir) {
      fs.mkdirSync(dir, { recursive: true });
      w.setSize(1000, 720);
      w.show();
      w.focus();
      // Les captures sont un bonus : un échec (fenêtre masquée par le système) ne fait pas échouer le test.
      try {
        for (const [i, label] of ["Aujourd'hui", "Calendrier", "Réglages"].entries()) {
          await tab(w, label);
          await sleep(600);
          const img = await waitFor("capture", async () => { try { return await w.webContents.capturePage(); } catch { return null; } }, 5000);
          fs.writeFileSync(path.join(dir, `${i + 1}-${["jour", "calendrier", "reglages"][i]}.png`), img!.toPNG());
        }
        step(`captures d'écran dans ${dir}`);
      } catch (e) {
        step(`captures impossibles (${String(e)})`);
      }
    }
    report.ok = true;
  })()
    .catch((e) => { report.erreur = String(e?.stack ?? e); })
    .finally(() => { clearTimeout(watchdog); finish(); });
}
