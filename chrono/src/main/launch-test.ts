// Test de lancement (--test-lancement=<rapport.json>) : l'application démarre pour de vrai (paquet construit),
// on clique dans son interface, on vérifie le temps enregistré, la mini-fenêtre, l'icône de notification,
// le fichier de données et l'export CSV, puis on écrit un rapport et on quitte. Les données sont dans un
// dossier temporaire : les vraies données de l'utilisateur ne sont jamais touchées.
import { app, type BrowserWindow, type Tray } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { Action, AppData } from "../core/types.ts";
import type { Command, ExportRequest } from "../renderer/api-types.ts";
import type { Store } from "./store.ts";

interface Hooks {
  getMain(): BrowserWindow | null;
  getMini(): BrowserWindow | null;
  getTray(): Tray | null;
  store: Store;
  command(cmd: Command): Promise<void>;
  dispatch(a: Action): void;
  getData(): AppData;
  saveNow(): void;
  exportTo(file: string, req: ExportRequest): void;
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

const js = (w: BrowserWindow | null, code: string) => {
  if (!w || w.isDestroyed()) throw new Error("fenêtre absente");
  return w.webContents.executeJavaScript(code, true);
};
const text = (w: BrowserWindow | null, testid: string) =>
  js(w, `document.querySelector('[data-testid="${testid}"]')?.textContent ?? ""`) as Promise<string>;
const click = (w: BrowserWindow | null, testid: string) =>
  js(w, `(() => { const b = document.querySelector('[data-testid="${testid}"]'); if (!b) return false; b.click(); return true; })()`);

/** Remplit une semaine d'exemple puis enregistre une capture de chaque écran (CHRONO_CAPTURES=<dossier>). */
async function capture(h: Hooks, main: BrowserWindow, dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  const d0 = h.getData();
  const general = d0.projects[0].id;
  const site = d0.projects.find((p) => p.name === "Projet de test")!.id;
  h.dispatch({ type: "updateProject", id: site, name: "Site du client" });
  h.dispatch({ type: "addProject", name: "Révisions" });
  const rev = h.getData().projects.find((p) => p.name === "Révisions")!.id;
  for (const [pid, name] of [[site, "Maquettes"], [site, "Intégration"], [rev, "Chapitre 3"], [general, "Courriels"]] as const) h.dispatch({ type: "addTask", projectId: pid, name });
  const tid = (n: string) => h.getData().tasks.find((x) => x.name === n)!.id;
  const day = new Date(); day.setHours(0, 0, 0, 0);
  const monday = day.getTime() - ((day.getDay() + 6) % 7) * 86_400_000;
  const plan: [number, string, string | null, number, number][] = [
    [0, site, tid("Maquettes"), 9, 110], [0, rev, tid("Chapitre 3"), 14, 50], [1, site, tid("Intégration"), 10, 150], [1, general, tid("Courriels"), 16, 25],
    [2, rev, tid("Chapitre 3"), 9.5, 75], [2, site, null, 13, 60], [3, site, tid("Intégration"), 9, 200], [4, general, null, 11, 40],
  ];
  const todayIdx = (day.getDay() + 6) % 7;
  for (const [di, pid, task, hour, min] of plan) {
    if (di > todayIdx) continue;
    const start = monday + di * 86_400_000 + hour * 3_600_000;
    h.dispatch({ type: "addEntry", projectId: pid, taskId: task, start, end: start + min * 60_000 });
  }
  h.dispatch({ type: "select", projectId: site, taskId: tid("Intégration") });
  h.dispatch({ type: "start" });
  h.dispatch({ type: "settings", patch: {} });
  main.setSize(1100, 740);
  const shot = async (w: BrowserWindow, name: string) => {
    await sleep(500);
    fs.writeFileSync(path.join(dir, `${name}.png`), (await w.webContents.capturePage()).toPNG());
  };
  const tabs = ["Minuteur", "Projets et tâches", "Résumés", "Réglages"];
  for (const [i, label] of tabs.entries()) {
    await js(main, `[...document.querySelectorAll('.navigation-principale button')].find(b => b.textContent.includes(${JSON.stringify(label)})).click()`);
    await shot(main, `${i + 1}-${label.split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}`);
  }
  await h.command("mini");
  const mini = (await waitFor("mini-fenêtre", () => h.getMini()))!;
  await waitFor("mini-fenêtre chargée", async () => /\d\d:\d\d/.test(await text(mini, "mini-temps")));
  await shot(mini, "5-mini");
  await h.command("principal");
  h.dispatch({ type: "reset" });
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
    const main = (await waitFor("fenêtre principale", () => h.getMain()))!;
    await waitFor("interface chargée", async () => (await text(main, "temps")) === "25:00");
    report.uiLoaded = true;
    step("interface affichée, minuteur à 25:00");

    if (!(await click(main, "demarrer"))) throw new Error("bouton Démarrer introuvable");
    await waitFor("minuteur en marche", () => h.getData().timer.status === "marche");
    await waitFor("compte à rebours visible", async () => (await text(main, "temps")) !== "25:00", 5000);
    step(`clic sur Démarrer : ${await text(main, "temps")}`);
    await sleep(1300);
    if (!(await click(main, "demarrer"))) throw new Error("bouton Pause introuvable");
    await waitFor("minuteur en pause", () => h.getData().timer.status === "pause");
    const entries = h.getData().entries;
    if (entries.length !== 1 || entries[0].end - entries[0].start < 1000) throw new Error(`temps non enregistré : ${JSON.stringify(entries)}`);
    step(`clic sur Pause : ${Math.round((entries[0].end - entries[0].start) / 100) / 10} s enregistrées`);
    await waitFor("total du jour affiché", async () => /\d+ min/.test(await text(main, "total-jour")), 5000);

    h.dispatch({ type: "addProject", name: "Projet de test" });
    await waitFor("projet ajouté dans l'interface", async () => (await js(main, `document.body.textContent.includes("Projet de test")`)) === true, 5000);
    step("projet ajouté et affiché");

    await h.command("mini");
    const mini = (await waitFor("mini-fenêtre", () => h.getMini()))!;
    await waitFor("mini-fenêtre chargée", async () => /\d\d:\d\d/.test(await text(mini, "mini-temps")));
    report.miniAlwaysOnTop = mini.isAlwaysOnTop();
    step(`mini-fenêtre ouverte (${await text(mini, "mini-temps")}, toujours au-dessus : ${mini.isAlwaysOnTop()})`);
    await click(mini, "mini-agrandir");
    await waitFor("retour à la fenêtre principale", () => !h.getMini() && h.getMain()?.isVisible());
    step("retour à la fenêtre principale");

    const tray = h.getTray();
    if (!tray || tray.isDestroyed()) throw new Error("icône de la zone de notification absente");
    step("icône de la zone de notification présente");

    await js(main, `window.__chronoTestSon && window.__chronoTestSon()`);
    step("son de fin de phase joué sans erreur");

    h.saveNow();
    const saved = JSON.parse(fs.readFileSync(h.store.file, "utf8"));
    if (saved.entries?.length !== 1) throw new Error("fichier de données incomplet");
    step(`données enregistrées dans ${h.store.file}`);

    const csv = path.join(h.store.dir, "export.csv");
    h.exportTo(csv, { name: "export" });
    const lines = fs.readFileSync(csv, "utf8").trim().split(/\r\n/);
    if (lines.length !== 2 || !lines[0].includes("Projet")) throw new Error("export CSV inattendu");
    step("export CSV correct");

    const captures = process.env.CHRONO_CAPTURES;
    if (captures) {
      await capture(h, main, captures);
      step(`captures d'écran dans ${captures}`);
    }

    report.ok = true;
  })()
    .catch((e) => { report.erreur = String(e?.stack ?? e); })
    .finally(() => { clearTimeout(watchdog); finish(); });
}
