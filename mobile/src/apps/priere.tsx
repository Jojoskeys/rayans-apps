// Rayan's Prière sur l'iPhone : horaires calculés sur le téléphone (aucune connexion nécessaire), réglages
// synchronisés avec le PC. Les notifications restent sur le PC.
import "../shared/sync.ts";
import { store } from "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import { normalizeData, normalizeSettings, type AppData } from "../../../priere/src/core/settings.ts";
import type { PriereApi } from "../../../priere/src/renderer/api-types.ts";

let data: AppData = normalizeData(undefined);
const listeners = new Set<(d: AppData) => void>();
const ready = store.load("priere").then((t) => { try { data = normalizeData(t ? JSON.parse(t) : undefined); } catch { /* données par défaut */ } });

const api: PriereApi = {
  getState: async () => { await ready; return { data, version: "mobile", dataDir: "iPhone (synchronisé)", warning: null }; },
  updateSettings: async (patch) => {
    data = { ...data, settings: normalizeSettings({ ...data.settings, ...patch }) };
    store.save("priere", JSON.stringify(data));
    for (const l of listeners) l(data);
  },
  onState: (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
  command: async (cmd) => { if (cmd.type === "quitter") location.href = "../"; return false; },
};
window.priere = api;

mountChrome(["priere"]);
void import("../../../priere/src/renderer/main.tsx");
