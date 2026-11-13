// Test de lancement (--test-lancement=<rapport.json>) : l'application démarre pour de vrai. On lui donne de fausses
// données de Révision, Hifz et Ouvertures (dossier temporaire), on vérifie les nombres affichés, le rappel du soir
// (envoyé une seule fois) et les réglages, puis on écrit le rapport et on quitte.
import { app, type BrowserWindow, type Tray } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { SourceId } from "../core/counts.ts";
import type { Settings, State } from "../renderer/api-types.ts";

interface Hooks {
  getMain(): BrowserWindow | null;
  getTray(): Tray | null;
  state(): State;
  refresh(): void;
  updateSettings(p: Partial<Settings>): unknown;
  testHooks: { clock: () => number; paths: Record<SourceId, string>; sent: string[] };
  dataFile: string;
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
const text = (w: BrowserWindow, css: string) => js<string>(w, `document.querySelector(${JSON.stringify(css)})?.textContent ?? ""`);

/** Fausses données : 3 révisions + 2 nouvelles cartes, 2 portions de Coran (dont une fragile), 1 position d'ouverture. */
function writeFixtures(dir: string, now: number) {
  const card = (id: string, state: string, due: number, deckId = "d1") => ({ id, deckId, kind: "basic", question: id, answer: "", choices: [], explanation: "", created: 0, updated: 0, suspended: false, sched: { state, due, stability: 1, difficulty: 5, step: 0, interval: 1, reps: 1, lapses: 0, lastReview: null } });
  const revision = {
    format: "rayans-revision", version: 1,
    decks: [{ id: "d1", name: "Anglais", description: "", answerMode: "flip", newPerDay: 2, created: 0 }],
    cards: [card("a", "review", now - 86_400_000), card("b", "review", now - 3_600_000), card("c", "relearning", now - 60_000),
      card("d", "new", 0), card("e", "new", 0), card("f", "new", 0), card("g", "review", now + 10 * 86_400_000)],
    reviews: [], settings: { retention: 0.9, maxReviewsPerDay: 200, learningSteps: [1, 10], relearningSteps: [10], maxInterval: 36500, dayStartHour: 4 },
  };
  const iso = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const hifz = {
    version: 1, verses: { "1:3": "weak", "112:1": "memorized" }, activity: {}, settings: {},
    cards: { "1:1-7": { interval: 3, ease: 2.5, reps: 2, lapses: 0, due: iso(now + 5 * 86_400_000) }, "112:1-4": { interval: 1, ease: 2.5, reps: 1, lapses: 0, due: iso(now - 86_400_000) }, "113:1-5": { interval: 9, ease: 2.5, reps: 3, lapses: 0, due: iso(now + 9 * 86_400_000) } },
  };
  const ouv = { "pos-1": { box: 1, due: now - 1000 }, "pos-2": { box: 3, due: now + 86_400_000 } };
  fs.mkdirSync(path.join(dir, "revision"), { recursive: true });
  fs.mkdirSync(path.join(dir, "hifz"), { recursive: true });
  fs.mkdirSync(path.join(dir, "ouvertures", "joueurs", "rayan"), { recursive: true });
  fs.writeFileSync(path.join(dir, "revision", "revision.json"), JSON.stringify(revision));
  fs.writeFileSync(path.join(dir, "hifz", "hifz-donnees.json"), JSON.stringify(hifz));
  fs.writeFileSync(path.join(dir, "ouvertures", "joueurs", "rayan", "exercices.json"), JSON.stringify(ouv));
  return { revision: path.join(dir, "revision", "revision.json"), hifz: path.join(dir, "hifz", "hifz-donnees.json"), ouvertures: path.join(dir, "ouvertures", "joueurs") };
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
  const watchdog = setTimeout(() => { report.erreur = "délai global dépassé (90 s)"; finish(); }, 90_000);

  (async () => {
    // Fausses données, puis horloge à 15 h aujourd'hui (avant le rappel).
    const d = new Date();
    const at = (hh: number, mm = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime();
    h.testHooks.clock = () => at(15);
    h.testHooks.paths = writeFixtures(path.dirname(h.dataFile), at(15));

    const w = (await waitFor("fenêtre principale", () => h.getMain()))!;
    await waitFor("interface", () => js<boolean>(w, `!!document.querySelector('[data-testid="sources"]')`));
    report.uiLoaded = true;
    h.refresh();
    await waitFor("nombres affichés", async () => (await text(w, '[data-testid="nombre-revision"]')) === "5", 5000);
    const shown = { revision: await text(w, '[data-testid="nombre-revision"]'), hifz: await text(w, '[data-testid="nombre-hifz"]'), ouvertures: await text(w, '[data-testid="nombre-ouvertures"]') };
    report.affiche = shown;
    if (shown.hifz !== "2" || shown.ouvertures !== "1") throw new Error(`nombres affichés : ${JSON.stringify(shown)}`);
    const resume = await text(w, '[data-testid="resume"]');
    if (resume !== "8 éléments à réviser") throw new Error(`résumé : ${resume}`);
    step(`à réviser : Révision ${shown.revision} (2 révisions, 1 en réapprentissage, 2 nouvelles sur 3 : limite du paquet), Hifz ${shown.hifz} (dont 1 verset à revoir), Ouvertures ${shown.ouvertures} → « ${resume} »`);

    h.refresh();
    if (h.testHooks.sent.length) throw new Error("rappel envoyé avant l'heure");
    h.testHooks.clock = () => at(19, 5);
    h.refresh();
    if (h.testHooks.sent.length !== 1) throw new Error("rappel de 19 h non envoyé");
    h.refresh();
    if (h.testHooks.sent.length !== 1) throw new Error("rappel envoyé deux fois");
    step(`rappel de 19 h envoyé une seule fois : « ${h.testHooks.sent[0]} »`);

    // Tout est fait : le lendemain, avec des données à jour, aucun rappel.
    h.testHooks.paths = { revision: path.join(path.dirname(h.dataFile), "absent.json"), hifz: path.join(path.dirname(h.dataFile), "absent2.json"), ouvertures: path.join(path.dirname(h.dataFile), "absent") };
    h.testHooks.clock = () => at(19, 5) + 86_400_000;
    h.refresh();
    if (h.testHooks.sent.length !== 1) throw new Error("rappel envoyé alors que rien ne reste");
    await waitFor("tout est fait", async () => (await text(w, '[data-testid="resume"]')) === "Tout est fait pour aujourd'hui", 5000);
    step("applications sans données : « Tout est fait pour aujourd'hui », pas de rappel");

    await js(w, `document.querySelector('[data-testid="bouton-reglages"]').click()`);
    await waitFor("réglages", () => js<boolean>(w, `!!document.querySelector('[data-testid="reglages"]')`), 5000);
    h.updateSettings({ reminderHour: 20, reminderMinute: 30 });
    await waitFor("heure du rappel", () => js<boolean>(w, `document.querySelector('input[type=time]').value === "20:30"`), 5000);
    const saved = JSON.parse(fs.readFileSync(h.dataFile, "utf8"));
    if (saved.settings?.reminderHour !== 20) throw new Error("réglages non enregistrés");
    step(`réglages : rappel à 20:30, enregistré dans ${h.dataFile}`);

    const tray = h.getTray();
    if (!tray || tray.isDestroyed()) throw new Error("icône de la zone de notification absente");
    step("icône de la zone de notification présente");

    const dir = process.env.AUJOURDHUI_CAPTURES;
    if (dir) {
      fs.mkdirSync(dir, { recursive: true });
      h.testHooks.clock = () => at(15);
      h.testHooks.paths = writeFixtures(path.dirname(h.dataFile), at(15));
      h.refresh();
      await js(w, `document.querySelector('[data-testid="bouton-reglages"]').click()`);
      w.show();
      try {
        await sleep(700);
        fs.writeFileSync(path.join(dir, "1-aujourdhui.png"), (await w.webContents.capturePage()).toPNG());
        step(`capture d'écran dans ${dir}`);
      } catch (e) { step(`capture impossible (${String(e)})`); }
    }
    report.ok = true;
  })()
    .catch((e) => { report.erreur = String(e?.stack ?? e); })
    .finally(() => { clearTimeout(watchdog); finish(); });
}
