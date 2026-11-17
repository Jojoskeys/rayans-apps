// Bilan quotidien et adhkar (processus principal) : fichier bilan.json, heures de prière lues dans Rayan's Prière,
// notifications vérifiées chaque minute, actions de la fenêtre.
import { ipcMain } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { todayISO } from "../core/counts.ts";
import { aRemplir, BILAN_VIDE, cocherAdhkar, cocherPrevu, moments, nettoyerBilan, notificationsBilan, noterMatin, noterSoir, reglerBilan, type BilanData, type Prieres, type ReglagesBilan } from "../core/bilan.ts";
import { heuresDePriere } from "../core/prieres.ts";
import { citationsDuJour } from "../core/citations.ts";
import type { BilanView } from "../renderer/api-types.ts";

interface Ctx {
  dataDir: string;
  clock: () => number;
  notify: (title: string, body: string) => void;
  changed: () => void;
  /** Objectifs du jour, ajoutés au rappel du matin. */
  objectifs: () => string[];
}

let ctx: Ctx;
let data: BilanData = BILAN_VIDE;
const file = () => path.join(ctx.dataDir, "bilan.json");

/** Réglages de Rayan's Prière (seulement lus) : lieu et méthode de calcul. */
export function priereFile(): string {
  if (process.env.PRIERE_DATA_FILE) return process.env.PRIERE_DATA_FILE;
  const c = [
    path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "fr.rayan.launcher", "data", "rayans-priere", "priere.json"),
    path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Rayans Priere", "priere.json"),
  ];
  return c.filter((f) => fs.existsSync(f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || c[0];
}

function prieres(now: number): Prieres | null {
  try { return heuresDePriere(JSON.parse(fs.readFileSync(priereFile(), "utf8")), now); } catch { return null; }
}

function load() {
  try { data = nettoyerBilan(JSON.parse(fs.readFileSync(file(), "utf8"))); } catch { data = { ...BILAN_VIDE, jours: {}, envoyes: [] }; }
}
function save() {
  fs.mkdirSync(ctx.dataDir, { recursive: true });
  const tmp = `${file()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file());
}
function commit(next: BilanData) {
  if (next === data) return;
  data = next;
  try { save(); } catch (e) { console.error(e); }
}

export const adhkarSuivis = () => data.reglages.adhkar;
export const matinActif = () => data.reglages.actif || data.reglages.adhkar;

/** Appelé chaque minute : notifications du matin (après Fajr), des adhkar du soir et du bilan du soir. */
export function checkBilan() {
  const now = ctx.clock();
  const { data: next, messages } = notificationsBilan(data, now, prieres(now));
  commit(next);
  for (const m of messages) {
    const o = m.titre.startsWith("Bonjour") ? ctx.objectifs() : [];
    ctx.notify(m.titre, o.length ? `${m.corps}\nObjectifs : ${o.join(" · ")}` : m.corps);
  }
}

export function bilanView(): BilanView {
  const now = ctx.clock();
  const p = prieres(now);
  const jour = todayISO(now);
  const historique = Object.entries(data.jours)
    .filter(([k, j]) => k <= jour && (j.matin || j.soir))
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 14)
    .map(([k, j]) => ({ jour: k, matin: j.matin ?? null, soir: j.soir ?? null }));
  return {
    jour,
    aujourdhui: data.jours[jour] ?? {},
    demain: data.jours[todayISO(now + 86_400_000)]?.prevu ?? [],
    aRemplir: aRemplir(data, now, p),
    moments: moments(data, now, p),
    prieres: p,
    reglages: data.reglages,
    historique,
    citations: citationsDuJour(jour),
  };
}

/** Pour la synchronisation avec l'iPhone : texte actuel, et remplacement par la version fusionnée. */
export const bilanText = () => JSON.stringify(data);
export function applyBilanText(text: string) { commit(nettoyerBilan(JSON.parse(text))); ctx.changed(); }

export function setupBilan(c: Ctx) {
  ctx = c;
  load();
  const h = (name: string, fn: (...a: unknown[]) => BilanData) =>
    ipcMain.handle(name, (_e, ...a: unknown[]) => { commit(fn(...a)); ctx.changed(); return bilanView(); });
  h("bilan-matin", (humeur, ressenti) => noterMatin(data, ctx.clock(), Number(humeur), String(ressenti ?? "")));
  h("bilan-soir", (humeur, journee, ressenti, demain) =>
    noterSoir(data, ctx.clock(), Number(humeur), String(journee ?? ""), String(ressenti ?? ""), Array.isArray(demain) ? demain.map(String) : []));
  h("bilan-prevu", (id) => cocherPrevu(data, ctx.clock(), String(id)));
  h("bilan-adhkar", (quand) => cocherAdhkar(data, ctx.clock(), quand === "masa" ? "masa" : "sabah"));
  h("bilan-reglages", (r) => reglerBilan(data, (r ?? {}) as Partial<ReglagesBilan>));
}
