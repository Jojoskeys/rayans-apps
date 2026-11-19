// Rayan's Chrono sur l'iPhone : le même minuteur (réducteur de l'app Windows), les projets et l'historique
// synchronisés avec le PC. Le minuteur en cours reste propre à chaque appareil.
import "../shared/sync.ts";
import { store } from "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import { monterPanneau, suivre } from "./chrono-iphone.tsx";
import { createData, normalizeData, reduce } from "../../../chrono/src/core/engine.ts";
import { entriesCsv } from "../../../chrono/src/core/csv.ts";
import type { AppData } from "../../../chrono/src/core/types.ts";
import type { ChronoApi, Signal } from "../../../chrono/src/renderer/api-types.ts";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const ctx = () => ({ now: Date.now(), newId });
let data: AppData = createData(ctx());
const stateL = new Set<(d: AppData) => void>();
const signalL = new Set<(s: Signal) => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const ready = store.load("chrono").then((t) => { try { if (t) data = normalizeData(JSON.parse(t), ctx()); } catch { /* données neuves */ } });

function dispatch(action: Parameters<ChronoApi["dispatch"]>[0]) {
  const r = reduce(data, action, ctx());
  if (!r.changed) return;
  data = r.data;
  for (const e of r.events) {
    if (e.type !== "phaseEnd") continue;
    if (data.settings.sound) for (const l of signalL) l({ type: "son", to: e.to });
    navigator.vibrate?.(300);
  }
  for (const l of stateL) l(data);
  suivre(data);
  if (action.type !== "tick" || r.events.length) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.save("chrono", JSON.stringify(data)), 600);
  }
}

const api: ChronoApi = {
  getState: async () => { await ready; return { data, version: "mobile", dataDir: "iPhone (synchronisé)", warning: null }; },
  dispatch: async (a) => dispatch(a),
  onState: (cb) => { stateL.add(cb); return () => { stateL.delete(cb); }; },
  onSignal: (cb) => { signalL.add(cb); return () => { signalL.delete(cb); }; },
  exportCsv: async (req) => {
    const url = URL.createObjectURL(new Blob([entriesCsv(data, req.from, req.to)], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `${req.name}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return `${req.name}.csv`;
  },
  command: async (cmd) => { if (cmd === "quitter") location.href = "../"; },
  onBarre: () => () => {},
};
window.chrono = api;
setInterval(() => dispatch({ type: "tick" }), 250);

mountChrome(["chrono"]);
void ready.then(() => { suivre(data); monterPanneau(() => data, () => dispatch({ type: "start" })); return import("../../../chrono/src/renderer/main.tsx"); });
