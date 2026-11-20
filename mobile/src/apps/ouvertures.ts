// Rayan's Ouvertures sur l'iPhone : l'interface de l'app Windows, avec un « serveur » simulé dans la page.
// Tout peut se faire sur le téléphone : le pseudo Chess.com, l'import des parties (API publique de Chess.com,
// appelée directement) et l'analyse par Stockfish en version web (ouvertures-moteur.ts). Les parties et les
// analyses faites ici restent dans le téléphone (IndexedDB). Les joueurs importés seulement sur le PC gardent les
// exercices publiés par le PC (fichier ouvertures-donnees). Les réponses (boîtes de Leitner) sont synchronisées
// dans le fichier ouvertures, quel que soit l'endroit où les parties ont été analysées.
import "../shared/sync.ts";
import { store } from "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
// @ts-expect-error module CommonJS sans types
import R from "../../../echecs-ouvertures/src/core/repertoire.js";
// @ts-expect-error module CommonJS sans types
import O from "../../../echecs-ouvertures/src/core/openings.js";
// @ts-expect-error module CommonJS sans types
import I from "../../../echecs-ouvertures/src/server/importer.js";
// @ts-expect-error module CommonJS sans types
import A from "../../../echecs-ouvertures/src/server/analyzer.js";
import { Chess } from "chess.js";
import { WebEngine } from "./ouvertures-moteur.ts";

type Obj = Record<string, any>;
let pub: Obj = { players: {} }; // publié par le PC
let states: Obj = {}; // { joueur: { idExercice: état } }
const parse = (t: string | null) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

// ---------- Données du téléphone (IndexedDB, chargées en mémoire au démarrage) ----------
const kv = new Map<string, any>();
let db: IDBDatabase | null = null;
const dirty = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const r = indexedDB.open("rayans-ouvertures", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function loadKv() {
  db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const os = db!.transaction("kv").objectStore("kv");
    const keys = os.getAllKeys(), vals = os.getAll();
    vals.onsuccess = () => { keys.result.forEach((k, i) => kv.set(String(k), vals.result[i])); resolve(); };
    vals.onerror = () => resolve();
  });
}
function flush() {
  flushTimer = null;
  if (!db || !dirty.size) return;
  const os = db.transaction("kv", "readwrite").objectStore("kv");
  for (const k of dirty) os.put(kv.get(k), k);
  dirty.clear();
}
function put(k: string, v: unknown) {
  kv.set(k, v);
  dirty.add(k);
  flushTimer ??= setTimeout(flush, 400);
}
addEventListener("pagehide", flush);

const safe = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9_.-]/g, "_");
const gamesCache = new Map<string, Obj>();
const analysesCache = new Map<string, Obj>();
const localStore = {
  safe,
  listPlayers() {
    const out: Obj[] = [];
    for (const k of kv.keys()) if (k.startsWith("archives:")) {
      const u = k.slice(9);
      if ([...kv.keys()].some((x) => x.startsWith(`parties:${u}:`))) { const a = kv.get(k); out.push({ username: a.username || u, key: u, lastImport: a.lastImport || null }); }
    }
    return out;
  },
  loadGames(u: string) {
    const key = safe(u);
    if (gamesCache.has(key)) return gamesCache.get(key)!;
    const index: Obj = {};
    for (const [k, v] of kv) if (k.startsWith(`parties:${key}:`)) for (const g of v as Obj[]) if (g?.id) index[g.id] = g;
    gamesCache.set(key, index);
    return index;
  },
  saveMonth(u: string, monthKey: string, games: Obj[]) {
    const uniq = new Map<string, Obj>();
    for (const g of games) if (g?.id) uniq.set(g.id, g);
    put(`parties:${safe(u)}:${monthKey}`, [...uniq.values()]);
    gamesCache.delete(safe(u));
  },
  loadArchives: (u: string) => structuredClone(kv.get(`archives:${safe(u)}`) ?? { username: u, months: {} }),
  saveArchives: (u: string, a: Obj) => put(`archives:${safe(u)}`, structuredClone(a)),
  loadAnalyses(u: string) {
    const key = safe(u);
    if (!analysesCache.has(key)) analysesCache.set(key, kv.get(`analyses:${key}`) ?? {});
    return analysesCache.get(key)!;
  },
  saveAnalyses(u: string, a: Obj) { analysesCache.set(safe(u), a); put(`analyses:${safe(u)}`, a); },
  loadDrillStates: (u: string) => ({ ...(states[safe(u)] ?? {}) }),
  saveDrillStates(u: string, st: Obj) { states = { ...states, [safe(u)]: st }; store.save("ouvertures", JSON.stringify(states)); },
  loadCache: (name: string, fallback: unknown) => kv.get(`cache:${name}`) ?? fallback,
  saveCache: (name: string, data: unknown) => put(`cache:${name}`, data),
  loadSettings: () => ({ depth: 10, nombre: 20, ...(kv.get("reglages") ?? {}) }),
  saveSettings: (s: Obj) => put("reglages", s),
};

