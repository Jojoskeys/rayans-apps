// Pont de synchronisation PC ↔ iPhone (Rayan's Mobile) : les fichiers de données des apps Windows sont fusionnés
// avec le dépôt GitHub privé de Rayan (un fichier JSON par app), avec les mêmes règles de fusion que le téléphone
// (mobile/src/shared/merge.ts). Une app ouverte n'est pas touchée : elle est synchronisée quand elle est fermée.
// Le jeton et la clé sont chiffrés avec la protection du compte Windows (safeStorage) ; le jeton n'est envoyé qu'à
// api.github.com. Chiffrement de bout en bout : tout est chiffré ici (AES-256-GCM, clé tirée de la phrase secrète)
// avant l'envoi ; rien ne part jamais en clair.
import { ipcMain, safeStorage } from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mergeText } from "../../../mobile/src/shared/merge.ts";
import { b64, createKeyFile, decrypt, encrypt, isEncrypted, openKeyFile, unb64 } from "../../../mobile/src/shared/e2e.ts";
import { applyFacText, facText, fetchAde } from "./fac.ts";
import { applyRoutineText, routineText } from "./routine.ts";
import { applyObjectifsText, objectifsText } from "./objectifs.ts";
import { applyBilanText, bilanText } from "./bilan.ts";
import { applySportText, sportText } from "./sport.ts";
import type { SyncView } from "../renderer/api-types.ts";
// @ts-expect-error modules CommonJS de Rayan's Ouvertures, sans types
import R from "../../../echecs-ouvertures/src/core/repertoire.js";
// @ts-expect-error idem
import { createOpenings } from "../../../echecs-ouvertures/src/core/openings.js";
import openingsDb from "../../../echecs-ouvertures/data/openings.json";

interface Adapter {
  name: string;
  label: string;
  /** Exécutable de l'app : si elle est ouverte, on ne touche pas à ses fichiers. */
  exe?: string;
  read(): string | null;
  write(text: string): void;
  /** Publication seule (PC → iPhone), sans fusion. */
  publishOnly?: boolean;
  /** Récupération seule (dépôt → PC), sans fusion ni envoi. */
  fetchOnly?: boolean;
}

interface Ctx { dataDir: string; changed: () => void }
let ctx: Ctx;
let running = false;
let view: SyncView = { configured: false, repo: "", state: "inactif", message: "", lastSync: 0, details: [] };
const roaming = () => process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const local = () => process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const launcherData = (id: string) => path.join(local(), "fr.rayan.launcher", "data", id);

const readFile = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);
function writeFile(f: string, text: string) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (fs.existsSync(f)) fs.copyFileSync(f, `${f}.avant-synchro`);
  fs.writeFileSync(`${f}.tmp`, text);
  fs.renameSync(`${f}.tmp`, f);
}
const cultureActu = () => process.env.CULTURE_ACTU_FILE || path.join(process.env.CULTURE_DATA_DIR || path.join(roaming(), "fr.rayan.culture"), "actu.json");
const firstExisting = (...files: string[]) => files.find((f) => fs.existsSync(f)) ?? files[0];
const fileAdapter = (name: string, label: string, exe: string, file: () => string): Adapter => ({ name, label, exe, read: () => readFile(file()), write: (t) => writeFile(file(), t) });

// ----- Rayan's Ouvertures : réponses aux exercices (fusion) et exercices calculés par le PC (publication) ------
const ouvDir = () => path.join(process.env.RAYANS_OUVERTURES_DATA || path.join(roaming(), "Rayans Ouvertures", "donnees"), "joueurs");
const players = () => (fs.existsSync(ouvDir()) ? fs.readdirSync(ouvDir(), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []);
const readJson = (f: string, fb: unknown) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return fb; } };
let openings: unknown = null;

function publishOuvertures(): string | null {
  const ps = players();
  if (!ps.length) return null;
  openings ??= createOpenings(openingsDb);
  const out: Record<string, unknown> = {};
  for (const u of ps) {
    const dir = path.join(ouvDir(), u);
    const games: Record<string, any>[] = [];
    for (const f of fs.readdirSync(dir)) if (/^parties-.*\.json$/.test(f)) for (const g of readJson(path.join(dir, f), [])) if (g?.id) games.push(g);
    const infos = games.map((g) => R.gameOpening(g, u, openings)).filter(Boolean);
    const analyses = readJson(path.join(dir, "analyses-ouvertures.json"), {});
    const drills = R.buildDrills(infos.map((info: any) => ({ info, analysis: analyses[info.gameId] || null })), openings);
    const states = readJson(path.join(dir, "exercices.json"), {});
    const meta = readJson(path.join(dir, "archives.json"), {});
    out[u] = { username: meta.username || u, drills, repertoire: R.buildRepertoire(infos, analyses, drills, states), games: infos.length, analysed: infos.filter((i: any) => analyses[i.gameId]).length };
  }
  return JSON.stringify({ players: out, publishedAt: Date.now() });
}

