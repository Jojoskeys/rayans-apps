// Fac (processus principal) : téléchargement de l'abonnement ADE, fichier fac.json, mails partagés.
// L'emploi du temps est téléchargé à l'ouverture de la fenêtre (au plus une fois toutes les 15 minutes) et sur demande ;
// rien ne tourne quand l'application est fermée. Aucun mot de passe : l'URL ADE suffit, et les mails sont partagés à la main.
import { clipboard, ipcMain, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { checkIcsUrl, maskUrl, parseIcs } from "../core/ics.ts";
import { parseMailInput } from "../core/mail.ts";
import {
  acceptProposal, addMail, applyFetch, displayCourses, EMPTY_FAC, ignoreProposal, prune, removeDeadline, removedCourses,
  removeMail, removeOverride, resolveConflict, sanitizeFac, type FacData,
} from "../core/fac.ts";
import type { FacView } from "../renderer/api-types.ts";

export const WEBMAIL_URL = "https://partage.univ-rennes.fr/";
const MIN_INTERVAL = 15 * 60_000;
const MAX_BYTES = 8 * 1024 * 1024;
const DAY = 86_400_000;

interface Ctx {
  dataDir: string;
  clock: () => number;
  /** Remplacé par le test de lancement : pas de réseau. */
  fetchText: (url: string) => Promise<string>;
  changed: () => void;
}

let ctx: Ctx;
let data: FacData = { ...EMPTY_FAC };
let fetching = false;
const file = () => path.join(ctx.dataDir, "fac.json");

export async function defaultFetch(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: "follow", headers: { Accept: "text/calendar, */*;q=0.5" } });
  if (!res.ok) throw new Error(`le serveur ADE répond ${res.status}`);
  const len = Number(res.headers.get("content-length"));
  if (len > MAX_BYTES) throw new Error("fichier trop gros");
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("fichier trop gros");
  return text;
}

function load() {
  try { data = sanitizeFac(JSON.parse(fs.readFileSync(file(), "utf8"))); } catch { data = { ...EMPTY_FAC }; }
}
function save() {
  fs.mkdirSync(ctx.dataDir, { recursive: true });
  const tmp = `${file()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file());
}
function commit(next: FacData) {
  data = prune(next, ctx.clock());
  try { save(); } catch (e) { console.error(e); }
  ctx.changed();
}

/** Télécharge l'emploi du temps si l'adresse est réglée et que le dernier essai date de plus de 15 minutes. */
export async function fetchAde(force = false): Promise<void> {
  const now = ctx.clock();
  if (!data.icsUrl || fetching) return;
  if (!force && now - data.lastFetch < MIN_INTERVAL) return;
  fetching = true;
  ctx.changed();
  try {
    const courses = parseIcs(await ctx.fetchText(data.icsUrl));
    commit(applyFetch(data, courses, ctx.clock()));
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    commit({ ...data, lastFetch: now, lastError: /abort|timeout/i.test(msg) ? "pas de réponse d'ADE (délai dépassé)" : /fetch failed|ENOTFOUND|ECONN/i.test(msg) ? "pas de connexion à ADE" : msg });
  } finally {
    fetching = false;
    ctx.changed();
  }
}

export function facView(): FacView {
  const now = ctx.clock();
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return {
    configured: !!data.icsUrl,
    url: data.icsUrl ? maskUrl(data.icsUrl) : "",
    lastFetch: data.lastFetch,
    lastError: data.lastError,
    fetching,
    // Aujourd'hui et les 7 jours suivants : de quoi trouver la prochaine journée de cours.
    courses: displayCourses(data).filter((c) => c.end > start && c.start < start + 8 * DAY),
    removed: removedCourses(data).filter((c) => c.start > start && c.start < start + 8 * DAY),
    mails: data.mails,
    deadlines: data.deadlines,
    allowedSenders: data.allowedSenders,
    groups: data.groups,
    // Les groupes cités dans au moins 3 cours (le reste est surtout des notes de l'administration).
    availableGroups: data.availableGroups.filter((g) => g.count >= 3 || data.groups.includes(g.name)),
    webmail: WEBMAIL_URL,
  };
}

export function setupFac(c: Ctx) {
  ctx = c;
  load();
  const h = <A extends unknown[]>(name: string, fn: (...a: A) => FacData | void | Promise<unknown>) =>
    ipcMain.handle(name, async (_e, ...a: unknown[]) => { const r = await fn(...(a as A)); if (r && typeof r === "object" && "courses" in r) commit(r as FacData); return facView(); });

  h("fac-url", async (raw: string) => {
    if (!raw.trim()) { commit({ ...data, icsUrl: "" }); return; }
    const url = checkIcsUrl(String(raw));
    const courses = parseIcs(await ctx.fetchText(url)); // on vérifie avant d'enregistrer
    commit(applyFetch({ ...data, icsUrl: url, courses: data.icsUrl === url ? data.courses : [], changes: data.icsUrl === url ? data.changes : [] }, courses, ctx.clock()));
  });
  h("fac-actualiser", () => fetchAde(true));
  h("fac-mail", (text: string) => {
    const mail = parseMailInput(String(text).slice(0, 2_000_000));
    return addMail(data, mail, ctx.clock()).data;
  });
  h("fac-valider", (mailId: string, id: string) => acceptProposal(data, mailId, id));
  h("fac-ignorer", (mailId: string, id: string) => ignoreProposal(data, mailId, id));
  h("fac-annuler-correction", (uid: string) => removeOverride(data, uid));
  h("fac-conflit", (uid: string, keep: "ade" | "mail") => resolveConflict(data, uid, keep === "mail" ? "mail" : "ade"));
  h("fac-supprimer-echeance", (id: string) => removeDeadline(data, id));
  h("fac-supprimer-mail", (id: string) => removeMail(data, id));
  h("fac-expediteurs", (list: string[]) => ({ ...data, allowedSenders: [...new Set((Array.isArray(list) ? list : []).map((s) => String(s).trim().toLowerCase()).filter(Boolean))] }));
  h("fac-groupes", async (list: string[]) => {
    const groups = [...new Set((Array.isArray(list) ? list : []).map((s) => String(s).trim()).filter(Boolean))];
    // Nouveau filtre : on repart d'un emploi du temps vierge pour ne pas signaler de faux ajouts ou retraits.
    commit({ ...data, groups, courses: [], changes: [], lastFetch: 0 });
    await fetchAde(true);
  });
  h("fac-oublier", () => ({ ...EMPTY_FAC }));
  ipcMain.handle("fac-webmail", (_e, subject: unknown) => {
    // Le webmail ne permet pas d'ouvrir un message par lien direct : l'objet est copié pour la recherche.
    if (typeof subject === "string" && subject) clipboard.writeText(subject);
    return shell.openExternal(WEBMAIL_URL);
  });
}

/** Pour le test de lancement. */
export const facInternals = { get data() { return data; }, file };
