// Rayan's Aujourd'hui sur l'iPhone : l'interface de l'app Windows, branchée sur un « faux processus principal »
// qui travaille sur les données synchronisées (routine, fac) au lieu des fichiers du PC.
// Ce qui reste propre au PC : le téléchargement d'ADE (le serveur de la fac refuse les autres sites ; le PC publie
// l'emploi du temps dans la synchro), les notifications Windows et le démarrage avec Windows.
import "../shared/sync.ts";
import { store } from "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import { hifzCount, hifzDetail, ouverturesCount, ouverturesDetail, revisionCount, revisionDetail, todayISO, type SourceCount, type SourceId } from "../../../aujourdhui/src/core/counts.ts";
import { addItem, EMPTY_ROUTINE, isDone, itemsForDay, removeItem, sanitizeRoutine, streak, toggleDone, updateItem, type RoutineData } from "../../../aujourdhui/src/core/routine.ts";
import {
  acceptProposal, addMail, displayCourses, EMPTY_FAC, ignoreProposal, prune, removeDeadline, removedCourses, removeMail,
  removeOverride, resolveConflict, sanitizeFac, type FacData,
} from "../../../aujourdhui/src/core/fac.ts";
import { parseMailInput } from "../../../aujourdhui/src/core/mail.ts";
import type { AujourdhuiApi, FacView, RoutineView, Settings, State } from "../../../aujourdhui/src/renderer/api-types.ts";

const WEBMAIL = "https://partage.univ-rennes.fr/";
const DAY = 86_400_000;
let routine: RoutineData = { ...EMPTY_ROUTINE, done: {}, sent: [] };
let fac: FacData = { ...EMPTY_FAC };
let counts: SourceCount[] = [];
let updatedAt = Date.now();
const listeners = new Set<(s: State) => void>();
const settings: Settings = { reminder: false, reminderHour: 19, reminderMinute: 0, startWithWindows: false, closeToTray: false };

const parse = (t: string | null) => { try { return t ? JSON.parse(t) : undefined; } catch { return undefined; } };

async function loadAll() {
  const [r, f, rev, hifz, ouv] = await Promise.all(["routine", "fac", "revision", "hifz", "ouvertures"].map((a) => store.load(a)));
  routine = sanitizeRoutine(parse(r) ?? {});
  fac = sanitizeFac(parse(f) ?? {});
  const now = Date.now();
  const src = (id: SourceId, raw: unknown, fn: () => { total: number; detail: string }): SourceCount => {
    if (raw === undefined) return { id, total: 0, detail: "Pas encore de données sur ce téléphone", missing: true, error: null };
    try { const c = fn(); return { id, total: c.total, detail: c.detail, missing: false, error: null }; } catch (e) { return { id, total: null, detail: "Données illisibles", missing: false, error: String(e) }; }
  };
  const revRaw = parse(rev), hifzRaw = parse(hifz), ouvRaw = parse(ouv);
  counts = [
    src("revision", revRaw, () => { const c = revisionCount(revRaw, now); return { total: c.total, detail: revisionDetail(c) }; }),
    src("hifz", hifzRaw, () => { const c = hifzCount(hifzRaw, now); return { total: c.total, detail: hifzDetail(c) }; }),
    src("ouvertures", ouvRaw, () => { const c = ouverturesCount(Object.values(ouvRaw as object), now); return { total: c.total, detail: ouverturesDetail(c) }; }),
  ];
  updatedAt = now;
  emit();
}

function routineView(): RoutineView {
  const now = Date.now();
  return { items: routine.items, today: itemsForDay(routine, now).map((i) => ({ ...i, done: isDone(routine, i.id, now) })), streak: streak(routine, now), day: todayISO(now) };
}

function facView(): FacView {
  const now = Date.now();
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return {
    configured: !!fac.icsUrl,
    url: fac.icsUrl ? "relié sur le PC" : "",
    lastFetch: fac.lastFetch,
    lastError: fac.lastError,
    fetching: false,
    courses: displayCourses(fac).filter((c) => c.end > start && c.start < start + 8 * DAY),
    removed: removedCourses(fac).filter((c) => c.start > start && c.start < start + 8 * DAY),
    mails: fac.mails,
    deadlines: fac.deadlines,
    allowedSenders: fac.allowedSenders,
    groups: fac.groups,
    availableGroups: fac.availableGroups.filter((g) => g.count >= 3 || fac.groups.includes(g.name)),
    webmail: WEBMAIL,
  };
}

function state(): State {
  return { settings, counts, updatedAt, version: "mobile", dataDir: "iPhone (synchronisé)", paths: { revision: "revision.json", hifz: "hifz.json", ouvertures: "ouvertures.json" }, today: todayISO(Date.now()), fac: facView(), routine: routineView() };
}
function emit() { const s = state(); for (const l of listeners) l(s); }

const commitRoutine = (r: RoutineData) => { routine = r; store.save("routine", JSON.stringify(r)); emit(); return routineView(); };
const commitFac = (f: FacData) => { fac = prune(f, Date.now()); store.save("fac", JSON.stringify(fac)); emit(); return facView(); };
const pcOnly = () => Promise.reject(new Error("réglage disponible dans l'app Windows (le PC télécharge l'emploi du temps ADE)"));

const api: AujourdhuiApi = {
  getState: async () => state(),
  onState: (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
  refresh: async () => { await loadAll(); return state(); },
  updateSettings: async () => state(),
  openApp: async (id) => { location.href = `../${id === "hifz" ? "hifz" : id}/`; },
  testNotification: async () => false,
  openFolder: () => {},
  quit: () => { location.href = "../"; },
  routine: {
    add: async (t, h, d) => commitRoutine(addItem(routine, t, h, d, Date.now())),
    update: async (id, p) => commitRoutine(updateItem(routine, id, p)),
    remove: async (id) => commitRoutine(removeItem(routine, id)),
    toggle: async (id) => commitRoutine(toggleDone(routine, id, Date.now())),
  },
  fac: {
    setUrl: pcOnly,
    refresh: async () => { await loadAll(); return facView(); },
    addMail: async (text) => commitFac(addMail(fac, parseMailInput(String(text).slice(0, 2_000_000)), Date.now()).data),
    accept: async (m, id) => commitFac(acceptProposal(fac, m, id)),
    ignore: async (m, id) => commitFac(ignoreProposal(fac, m, id)),
    undoCorrection: async (uid) => commitFac(removeOverride(fac, uid)),
    resolveConflict: async (uid, keep) => commitFac(resolveConflict(fac, uid, keep)),
    removeDeadline: async (id) => commitFac(removeDeadline(fac, id)),
    removeMail: async (id) => commitFac(removeMail(fac, id)),
    setSenders: async (l) => commitFac({ ...fac, allowedSenders: [...new Set(l.map((s) => s.trim().toLowerCase()).filter(Boolean))] }),
    setGroups: pcOnly,
    forget: pcOnly,
    openWebmail: async (subject) => { try { await navigator.clipboard.writeText(subject); } catch { /* */ } window.open(WEBMAIL, "_blank"); },
  },
};
window.aujourdhui = api;

mountChrome(["routine", "fac"]);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void loadAll(); });
void loadAll().then(() => import("../../../aujourdhui/src/renderer/main.tsx"));