const ADAPTERS: Adapter[] = [
  { name: "routine", label: "Ma journée", read: () => routineText(), write: (t) => applyRoutineText(t) },
  { name: "objectifs", label: "Objectifs du jour", read: () => objectifsText(), write: (t) => applyObjectifsText(t) },
  { name: "bilan", label: "Bilan et adhkar", read: () => bilanText(), write: (t) => applyBilanText(t) },
  { name: "sport", label: "Sport", read: () => sportText(), write: (t) => applySportText(t) },
  { name: "fac", label: "Cours de la fac", read: () => facText(), write: (t) => applyFacText(t) },
  fileAdapter("revision", "Révision", "Rayans Revision.exe", () => path.join(process.env.REVISION_DATA_DIR || path.join(roaming(), "fr.rayan.revision"), "revision.json")),
  fileAdapter("memoire", "Mémoire", "Rayans Memoire.exe", () => path.join(process.env.MEMOIRE_DATA_DIR || path.join(roaming(), "fr.rayan.memoire"), "memoire.json")),
  fileAdapter("sommeil", "Sommeil", "Rayans Sommeil.exe", () => path.join(process.env.SOMMEIL_DATA_DIR || path.join(roaming(), "fr.rayan.sommeil"), "sommeil.json")),
  fileAdapter("focus", "Focus", "Rayans Focus.exe", () => path.join(process.env.FOCUS_DATA_DIR || path.join(roaming(), "fr.rayan.focus"), "focus.json")),
  fileAdapter("calcul", "Calcul mental", "Rayans Calcul.exe", () => path.join(process.env.CALCUL_DATA_DIR || path.join(roaming(), "fr.rayan.calcul"), "calcul.json")),
  fileAdapter("calme", "Calme", "Rayans Calme.exe", () => path.join(process.env.CALME_DATA_DIR || path.join(roaming(), "fr.rayan.calme"), "calme.json")),
  fileAdapter("culture", "Culture", "Rayans Culture.exe", () => path.join(process.env.CULTURE_DATA_DIR || path.join(roaming(), "fr.rayan.culture"), "culture.json")),
  // « Ton monde » (écrit par le Veilleur) : seulement récupéré, pour les questions d'actu de Rayan's Culture.
  { name: "actu", label: "Ton monde (pour Culture)", exe: "Rayans Culture.exe", fetchOnly: true, read: () => readFile(cultureActu()), write: (t) => writeFile(cultureActu(), t) },
  fileAdapter("hifz", "Hifz", "Rayans Hifz.exe", () => path.join(process.env.HIFZ_DATA_DIR || path.join(roaming(), "Rayans Hifz"), "hifz-donnees.json")),
  fileAdapter("chrono", "Chrono", "Rayans Chrono.exe", () => firstExisting(path.join(launcherData("rayans-chrono-app"), "chrono.json"), path.join(roaming(), "Rayans Chrono", "chrono.json"))),
  fileAdapter("priere", "Prière", "Rayans Priere.exe", () => firstExisting(path.join(launcherData("rayans-priere"), "priere.json"), path.join(roaming(), "Rayans Priere", "priere.json"))),
  {
    name: "ouvertures", label: "Ouvertures (réponses)", exe: "Rayans Ouvertures.exe",
    read: () => { const ps = players(); return ps.length ? JSON.stringify(Object.fromEntries(ps.map((u) => [u, readJson(path.join(ouvDir(), u, "exercices.json"), {})]))) : null; },
    write: (t) => { for (const [u, st] of Object.entries(JSON.parse(t))) writeFile(path.join(ouvDir(), u, "exercices.json"), JSON.stringify(st)); },
  },
  { name: "ouvertures-donnees", label: "Ouvertures (exercices)", exe: "Rayans Ouvertures.exe", publishOnly: true, read: publishOuvertures, write: () => {} },
];

// ----- Configuration et état -------------------------------------------------------------------------

