// Rayan's Ouvertures sur l'iPhone : l'interface de l'app Windows, avec un « serveur » simulé dans la page.
// Le PC importe les parties, les analyse avec Stockfish et publie les exercices et le répertoire
// (fichier ouvertures-donnees). L'iPhone sert à l'entraînement : les réponses (boîtes de Leitner) sont synchronisées
// dans le fichier ouvertures. Un coup que ni Stockfish (meilleur ou 2e coup) ni vos parties ne connaissent ne peut
// pas être évalué ici : il n'est pas compté et se rejoue sur le PC.
import "../shared/sync.ts";
import { store } from "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
// @ts-expect-error module CommonJS sans types
import R from "../../../echecs-ouvertures/src/core/repertoire.js";
import { Chess } from "chess.js";

type Obj = Record<string, any>;
let pub: Obj = { players: {} }; // publié par le PC
let states: Obj = {}; // { joueur: { idExercice: état } }
const parse = (t: string | null) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };
const ready = Promise.all([store.load("ouvertures-donnees"), store.load("ouvertures")]).then(([p, s]) => {
  pub = parse(p) ?? { players: {} };
  states = parse(s) ?? {};
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const PC_ONLY = "Disponible dans l'app Windows : l'import des parties et l'analyse Stockfish se font sur le PC.";

async function route(path: string, query: URLSearchParams, body: Obj | null): Promise<Response> {
  await ready;
  const u = String(query.get("joueur") ?? body?.joueur ?? "").toLowerCase();
  const player = pub.players?.[u];
  switch (path) {
    case "/api/etat":
      return json({
        appVersion: "mobile", engine: { available: false, error: "sur le PC (l'iPhone rejoue les positions déjà analysées)" }, stockfishRelease: null,
        settings: { depth: 0 }, depths: [], dataDir: pub.publishedAt ? `publié par le PC le ${new Date(pub.publishedAt).toLocaleString("fr-FR")}` : "rien de publié par le PC pour l'instant",
        players: Object.keys(pub.players ?? {}).map((k) => ({ username: pub.players[k].username ?? k, key: k, lastImport: null })),
      });
    case "/api/repertoire":
      if (!player) return json({ error: "Aucune donnée pour ce joueur : importez et analysez ses parties sur le PC." }, 404);
      return json({ repertoire: player.repertoire, games: player.games, analysed: player.analysed });
    case "/api/exercices":
      return json({ drills: player?.drills ?? [], states: states[u] ?? {} });
    case "/api/exercices/reponse": {
      const d = (player?.drills ?? []).find((x: Obj) => x.id === body?.id);
      if (!d) return json({ error: "Exercice introuvable" }, 404);
      const uci = String(body?.uci ?? "");
      const chess = new Chess(d.fen);
      let mv = null;
      try { mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch { mv = null; }
      if (!mv) return json({ error: "Coup illégal" }, 400);
      const verdict = R.quickCheck(d, uci);
      if (!verdict) return json({ correct: false, reason: "coup non évalué sur le téléphone (Stockfish est sur le PC) : non compté, à rejouer sur le PC", san: mv.san, score: null, state: null });
      let state = null;
      if (body?.compter) {
        const mine = { ...(states[u] ?? {}) };
        state = mine[d.id] = R.nextState(mine[d.id], verdict.accepted);
        states = { ...states, [u]: mine };
        store.save("ouvertures", JSON.stringify(states));
      }
      return json({ correct: verdict.accepted, reason: verdict.reason, san: mv.san, score: null, state });
    }
    case "/api/import": case "/api/analyse":
      return body ? json({ error: PC_ONLY }, 400) : json({ status: "idle", message: "", done: 0, total: 0 });
    case "/api/import/annuler": case "/api/analyse/annuler":
      return json({ status: "idle" });
    case "/api/reglages":
      return json({ ok: true });
  }
  return json({ error: "Route inconnue" }, 404);
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    return route(url.pathname, url.searchParams, body);
  }
  return realFetch(input, init);
};

// Mise en page téléphone : une colonne, sans le panneau d'import et d'analyse (réservés au PC).
const css = document.createElement("style");
css.textContent = `
  .topbar { flex-wrap: wrap; gap: 8px; padding: calc(env(safe-area-inset-top) + 8px) 12px 8px; }
  .engine, .sidebar { display: none !important; }
  .layout { display: block; height: auto; padding: 10px; }
  .ex-view { grid-template-columns: 1fr; }
  .board-wrap { max-width: 100%; }
  .rep-cols { grid-template-columns: 1fr; }
  input, select { font-size: 16px; }`;
document.head.append(css);
mountChrome(["ouvertures", "ouvertures-donnees"]);
void import("../../../echecs-ouvertures/src/ui/app.js");
