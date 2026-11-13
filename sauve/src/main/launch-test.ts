// Test de lancement (--test-lancement=<rapport.json>) : l'application démarre pour de vrai avec deux dossiers à
// sauvegarder et une destination dans un dossier temporaire. On lance une vraie sauvegarde robocopy en cliquant,
// on vérifie les fichiers copiés, une deuxième sauvegarde (rien à recopier, rien d'effacé), le rappel des 7 jours,
// puis on écrit le rapport et on quitte.
import { app, type BrowserWindow, type Tray } from "electron";
import fs from "node:fs";
import path from "node:path";
import { CACHE_DIRS, FOLDER, type AppData, type RunResult, type Settings, type Source } from "../core/backup.ts";
import type { State } from "../renderer/api-types.ts";

interface Hooks {
  getMain(): BrowserWindow | null;
  getTray(): Tray | null;
  getData(): AppData;
  updateSettings(p: Partial<Settings>): unknown;
  runBackup(): Promise<RunResult>;
  checkReminder(): void;
  state(): State;
  testHooks: { clock: () => number; presets: Source[] | null; sent: string[] };
  dataFile: string;
  reload(): void;
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
  const watchdog = setTimeout(() => { report.erreur = "délai global dépassé (100 s)"; finish(); }, 100_000);