const cfgFile = () => path.join(ctx.dataDir, "synchro.json");
const stateDir = () => path.join(ctx.dataDir, "synchro-etat");
type Cfg = { repo: string; token: string; key: string };
function loadCfg(): Cfg | null {
  try {
    const c = JSON.parse(fs.readFileSync(cfgFile(), "utf8"));
    if (!c.repo || !c.token || !c.key) return null;
    const open = (v: string) => (c.enc && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(v, "base64")) : v);
    return { repo: c.repo, token: open(c.token), key: open(c.key) };
  } catch { return null; }
}
function saveCfg(c: Cfg) {
  const enc = safeStorage.isEncryptionAvailable();
  const seal = (v: string) => (enc ? safeStorage.encryptString(v).toString("base64") : v);
  fs.mkdirSync(ctx.dataDir, { recursive: true });
  fs.writeFileSync(cfgFile(), JSON.stringify({ repo: c.repo, enc, token: seal(c.token), key: seal(c.key) }));
}
const baseFile = (n: string) => path.join(stateDir(), `${n}.base.json`);

function set(p: Partial<SyncView>) { view = { ...view, ...p, configured: !!loadCfg(), repo: loadCfg()?.repo ?? "" }; ctx.changed(); }
export const syncView = () => view;

// ----- GitHub ------------------------------------------------------------------------------------------

