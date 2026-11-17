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
import { avancement, changer, cocher, journee, nettoyerObjectifs, OBJECTIFS_VIDES, preparer, reglerObjectifs, serie, type Mesures, type ObjectifsData } from "../../../aujourdhui/src/core/objectifs.ts";
import { mesures } from "../../../aujourdhui/src/core/mesures.ts";
import { aRemplir, BILAN_VIDE, cocherAdhkar, cocherPrevu, moments, nettoyerBilan, noterMatin, noterSoir, reglerBilan, type BilanData } from "../../../aujourdhui/src/core/bilan.ts";
import { heuresDePriere } from "../../../aujourdhui/src/core/prieres.ts";
import { citationsDuJour } from "../../../aujourdhui/src/core/citations.ts";
import type { AujourdhuiApi, BilanView, FacView, ObjectifsView, RoutineView, Settings, State } from "../../../aujourdhui/src/renderer/api-types.ts";

const WEBMAIL = "https://partage.univ-rennes.fr/";
const DAY = 86_400_000;
let routine: RoutineData = { ...EMPTY_ROUTINE, done: {}, sent: [] };
let fac: FacData = { ...EMPTY_FAC };
let counts: SourceCount[] = [];
let objectifs: ObjectifsData = OBJECTIFS_VIDES;
let bilan: BilanData = BILAN_VIDE;
let m: Mesures = {};
let priereRaw: unknown;
let updatedAt = Date.now();
const listeners = new Set<(s: State) => void>();
const settings: Settings = { reminder: false, reminderHour: 19, reminderMinute: 0, startWithWindows: false, closeToTray: false };

const parse = (t: string | null) => { try { return t ? JSON.parse(t) : undefined; } catch { return undefined; } };

async function loadAll() {
  const [r, f, rev, hifz, ouv, obj, bil, pri, chr] = await Promise.all(["routine", "fac", "revision", "hifz", "ouvertures", "objectifs", "bilan", "priere", "chrono"].map((a) => store.load(a)));
  routine = sanitizeRoutine(parse(r) ?? {});
  fac = sanitizeFac(parse(f) ?? {});
  bilan = nettoyerBilan(parse(bil) ?? {});
  priereRaw = parse(pri);
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
  // Objectifs : mesurés ici avec Révision et Chrono (synchronisés) ; jeux et coucher sont mesurés sur le PC.
  m = { ...mesures({ revision: revRaw, chrono: parse(chr), counts }), sansAdhkar: bilan.reglages.adhkar };
  const avant = parse(obj) ?? {};
  objectifs = preparer(nettoyerObjectifs(avant), m, now);
  if (JSON.stringify(objectifs) !== JSON.stringify(nettoyerObjectifs(avant))) store.save("objectifs", JSON.stringify(objectifs));
  updatedAt = now;
  emit();
}

function objectifsView(): ObjectifsView {
  const now = Date.now();
  const jour = journee(now);
  return {
    jour,
    objectifs: (objectifs.jours[jour] ?? []).map((o) => ({ ...o, avancement: avancement(o, m, jour, false) })),
    serie: serie(objectifs, m, now),
    reglages: objectifs.reglages,
    sources: { journal: true, chrono: !!m.chronoMin, revision: !!m.revisionCartes },
  };
}

function bilanView(): BilanView {
  const now = Date.now();
  const p = priereRaw ? heuresDePriere(priereRaw, now) : null;
  const jour = todayISO(now);
  const historique = Object.entries(bilan.jours)
    .filter(([k, j]) => k <= jour && (j.matin || j.soir))
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 14)
    .map(([k, j]) => ({ jour: k, matin: j.matin ?? null, soir: j.soir ?? null }));
  return {
    jour, aujourdhui: bilan.jours[jour] ?? {}, demain: bilan.jours[todayISO(now + DAY)]?.prevu ?? [],
    aRemplir: aRemplir(bilan, now, p), moments: moments(bilan, now, p), prieres: p, reglages: bilan.reglages, historique,
    citations: citationsDuJour(jour),
  };
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
  return { settings, counts, updatedAt, version: "mobile", dataDir: "iPhone (synchronisé)", paths: { revision: "revision.json", hifz: "hifz.json", ouvertures: "ouvertures.json" }, today: todayISO(Date.now()), fac: facView(), routine: routineView(), objectifs: objectifsView(), bilan: bilanView() };
}
function emit() { const s = state(); for (const l of listeners) l(s); }

const commitRoutine = (r: RoutineData) => { routine = r; store.save("routine", JSON.stringify(r)); emit(); return routineView(); };
const commitFac = (f: FacData) => { fac = prune(f, Date.now()); store.save("fac", JSON.stringify(fac)); emit(); return facView(); };
const commitObjectifs = (o: ObjectifsData) => { objectifs = o; store.save("objectifs", JSON.stringify(o)); emit(); return objectifsView(); };
const commitBilan = (b: BilanData) => { bilan = b; store.save("bilan", JSON.stringify(b)); emit(); return bilanView(); };
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
  objectifs: {
    toggle: async (id) => commitObjectifs(cocher(objectifs, id, Date.now())),
    change: async (id) => commitObjectifs(changer(objectifs, m, id, Date.now())),
    settings: async (r) => {
      const next = reglerObjectifs(objectifs, r);
      const jours = { ...next.jours };
      delete jours[journee(Date.now())];
      return commitObjectifs(preparer({ ...next, jours }, m, Date.now()));
    },
  },
  bilan: {
    morning: async (h, t) => commitBilan(noterMatin(bilan, Date.now(), h, t)),
    evening: async (h, j, r, d) => commitBilan(noterSoir(bilan, Date.now(), h, j, r, d)),
    togglePlanned: async (id) => commitBilan(cocherPrevu(bilan, Date.now(), id)),
    toggleAdhkar: async (q) => commitBilan(cocherAdhkar(bilan, Date.now(), q)),
    settings: async (r) => commitBilan(reglerBilan(bilan, r)),
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

mountChrome(["routine", "fac", "objectifs", "bilan"]);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void loadAll(); });
void loadAll().then(() => import("../../../aujourdhui/src/renderer/main.tsx"));
