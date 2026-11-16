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
  testHooks: { clock: () => number; paths: Record<SourceId, string>; sent: string[]; fetchText: (url: string) => Promise<string> };
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

/** Faux flux ADE du jour : TD Analyse 10 h 15 dans `room`, CM 14 h, et un TD demain. */
function adeFixture(day: Date, room: string) {
  const z = (dd: number, h: number, m = 0) => new Date(day.getFullYear(), day.getMonth(), day.getDate() + dd, h, m).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ev = (uid: string, a: string, b: string, t: string, l: string) => `BEGIN:VEVENT\r\nDTSTART:${a}\r\nDTEND:${b}\r\nSUMMARY:${t}\r\nLOCATION:${l}\r\nDESCRIPTION:\\nL3 Info TD2\\nDUPONT Marie\\n(Exporté le:${a})\r\nUID:${uid}\r\nEND:VEVENT\r\n`;
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${ev("ADE-1", z(0, 10, 15), z(0, 12, 15), "TD Analyse", room)}${ev("ADE-2", z(0, 14), z(0, 16), "CM Programmation fonctionnelle", "Amphi B")}${ev("ADE-3", z(1, 9), z(1, 11), "TD Anglais", "Salle 110")}END:VCALENDAR\r\n`;
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
    const dir = process.env.AUJOURDHUI_CAPTURES;
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

    // ----- Fac : l'exemple validé avec Rayan (changement de salle annoncé par mail) -----
    h.testHooks.clock = () => at(8, 2);
    let room = "B12";
    const fetched: string[] = [];
    h.testHooks.fetchText = async (u) => { fetched.push(u); return adeFixture(d, room); };
    h.refresh();
    await waitFor("invitation à relier ADE", () => js<boolean>(w, `!!document.querySelector('[data-testid="fac-a-configurer"]')`), 5000);
    await js(w, `window.aujourdhui.fac.setUrl("https://planning.univ-rennes1.fr/jsp/custom/modules/plannings/test.shu")`);
    await waitFor("cours affichés", async () => (await js<number>(w, `document.querySelectorAll('[data-testid="cours"]').length`)) === 2, 5000);
    const salle = () => js<string>(w, `document.querySelector('[data-uid="ADE-1"] [data-testid="salle"]').textContent`);
    if ((await salle()) !== "B12") throw new Error(`salle affichée : ${await salle()}`);
    const facFile = path.join(path.dirname(h.dataFile), "fac.json");
    if (!fs.readFileSync(facFile, "utf8").includes("test.shu")) throw new Error("adresse ADE non enregistrée");
    if ((await js<string>(w, "document.body.innerText")).includes("test.shu")) throw new Error("adresse ADE affichée en entier");
    step(`ADE relié : 2 cours aujourd'hui, TD Analyse en B12 (« ${await text(w, '[data-testid="fac-statut"]')} »)`);

    await js(w, `document.querySelector('[data-testid="bouton-ajouter-mail"]').click()`);
    const mail = "De : Secrétariat L3 Informatique <secretariat-l3info@univ-rennes.fr>\nObjet : TD Analyse - changement de salle\n\nBonjour,\n\nLe TD d'analyse de ce matin à 10h15 aura lieu en salle 004 du bâtiment 14 au lieu de la salle B12.\n\nCordialement";
    await js(w, `window.aujourdhui.fac.addMail(${JSON.stringify(mail)})`);
    await waitFor("proposition affichée", () => js<boolean>(w, `!!document.querySelector('[data-testid="proposition"][data-kind="salle"]')`), 5000);
    if ((await salle()) !== "B12") throw new Error("salle changée avant validation");
    const prop = await text(w, '[data-testid="proposition"]');
    if (!prop.includes("B12") || !prop.includes("Salle 004 (bât. 14)")) throw new Error(`proposition : ${prop}`);
    step(`mail partagé → proposition à valider, rien n'est encore modifié : « ${prop.slice(0, 140)} »`);
    if (dir) { fs.mkdirSync(dir, { recursive: true }); w.show(); await sleep(600); fs.writeFileSync(path.join(dir, "2-fac-a-valider.png"), (await w.webContents.capturePage()).toPNG()); }

    await js(w, `document.querySelector('[data-testid="appliquer"]').click()`);
    await waitFor("salle corrigée", async () => (await salle()) === "Salle 004 (bât. 14)", 5000);
    const badge = await text(w, '[data-uid="ADE-1"] [data-testid="correction"]');
    if (!badge.includes("ADE : B12")) throw new Error(`badge : ${badge}`);
    step(`validé → « Salle 004 (bât. 14) », badge « ${badge.trim()} »`);
    await js(w, `[...document.querySelectorAll('[data-uid="ADE-1"] button.lien')].find(b => b.textContent === "Voir le mail").click()`);
    await waitFor("source du mail", () => js<boolean>(w, `!!document.querySelector('[data-testid="source-mail"]')`), 5000);
    const extrait = await text(w, '[data-testid="extrait"]');
    if (!extrait.includes("salle 004")) throw new Error(`extrait : ${extrait}`);
    if (fs.readFileSync(facFile, "utf8").includes("Cordialement")) throw new Error("texte complet du mail gardé");
    step(`source : extrait « ${extrait} » ; le texte complet n'est pas gardé`);
    if (dir) { await sleep(300); fs.writeFileSync(path.join(dir, "3-fac-source.png"), (await w.webContents.capturePage()).toPNG()); }
    await js(w, `document.querySelector('.voile').click()`);

    // ADE se met à jour (avec sa propre écriture de la salle) : la correction disparaît, le changement est signalé.
    room = "B14-004";
    await js(w, `window.aujourdhui.fac.refresh()`);
    await waitFor("ADE à jour", async () => (await salle()) === "B14-004", 5000);
    if (await js<boolean>(w, `!!document.querySelector('[data-uid="ADE-1"] [data-testid="correction"]')`)) throw new Error("correction restée après la mise à jour d'ADE");
    const chg = await text(w, '[data-uid="ADE-1"] [data-testid="changement"]');
    if (!chg.includes("B12 → B14-004")) throw new Error(`changement : ${chg}`);
    step(`ADE mis à jour → correction retirée d'elle-même, badge « ${chg} »`);
    // À l'ouverture de la fenêtre : pas plus d'un téléchargement toutes les 15 minutes.
    const n = fetched.length;
    w.emit("focus");
    await sleep(300);
    if (fetched.length !== n) throw new Error("ADE retéléchargé moins de 15 minutes après");
    h.testHooks.clock = () => at(8, 20);
    w.emit("focus");
    await waitFor("téléchargement à l'ouverture", () => fetched.length === n + 1, 5000);
    step("fenêtre ouverte : ADE retéléchargé seulement après 15 minutes");
    if (dir) { await sleep(400); fs.writeFileSync(path.join(dir, "4-fac-ade-a-jour.png"), (await w.webContents.capturePage()).toPNG()); }

    // ----- Routine : tâche ajoutée depuis la fenêtre, rappel à l'heure une seule fois, case cochée -----
    await js(w, `document.querySelector('[data-testid="gerer-routine"]').click()`);
    await waitFor("édition de la routine", () => js<boolean>(w, `!!document.querySelector('[data-testid="routine-edition"]')`), 5000);
    await js(w, `window.aujourdhui.routine.add("30 min de sport", "08:30", [0,1,2,3,4,5,6])`);
    await js(w, `window.aujourdhui.routine.add("Lire 20 pages", "", [0,1,2,3,4,5,6])`);
    if (!fs.readFileSync(path.join(path.dirname(h.dataFile), "routine.json"), "utf8").includes("30 min de sport")) throw new Error("routine non enregistrée");
    const avant = h.testHooks.sent.length;
    h.testHooks.clock = () => at(8, 31);
    h.refresh();
    h.refresh();
    const rappels = h.testHooks.sent.slice(avant);
    if (rappels.length !== 1 || !rappels[0].includes("Rappel : 30 min de sport")) throw new Error(`rappels : ${JSON.stringify(rappels)}`);
    await js(w, `document.querySelector('[data-testid="gerer-routine"]').click()`);
    await waitFor("tâches du jour", async () => (await js<number>(w, `document.querySelectorAll('[data-testid="tache"]').length`)) === 2, 5000);
    await js(w, `document.querySelector('[data-testid="tache"] input').click()`);
    await waitFor("tâche cochée", () => js<boolean>(w, `document.querySelector('[data-testid="tache"]').classList.contains("fait")`), 5000);
    step(`routine : 2 tâches, rappel « ${rappels[0]} » envoyé une fois, case cochée`);
    if (dir) { await sleep(400); fs.writeFileSync(path.join(dir, "6-routine.png"), (await w.webContents.capturePage()).toPNG()); }

    await js(w, `document.querySelector('[data-testid="bouton-reglages"]').click()`);
    await waitFor("réglages", () => js<boolean>(w, `!!document.querySelector('[data-testid="reglages"]')`), 5000);
    const reglagesFac = await text(w, '[data-testid="reglages-fac"]');
    if (!reglagesFac.includes("planning.univ-rennes1.fr/…") || reglagesFac.includes("test.shu")) throw new Error("réglages Fac : adresse mal affichée");
    step("réglages Fac : adresse ADE raccourcie, expéditeurs, données gardées");
    const groupes = await text(w, '[data-testid="groupes"]');
    if (!groupes.includes("L3 Info TD2") || groupes.includes("DUPONT")) throw new Error(`groupes proposés : ${groupes}`);
    const v = await js<{ courses: unknown[]; groups: string[] }>(w, `window.aujourdhui.fac.setGroups(["L3 Info TD2"])`);
    if (v.groups[0] !== "L3 Info TD2" || v.courses.length !== 3) throw new Error(`filtre par groupe : ${v.courses.length} cours`);
    step("groupes : « L3 Info TD2 » proposé (pas l'enseignant), filtre enregistré, 3 cours gardés");
    if (dir) { await sleep(400); fs.writeFileSync(path.join(dir, "5-reglages-fac.png"), (await w.webContents.capturePage()).toPNG()); }
    h.updateSettings({ reminderHour: 20, reminderMinute: 30 });
    await waitFor("heure du rappel", () => js<boolean>(w, `document.querySelector('input[type=time]').value === "20:30"`), 5000);
    const saved = JSON.parse(fs.readFileSync(h.dataFile, "utf8"));
    if (saved.settings?.reminderHour !== 20) throw new Error("réglages non enregistrés");
    step(`réglages : rappel à 20:30, enregistré dans ${h.dataFile}`);

    const tray = h.getTray();
    if (!tray || tray.isDestroyed()) throw new Error("icône de la zone de notification absente");
    step("icône de la zone de notification présente");

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