const ready = Promise.all([store.load("ouvertures-donnees"), store.load("ouvertures"), loadKv()]).then(([p, s]) => {
  pub = parse(p) ?? { players: {} };
  states = parse(s) ?? {};
});

const realFetch = window.fetch.bind(window);
// Requête simple vers Chess.com (sans en-tête ajouté, donc sans pré-requête CORS).
const importer = I.createImporter({ store: localStore, fetchImpl: (url: string, o?: { signal?: AbortSignal }) => realFetch(url, { signal: o?.signal }) });
const engine = new WebEngine();

// Ouvertures connues (≈ 1 Mo) et analyseur : chargés seulement quand on en a besoin.
let localP: Promise<Obj> | null = null;
function local() {
  localP ??= (async () => {
    const r = await realFetch(new URL("openings.json", location.href));
    if (!r.ok) throw new Error("Liste des ouvertures introuvable");
    const openings = O.createOpenings(await r.json());
    const infoCache = new Map<string, Obj | null>();
    const infosFor = (username: string) => {
      const u = safe(username);
      const out: Obj[] = [];
      for (const g of Object.values(localStore.loadGames(u)) as Obj[]) {
        const k = `${u}|${g.id}`;
        if (!infoCache.has(k)) infoCache.set(k, R.gameOpening(g, u, openings));
        const info = infoCache.get(k);
        if (info) out.push(info);
      }
      return out;
    };
    const analyzer = A.createAnalyzer({ store: localStore, engineRef: () => engine, infosFor });
    const drillsFor = (u: string) => {
      const analyses = localStore.loadAnalyses(u);
      return R.buildDrills(infosFor(u).map((info) => ({ info, analysis: analyses[info.gameId] || null })), openings);
    };
    return { infosFor, analyzer, drillsFor };
  })();
  localP.catch(() => { localP = null; });
  return localP;
}
const hasLocal = (u: string) => !!u && Object.keys(localStore.loadGames(u)).length > 0;

