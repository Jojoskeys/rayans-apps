// Objectifs du jour (processus principal) : fichier objectifs.json, mesures lues dans les autres apps,
// notifications du matin et du soir, actions de la fenêtre.
import { ipcMain } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SourceCount } from "../core/counts.ts";
import { mesures } from "../core/mesures.ts";
import { avancement, catalogue, changer, cocher, journee, nettoyerObjectifs, notificationsDues, OBJECTIFS_VIDES, preparer, reglerObjectifs, saisir, serie, type Mesures, type ObjectifsData, type Reglages } from "../core/objectifs.ts";
import type { ObjectifsView } from "../renderer/api-types.ts";

interface Ctx {
  dataDir: string;
  clock: () => number;
  notify: (title: string, body: string) => void;
  changed: () => void;
  counts: () => SourceCount[];
  revisionFile: () => string;
  /** Les adhkar ont leurs propres rappels (bilan) : pas d'objectif « adhkar » en double. */
  adhkarSuivis: () => boolean;
  /** Le rappel d'après Fajr (bilan) donne déjà la liste du matin. */
  matinParBilan: () => boolean;
  reminder: () => { on: boolean; h: number; m: number };
}

let ctx: Ctx;
let data: ObjectifsData = OBJECTIFS_VIDES;
let m: Mesures = {};
const file = () => path.join(ctx.dataDir, "objectifs.json");
const local = () => process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const roaming = () => process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");

/** Fichiers lus (seulement lus) pour les mesures. */
export function objectifsSources() {
  const chrono = [
    path.join(local(), "fr.rayan.launcher", "data", "rayans-chrono-app", "chrono.json"),
    path.join(roaming(), "Rayans Chrono", "chrono.json"),
  ];
  return {
    chrono: process.env.CHRONO_DATA_FILE || chrono.filter((f) => fs.existsSync(f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || chrono[0],
    journal: path.join(process.env.JOURNAL_DATA_DIR || path.join(local(), "Rayan's Journal"), "resume-quotidien.json"),
  };
}

const lire = (f: string) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return undefined; } };

function load() {
  try { data = nettoyerObjectifs(JSON.parse(fs.readFileSync(file(), "utf8"))); } catch { data = { ...OBJECTIFS_VIDES }; }
}
function save() {
  fs.mkdirSync(ctx.dataDir, { recursive: true });
  const tmp = `${file()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file());
}
function commit(next: ObjectifsData) {
  if (next === data) return;
  data = next;
  try { save(); } catch (e) { console.error(e); }
}

/** Relit les mesures, prépare la journée, envoie les notifications dues. Appelé chaque minute. */
export function checkObjectifs() {
  const now = ctx.clock();
  const s = objectifsSources();
  m = { ...mesures({ revision: lire(ctx.revisionFile()), chrono: lire(s.chrono), journal: lire(s.journal), sport: lire(path.join(ctx.dataDir, "sport.json")), counts: ctx.counts() }), sansAdhkar: ctx.adhkarSuivis() };
  commit(preparer(data, m, now));
  const r = ctx.reminder();
  const { data: next, messages } = notificationsDues(data, m, now, r.h, r.m, ctx.matinParBilan());
  commit(next);
  for (const x of messages) ctx.notify(x.titre, x.corps);
}

/** Titres des objectifs du jour (pour le rappel du matin). */
export const titresDuJour = () => (data.jours[journee(ctx.clock())] ?? []).map((o) => o.titre);

export function objectifsView(): ObjectifsView {
  const now = ctx.clock();
  const jour = journee(now);
  const s = objectifsSources();
  return {
    jour,
    objectifs: (data.jours[jour] ?? []).map((o) => ({ ...o, avancement: avancement(o, m, jour, false) })),
    serie: serie(data, m, now),
    reglages: data.reglages,
    catalogue: catalogue(data),
    sources: { journal: fs.existsSync(s.journal), chrono: !!m.chronoMin, revision: !!m.revisionCartes },
  };
}

/** Pour la synchronisation avec l'iPhone : texte actuel, et remplacement par la version fusionnée. */
export const objectifsText = () => JSON.stringify(data);
export function applyObjectifsText(text: string) { commit(nettoyerObjectifs(JSON.parse(text))); ctx.changed(); }

export function setupObjectifs(c: Ctx) {
  ctx = c;
  load();
  const h = (name: string, fn: (...a: unknown[]) => ObjectifsData) =>
    ipcMain.handle(name, (_e, ...a: unknown[]) => { commit(fn(...a)); ctx.changed(); return objectifsView(); });
  h("objectif-cocher", (id) => cocher(data, String(id), ctx.clock()));
  h("objectif-changer", (id) => changer(data, m, String(id), ctx.clock()));
  h("objectif-saisir", (id, total) => saisir(data, m, String(id), Number(total), ctx.clock()));
  // Nouveaux réglages : la liste du jour est complétée ou réduite (cases cochées et compteurs gardés).
  h("objectifs-reglages", (r) => preparer(reglerObjectifs(data, (r ?? {}) as Partial<Reglages>), m, ctx.clock()));
}
