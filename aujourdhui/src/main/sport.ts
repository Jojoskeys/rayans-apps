// Sport (processus principal) : fichier sport.json (synchronisé avec l'iPhone), séance du jour et créneau selon les
// cours, rappel 30 minutes avant le créneau, actions de la fenêtre.
import { ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { todayISO } from "../core/counts.ts";
import { ajouterPerf, ajuster, enregistrer, ligneSport, nettoyerSport, seanceDuJour, SPORT_DEPART, creneau, type Ajustement, type Occupation, type Perf, type SeanceFaite, type SportData } from "../core/sport.ts";
import { sportView, type SportView } from "../core/sportvue.ts";

interface Ctx {
  dataDir: string;
  clock: () => number;
  notify: (title: string, body: string) => void;
  changed: () => void;
  cours: () => Occupation[];
}

let ctx: Ctx;
let data: SportData = SPORT_DEPART;
let envoyes = new Set<string>();
const file = () => path.join(ctx.dataDir, "sport.json");

function load() {
  try { data = nettoyerSport(JSON.parse(fs.readFileSync(file(), "utf8"))); } catch { data = { ...SPORT_DEPART }; }
}
function save() {
  fs.mkdirSync(ctx.dataDir, { recursive: true });
  const tmp = `${file()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file());
}
function commit(next: SportData) {
  data = next;
  try { save(); } catch (e) { console.error(e); }
  ctx.changed();
}

export const view = (): SportView => sportView(data, ctx.cours(), ctx.clock());
export const sportDuJour = () => ligneSport(data, todayISO(ctx.clock()), ctx.cours(), ctx.clock());

/** Chaque minute : rappel 30 minutes avant le créneau de la séance du jour (une fois). */
export function checkSport() {
  const now = ctx.clock();
  const jour = todayISO(now);
  const s = seanceDuJour(data, jour, now);
  if (s.type === "repos" || s.faite || envoyes.has(jour)) return;
  const c = creneau(jour, s.dureeMin, ctx.cours());
  if (!c || now < c.debut - 30 * 60_000 || now > c.debut + 30 * 60_000) return;
  envoyes.add(jour);
  const hm = new Date(c.debut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  ctx.notify(`Séance à ${hm} : ${s.titre}`, s.course ? s.course.etapes.slice(0, 2).join("\n") : s.blocs.filter((b) => b.ex !== "echauffement-epaule").slice(0, 3).map((b) => `${b.nom} : ${b.series} × ${b.mode === "plage" ? `${b.plage![0]}-${b.plage![1]}` : b.prescription.reps}${b.prescription.charge ? ` à ${b.prescription.charge} kg` : ""}`).join("\n"));
}

export function setupSport(c: Ctx) {
  ctx = c;
  load();
  const h = (name: string, fn: (...a: unknown[]) => SportData) =>
    ipcMain.handle(name, (_e, ...a: unknown[]) => { commit(fn(...a)); return view(); });
  h("sport-enregistrer", (s) => enregistrer(data, s as SeanceFaite));
  h("sport-perf", (p) => ajouterPerf(data, p as Perf));
  h("sport-ajuster", (a) => ajuster(data, a as Ajustement));
}

/** Synchronisation avec l'iPhone. */
export const sportText = () => JSON.stringify(data);
export function applySportText(text: string) { commit(nettoyerSport(JSON.parse(text))); }