  (async () => {
    // Deux dossiers à sauvegarder : des « données d'app » avec un cache à ignorer, et des documents.
    const root = path.dirname(h.dataFile);
    const apps = path.join(root, "source-apps"), docs = path.join(root, "source-documents"), dest = path.join(root, "disque-externe");
    for (const d of [path.join(apps, "rayans-chrono-app"), path.join(apps, "rayans-revision", "Cache"), path.join(docs, "Cours", "Maths"), dest]) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(apps, "rayans-chrono-app", "chrono.json"), JSON.stringify({ projets: ["Mémoire"] }));
    fs.writeFileSync(path.join(apps, "rayans-revision", "Cache", "data_0"), "cache");
    fs.writeFileSync(path.join(docs, "Cours", "Maths", "intégrales é.txt"), "∫ x dx");
    fs.writeFileSync(path.join(docs, "lettre.txt"), "Bonjour");
    h.testHooks.presets = [
      { id: "apps", label: "Données des apps (Rayan's Launcher)", path: apps, enabled: true, files: [], excludeDirs: CACHE_DIRS, preset: true },
      { id: "documents", label: "Documents", path: docs, enabled: true, files: [], excludeDirs: [], preset: true },
      { id: "hifz", label: "Rayan's Hifz", path: path.join(root, "jamais-installe"), enabled: true, files: ["hifz-donnees.json"], excludeDirs: [], preset: true },
      { id: "cle", label: "Clé USB débranchée", path: path.join(root, "absent"), enabled: true, files: [], excludeDirs: [], preset: false },
    ];
    h.reload();

    const w = (await waitFor("fenêtre principale", () => h.getMain()))!;
    await waitFor("écran principal", () => js<boolean>(w, `document.querySelector('[data-testid="derniere"]')?.textContent === "Aucune sauvegarde"`));
    report.uiLoaded = true;
    if (!(await js<boolean>(w, `document.querySelector('[data-testid="sauvegarder"]').disabled`))) throw new Error("bouton actif sans destination");
    step("premier lancement : « Aucune sauvegarde », bouton désactivé tant qu'il n'y a pas de destination");

    h.updateSettings({ destination: dest });
    await waitFor("bouton actif", () => js<boolean>(w, `document.querySelector('[data-testid="sauvegarder"]').disabled === false`), 5000);
    await js(w, `document.querySelector('[data-testid="sauvegarder"]').click()`);
    await waitFor("sauvegarde terminée", () => h.getData().history.length === 1, 60_000);
    const r1 = h.getData().history[0];
    report.premiere = r1;
    const out = path.join(dest, FOLDER);
    const must = [path.join(out, "Données des apps (Rayan's Launcher)", "rayans-chrono-app", "chrono.json"), path.join(out, "Documents", "Cours", "Maths", "intégrales é.txt"), path.join(out, "Documents", "lettre.txt"), path.join(out, "LISEZMOI.txt")];
    for (const f of must) if (!fs.existsSync(f)) throw new Error(`fichier non sauvegardé : ${f}`);
    if (fs.existsSync(path.join(out, "Données des apps (Rayan's Launcher)", "rayans-revision", "Cache"))) throw new Error("le cache a été copié");
    if (!r1.ok || r1.copied !== 3) throw new Error(`première sauvegarde : ${JSON.stringify(r1)}`);
    if (r1.problems.length !== 1 || !r1.problems[0].startsWith("Clé USB débranchée")) throw new Error(`problèmes : ${r1.problems.join(" / ")}`);
    step(`clic sur « Sauvegarder maintenant » : ${r1.copied} fichiers copiés par robocopy (accents compris), cache ignoré, app jamais installée ignorée sans bruit, dossier ajouté absent signalé`);
    await waitFor("date affichée", () => js<boolean>(w, `document.querySelector('[data-testid="derniere"]').textContent.startsWith("aujourd'hui")`), 5000);
    step("« Dernière sauvegarde : aujourd'hui à … » affiché");

    fs.rmSync(path.join(docs, "lettre.txt"));
    fs.writeFileSync(path.join(docs, "nouveau.txt"), "nouveau");
    const r2 = await h.runBackup();
    if (r2.copied !== 1 || r2.skipped !== 2) throw new Error(`deuxième sauvegarde : ${JSON.stringify(r2)}`);
    if (!fs.existsSync(path.join(out, "Documents", "lettre.txt"))) throw new Error("un fichier supprimé ici a été effacé de la sauvegarde (miroir désactivé)");
    step("deuxième sauvegarde : seul le nouveau fichier est copié, le fichier supprimé ici reste dans la sauvegarde");

    h.updateSettings({ mirror: true });
    await h.runBackup();
    if (fs.existsSync(path.join(out, "Documents", "lettre.txt"))) throw new Error("miroir : fichier supprimé toujours présent");
    step("option miroir : le fichier supprimé ici est retiré de la sauvegarde");

    // Rappel : rien avant 7 jours, puis une notification par jour.
    const now = Date.now();
    const at10 = (days: number) => { const d = new Date(now + days * 86_400_000); d.setHours(11, 0, 0, 0); return d.getTime(); };
    h.testHooks.sent.length = 0; // (« Sauvegarde terminée » si la fenêtre n'était pas au premier plan)
    h.testHooks.clock = () => at10(3);
    h.checkReminder();
    if (h.testHooks.sent.length) throw new Error("rappel envoyé après 3 jours");
    h.testHooks.clock = () => at10(8);
    h.checkReminder();
    h.checkReminder();
    if (h.testHooks.sent.length !== 1) throw new Error(`rappel après 8 jours : ${h.testHooks.sent.length} notification(s)`);
    step(`rappel après 8 jours, une seule fois : « ${h.testHooks.sent[0]} »`);
    h.updateSettings({});
    await waitFor("état en retard", () => js<boolean>(w, `document.querySelector('[data-testid="etat"]').classList.contains("en-retard")`), 5000);
    step("bandeau orange « il est temps de sauvegarder »");

    h.testHooks.clock = () => Date.now();
    h.updateSettings({ destination: path.join(root, "disque-debranche") });
    try { await h.runBackup(); throw new Error("sauvegarde lancée vers un disque absent"); }
    catch (e) { if (!String(e).includes("branché")) throw e; }
    step("destination absente : « le disque est-il branché ? »");

    const saved = JSON.parse(fs.readFileSync(h.dataFile, "utf8"));
    if (saved.history?.length !== 3) throw new Error("historique non enregistré");
    const tray = h.getTray();
    if (!tray || tray.isDestroyed()) throw new Error("icône de la zone de notification absente");
    step(`historique enregistré dans ${h.dataFile}, icône de la zone de notification présente`);

    const dir = process.env.SAUVE_CAPTURES;
    if (dir) {
      fs.mkdirSync(dir, { recursive: true });
      h.updateSettings({ destination: dest, mirror: false });
      w.setSize(880, 900);
      w.show();
      try {
        await sleep(700);
        fs.writeFileSync(path.join(dir, "1-sauve.png"), (await w.webContents.capturePage()).toPNG());
        step(`capture d'écran dans ${dir}`);
      } catch (e) { step(`capture impossible (${String(e)})`); }
    }
    report.ok = true;
  })()
    .catch((e) => { report.erreur = String(e?.stack ?? e); })
    .finally(() => { clearTimeout(watchdog); finish(); });
}
