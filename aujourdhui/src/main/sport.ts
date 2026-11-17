// Sport (processus principal) : fichier sport.json (synchronisé avec l'iPhone), séance du jour et créneau selon les
// cours, rappel 30 minutes avant le créneau, actions de la fenêtre.
import { ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { todayISO } from "../core/counts.ts";
import { ajouterPerf, ajuster, enregistrer, importerProfil, ligneSport, nettoyerSport, regler, reglerSemaine, seanceDuJour, SPORT_DEPART, creneau, type Ajustement, type BlocReglage, type Occupation, type Perf, type SeanceFaite, type SportData, type TypeSeance } from "../core/sport.ts";
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
  // Profil de départ privé (charges, perfs), posé à côté des données : importé une fois, puis renommé.
  // Gardé ensuite : si les réglages ont disparu (effacés par une ancienne version pendant une synchro), on le
  // réimporte (sans jamais écraser un réglage existant).
  const profil = path.join(ctx.dataDir, "profil-sport.json");
  const importe = `${profil}.importe`;
  const source = fs.existsSync(profil) ? profil : fs.existsSync(importe) && !Object.keys(data.reglages).length ? importe : null;
  if (source) {
    try {
      const avant = JSON.stringify(data);
      data = importerProfil(data, JSON.parse(fs.readFileSync(source, "utf8")));
      if (JSON.stringify(data) !== avant) save();
      if (source === profil) fs.renameSync(profil, importe);
    } catch (e) { console.error(e); }
  }
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
  h("sport-regler", (bloc, r) => regler(data, String(bloc), (r ?? null) as BlocReglage | null));
  h("sport-semaine", (s) => reglerSemaine(data, (s ?? null) as TypeSeance[] | null));
}

/** Données actuelles et modification (import des activités de la montre). */
export const donneesSport = () => data;
export function modifierSport(next: SportData) { commit(next); }

/** Synchronisation avec l'iPhone. */
export const sportText = () => JSON.stringify(data);
export function applySportText(text: string) { commit(nettoyerSport(JSON.parse(text))); }