// L'écran reste allumé pendant l'analyse (sinon l'iPhone met la page en pause).
let wake: { release(): Promise<void> } | null = null;
async function keepAwake(on: boolean) {
  try {
    if (on && !wake) wake = await (navigator as any).wakeLock?.request("screen") ?? null;
    if (!on && wake) { await wake.release(); wake = null; }
  } catch { /* non pris en charge */ }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && wake) { wake = null; void keepAwake(true); } });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function route(path: string, query: URLSearchParams, body: Obj | null): Promise<Response> {
  await ready;
  const u = String(query.get("joueur") ?? body?.joueur ?? "").toLowerCase();
  const isLocal = hasLocal(u);
  const player = pub.players?.[u];
  switch (path) {
    case "/api/etat": {
      const mine = localStore.listPlayers();
      const fromPc = Object.keys(pub.players ?? {}).filter((k) => !mine.some((p) => p.key === k)).map((k) => ({ username: pub.players[k].username ?? k, key: k, lastImport: null }));
      return json({
        appVersion: "mobile", engine: { available: true, name: engine.name }, stockfishRelease: null,
        settings: localStore.loadSettings(), depths: A.DEPTHS,
        dataDir: `sur cet iPhone${pub.publishedAt ? ` · exercices du PC publiés le ${new Date(pub.publishedAt).toLocaleString("fr-FR")}` : ""}`,
        players: [...mine, ...fromPc],
      });
    }
    case "/api/reglages": {
      const cur = { ...(kv.get("reglages") ?? {}) };
      if (A.DEPTHS.includes(body?.depth)) cur.depth = body!.depth;
      if (Number.isInteger(body?.nombre) && body!.nombre >= 1 && body!.nombre <= 2000) cur.nombre = body!.nombre;
      localStore.saveSettings(cur);
      return json(localStore.loadSettings());
    }
    case "/api/import":
      if (!body) return json(importer.status());
      try { return json(importer.start(String(body.pseudo ?? "").trim())); } catch (e) { return json({ error: (e as Error).message }, 400); }
    case "/api/import/annuler":
      importer.cancel();
      return json(importer.status());
    case "/api/analyse": {
      if (!body) {
        if (!localP) return json({ status: "idle" });
        const s = (await local()).analyzer.status();
        if (s.status !== "running") void keepAwake(false);
        return json(s);
      }
      if (!isLocal) return json({ error: "Importez d'abord les parties de ce pseudo sur l'iPhone." }, 409);
      try {
        const { analyzer } = await local();
        const s = localStore.loadSettings();
        const st = analyzer.start(u, {
          nombre: Number.isInteger(body.nombre) ? body.nombre : s.nombre, depth: A.DEPTHS.includes(body.depth) ? body.depth : s.depth,
          cadence: typeof body.cadence === "string" && body.cadence ? body.cadence : null,
        });
        if (st.status === "running") void keepAwake(true);
        return json(st);
      } catch (e) { return json({ error: (e as Error).message }, 409); }
    }
    case "/api/analyse/annuler":
      if (localP) (await local()).analyzer.cancel();
      void keepAwake(false);
      return json({ status: "cancelled" });
    case "/api/repertoire": {
      if (isLocal) {
        const L = await local();
        const infos = L.infosFor(u);
        const analyses = localStore.loadAnalyses(u);
        return json({ repertoire: R.buildRepertoire(infos, analyses, L.drillsFor(u), localStore.loadDrillStates(u)), games: infos.length, analysed: infos.filter((i: Obj) => analyses[i.gameId]).length });
      }
      if (!player) return json({ error: "Aucune partie pour ce pseudo : touchez « Importer »." }, 404);
      return json({ repertoire: player.repertoire, games: player.games, analysed: player.analysed });
    }
    case "/api/exercices":
      return json({ drills: isLocal ? (await local()).drillsFor(u) : player?.drills ?? [], states: localStore.loadDrillStates(u) });
    case "/api/exercices/reponse": {
      const drills: Obj[] = isLocal ? (await local()).drillsFor(u) : player?.drills ?? [];
      const d = drills.find((x) => x.id === body?.id);
      if (!d) return json({ error: "Exercice introuvable" }, 404);
      const uci = String(body?.uci ?? "");
      const chess = new Chess(d.fen);
      let mv = null;
      try { mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch { mv = null; }
      if (!mv) return json({ error: "Coup illégal" }, 400);
      let verdict = R.quickCheck(d, uci);
      let score = null;
      if (!verdict) {
        try {
          const r = await engine.search({ fen: d.fen, depth: d.depth || localStore.loadSettings().depth, multipv: 1, searchmoves: [uci], priority: true });
          score = r.lines[0]?.score ?? null;
        } catch (e) { return json({ error: `Évaluation impossible : ${(e as Error).message}` }, 500); }
        verdict = R.judgeScore(d, uci, score);
      }
      let state = null;
      if (body?.compter) {
        const mine = localStore.loadDrillStates(u);
        state = mine[d.id] = R.nextState(mine[d.id], verdict.accepted);
        localStore.saveDrillStates(u, mine);
      }
      return json({ correct: verdict.accepted, reason: verdict.reason, san: mv.san, score, state });
    }
  }
  return json({ error: "Route inconnue" }, 404);
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin && url.pathname.includes("/api/")) {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    return route(url.pathname.slice(url.pathname.indexOf("/api/")), url.searchParams, body);
  }
  return realFetch(input, init);
};

// Mise en page téléphone : une colonne, le pseudo et l'analyse en haut.
const css = document.createElement("style");
css.textContent = `
  .topbar { flex-wrap: wrap; gap: 8px; padding: calc(env(safe-area-inset-top) + 8px) 12px 8px; }
  .engine { display: none !important; }
  .layout { display: block; height: auto; padding: 10px; }
  .sidebar { margin-bottom: 10px; }
  .ex-view { grid-template-columns: 1fr; }
  .board-wrap { max-width: 100%; }
  .rep-cols { grid-template-columns: 1fr; }
  input, select { font-size: 16px; }`;
document.head.append(css);
// Sur le téléphone, une analyse plus courte par défaut (Stockfish y est plus lent que sur le PC).
const nb = document.getElementById("an-nombre") as HTMLSelectElement | null;
if (nb) nb.value = "20";
const hint = document.querySelector(".sidebar .card .muted.small");
if (hint) hint.textContent += " Sur l'iPhone, l'écran reste allumé pendant l'analyse : comptez une minute ou deux pour 20 parties.";
mountChrome(["ouvertures", "ouvertures-donnees"]);
void import("../../../echecs-ouvertures/src/ui/app.js");
