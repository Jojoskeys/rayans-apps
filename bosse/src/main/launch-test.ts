// Test de lancement (--test-lancement=<rapport.json>) : l'application démarre pour de vrai dans un dossier temporaire,
// on crée un espace en cliquant dans l'interface, on y ajoute un site et un dossier, on l'ouvre (sans rien ouvrir
// réellement : les ouvertures sont notées), on vérifie Chrono et la recherche par nom, puis on écrit le rapport.
import { app, type BrowserWindow } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AppData } from "../core/model.ts";

interface Hooks {
  getMain(): BrowserWindow | null;
  getData(): AppData;
  setData(d: AppData): unknown;
  openByName(name: string): Promise<boolean>;
  dataFile: string;
  dryRun: { on: boolean; opened: string[] };
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
const type = (w: BrowserWindow, css: string, value: string) => js(w, `(() => { const i = document.querySelector(${JSON.stringify(css)});
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(value)});
  i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
const click = (w: BrowserWindow, css: string) => js(w, `document.querySelector(${JSON.stringify(css)}).click()`);

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
    await waitFor("écran d'accueil", () => js<boolean>(w, `document.body.textContent.includes("Un espace de travail par projet")`));
    report.uiLoaded = true;
    step("premier lancement : écran d'accueil sans espace");

    await click(w, '[data-testid="nouvel-espace"]');
    await waitFor("espace créé", () => h.getData().workspaces.length === 1, 5000);
    await type(w, '[data-testid="nom-espace"]', "Mémoire de master");
    await waitFor("nom enregistré", () => h.getData().workspaces[0]?.name === "Mémoire de master", 5000);
    step("clic sur « Nouvel espace », nom tapé : « Mémoire de master »");

    await type(w, '[data-testid="champ-url"]', "github.com/Jojoskeys");
    await click(w, '[data-testid="ajouter-url"]');
    await waitFor("site ajouté", () => h.getData().workspaces[0]?.items[0]?.target === "https://github.com/Jojoskeys", 5000);
    step("site ajouté : https://github.com/Jojoskeys (https:// ajouté tout seul)");

    // Un dossier existant, ajouté comme si on l'avait déposé (le dialogue de choix ne peut pas être cliqué).
    const d = h.getData();
    const dir = os.tmpdir();
    h.setData({ ...d, workspaces: d.workspaces.map((x) => ({ ...x, items: [...x.items, { id: "dossier1", kind: "dossier" as const, target: dir, label: "", args: "" }] })) });
    await js(w, "location.reload()");
    await waitFor("deux éléments affichés", () => js<boolean>(w, `document.querySelectorAll('[data-testid="elements"] li').length === 2`), 8000);
    step("dossier ajouté, liste affichée après rechargement (données relues sur le disque)");

    if (!(await js<boolean>(w, `document.querySelector('[data-testid="chrono"]').checked`))) throw new Error("Chrono non coché par défaut");
    await click(w, '[data-testid="ouvrir-espace"]');
    await waitFor("rapport d'ouverture", () => js<boolean>(w, `!!document.querySelector('[data-testid="rapport"]')`), 8000);
    const opened = [...h.dryRun.opened];
    report.ouvert = opened;
    const expected = ["url:https://github.com/Jojoskeys", `dossier:${dir}`, "chrono:Mémoire de master"];
    if (JSON.stringify(opened) !== JSON.stringify(expected)) throw new Error(`ouvert : ${opened.join(", ")} au lieu de ${expected.join(", ")}`);
    if (!h.getData().workspaces[0].lastOpened) throw new Error("date d'ouverture non enregistrée");
    step(`« Ouvrir l'espace » : ${opened.join(" · ")}`);

    h.dryRun.opened.length = 0;
    if (!(await h.openByName("memoire"))) throw new Error("« bosse memoire » n'a pas trouvé l'espace");
    if (h.dryRun.opened.length !== 3) throw new Error("« bosse memoire » n'a pas tout ouvert");
    if (await h.openByName("inconnu")) throw new Error("un espace inconnu a été ouvert");
    await waitFor("message espace inconnu", () => js<boolean>(w, `document.querySelector(".toast")?.textContent.includes("inconnu")`), 5000);
    step("« bosse memoire » retrouve l'espace sans accent ; « bosse inconnu » affiche un message");

    const saved = JSON.parse(fs.readFileSync(h.dataFile, "utf8"));
    if (saved.workspaces?.[0]?.items?.length !== 2) throw new Error("espace non enregistré");
    step(`espace enregistré dans ${h.dataFile}`);

    const dirCap = process.env.BOSSE_CAPTURES;
    if (dirCap) {
      fs.mkdirSync(dirCap, { recursive: true });
      w.setSize(1040, 740);
      w.show();
      try {
        await sleep(600);
        const img = await w.webContents.capturePage();
        fs.writeFileSync(path.join(dirCap, "1-espace.png"), img.toPNG());
        step(`capture d'écran dans ${dirCap}`);
      } catch (e) { step(`capture impossible (${String(e)})`); }
    }
    report.ok = true;
  })()
    .catch((e) => { report.erreur = String(e?.stack ?? e); })
    .finally(() => { clearTimeout(watchdog); finish(); });
}