type Access = { repo: string; token: string };
async function gh(cfg: Access, file: string, init: RequestInit = {}, accept = "application/vnd.github+json") {
  return fetch(`https://api.github.com/repos/${cfg.repo}/contents/${file}`, {
    ...init, signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: accept, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "rayans-apps", ...(init.headers ?? {}) },
  });
}
async function pull(cfg: Cfg, name: string): Promise<{ text: string; sha: string; plain: boolean } | null> {
  const r = await pullRaw(cfg, name);
  if (!r) return null;
  if (isEncrypted(r.text)) return { text: await decrypt(unb64(cfg.key), r.text), sha: r.sha, plain: false };
  return { ...r, plain: true };
}
async function pullRaw(cfg: Access, name: string): Promise<{ text: string; sha: string } | null> {
  const r = await gh(cfg, `${name}.json`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "jeton refusé par GitHub" : `GitHub répond ${r.status}`);
  const j = await r.json() as { sha: string; content?: string; encoding?: string };
  if (j.encoding === "base64" && j.content) return { text: Buffer.from(j.content, "base64").toString("utf8"), sha: j.sha };
  const raw = await gh(cfg, `${name}.json`, {}, "application/vnd.github.raw+json");
  if (!raw.ok) throw new Error(`GitHub répond ${raw.status}`);
  return { text: await raw.text(), sha: j.sha };
}
async function push(cfg: Cfg, name: string, text: string, sha: string | null): Promise<"ok" | "conflit"> {
  return pushRaw(cfg, name, await encrypt(unb64(cfg.key), text), sha);
}
async function pushRaw(cfg: Access, name: string, content: string, sha: string | null): Promise<"ok" | "conflit"> {
  const r = await gh(cfg, `${name}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `${name} : synchro du PC`, content: Buffer.from(content).toString("base64"), ...(sha ? { sha } : {}) }) });
  if (r.status === 409 || r.status === 422) return "conflit";
  if (!r.ok) throw new Error(`GitHub répond ${r.status} à l'envoi`);
  return "ok";
}

function runningExes(): Promise<Set<string>> {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve(new Set());
    execFile("tasklist", ["/FO", "CSV", "/NH"], { windowsHide: true }, (err, out) => resolve(new Set(err ? [] : out.split(/\r?\n/).map((l) => l.split('","')[0].replace(/^"/, "").toLowerCase()))));
  });
}

/** Une passe de synchronisation de toutes les apps. */
export async function syncAll(reason = "") {
  const cfg = loadCfg();
  if (!cfg || running) return;
  running = true;
  set({ state: "en-cours", message: `Synchronisation${reason ? ` (${reason})` : ""}…` });
  const details: SyncView["details"] = [];
  try {
    // Les cours vus sur l'iPhone viennent du PC : on rafraîchit ADE au plus une fois par heure avant d'envoyer.
    await fetchAde(false, 60 * 60_000).catch(() => {});
    const open = await runningExes();
    fs.mkdirSync(stateDir(), { recursive: true });
    for (const a of ADAPTERS) {
      if (a.exe && open.has(a.exe.toLowerCase())) { details.push({ name: a.label, result: "app ouverte : synchronisée après fermeture" }); continue; }
      try {
        const cur = a.read();
        if (a.publishOnly) {
          if (cur === null) { details.push({ name: a.label, result: "rien à publier" }); continue; }
          const remote = await pull(cfg, a.name);
          await push(cfg, a.name, cur, remote?.sha ?? null);
          details.push({ name: a.label, result: "publié" });
          continue;
        }
        if (a.fetchOnly) {
          const remote = await pull(cfg, a.name);
          if (!remote) { details.push({ name: a.label, result: "rien à récupérer" }); continue; }
          if (remote.text !== cur) a.write(remote.text);
          details.push({ name: a.label, result: remote.text !== cur ? "récupéré" : "à jour" });
          continue;
        }
        let done = false;
        for (let i = 0; i < 3 && !done; i++) {
          const remote = await pull(cfg, a.name);
          const base = readFile(baseFile(a.name));
          const now = a.read();
          const merged = mergeText(a.name, base, now, remote?.text ?? null);
          if (merged === null) { details.push({ name: a.label, result: "aucune donnée" }); done = true; break; }
          if (merged !== now) a.write(merged);
          if (!remote || remote.plain || merged !== remote.text) {
            if ((await push(cfg, a.name, merged, remote?.sha ?? null)) === "conflit") continue;
          }
          fs.writeFileSync(baseFile(a.name), merged);
          details.push({ name: a.label, result: merged !== now ? "mis à jour depuis l'iPhone" : remote && !remote.plain && merged === remote.text ? "à jour" : "envoyé (chiffré)" });
          done = true;
        }
        if (!done) details.push({ name: a.label, result: "conflits répétés, réessai plus tard" });
      } catch (e) {
        details.push({ name: a.label, result: `erreur : ${String((e as Error).message ?? e)}` });
      }
    }
    const errors = details.filter((d) => d.result.startsWith("erreur"));
    set({ state: errors.length ? "erreur" : "a-jour", message: errors.length ? errors[0].result : "À jour", lastSync: Date.now(), details });
  } catch (e) {
    set({ state: "erreur", message: String((e as Error).message ?? e), details });
  } finally {
    running = false;
  }
}

async function testRepo(repo: string, token: string) {
  const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "rayans-apps" }, signal: AbortSignal.timeout(20_000) });
  if (r.status === 404) throw new Error("dépôt introuvable (nom faux, ou jeton sans accès à ce dépôt)");
  if (r.status === 401) throw new Error("jeton invalide ou expiré");
  if (!r.ok) throw new Error(`GitHub répond ${r.status}`);
  const j = await r.json() as { private: boolean; permissions?: { push: boolean } };
  if (!j.private) throw new Error("ce dépôt est public : tes données seraient visibles par tout le monde. Rends-le privé.");
  if (j.permissions && !j.permissions.push) throw new Error("le jeton ne permet pas d'écrire dans ce dépôt");
}

export function setupSync(c: Ctx) {
  ctx = c;
  set({});
  ipcMain.handle("synchro-config", async (_e, repo: string, token: string, phrase: string) => {
    const r = String(repo ?? "").trim();
    const t = String(token ?? "").trim() || loadCfg()?.token || "";
    await testRepo(r, t);
    const p = String(phrase ?? "");
    let key = loadCfg()?.key ?? "";
    if (p) {
      if (p.trim().length < 12) throw new Error("phrase secrète trop courte (12 caractères au moins ; plusieurs mots, c'est mieux)");
      const existing = await pullRaw({ repo: r, token: t }, "cle");
      if (existing) key = b64(await openKeyFile(p, existing.text));
      else { const k = await createKeyFile(p); await pushRaw({ repo: r, token: t }, "cle", k.file, null); key = b64(k.raw); }
    }
    if (!key) throw new Error("tape ta phrase secrète");
    saveCfg({ repo: r, token: t, key });
    set({});
    void syncAll("configuration");
    return view;
  });
  ipcMain.handle("synchro-maintenant", async () => { await syncAll("demandée"); return view; });
  ipcMain.handle("synchro-oublier", () => { try { fs.rmSync(cfgFile()); } catch { /* */ } set({ state: "inactif", message: "", details: [] }); return view; });
  // Au démarrage (un peu après), puis toutes les 15 minutes.
  setTimeout(() => void syncAll("démarrage"), 20_000);
  setInterval(() => void syncAll(), 15 * 60_000);
}
