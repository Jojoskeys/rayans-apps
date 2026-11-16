// Rayan's Hifz sur l'iPhone : l'interface de l'app Windows, avec les données synchronisées et l'audio lu en ligne
// (everyayah.com, comme sur le PC, mais sans copie hors ligne).
import "../shared/sync.ts";
import { store } from "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import type { HifzApi } from "../../../coran-memorisation/src/ui/api.ts";

(window as unknown as { HIFZ_WEB: boolean }).HIFZ_WEB = true;

const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const api: HifzApi = {
  loadData: async () => { const t = await store.load("hifz"); try { return t ? JSON.parse(t) : null; } catch { return null; } },
  saveData: async (json) => { store.save("hifz", json); return true; },
  exportData: async (json) => { download(`hifz-${new Date().toISOString().slice(0, 10)}.json`, json); return true; },
  importData: () => new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async () => { const f = input.files?.[0]; try { resolve(f ? JSON.parse(await f.text()) : null); } catch { resolve(null); } };
    input.click();
  }),
  cachedAudio: async (names) => names, // lu directement en ligne
  downloadAudio: async () => ({ ok: 0, failed: 0 }),
  audioInfo: async () => ({ files: 0, bytes: 0, dir: "lecture en ligne (everyayah.com)" }),
  clearAudio: async () => true,
  onAudioProgress: () => () => {},
  info: async () => ({ version: "mobile", dataFile: "iPhone (synchronisé)", packaged: true, test: false, demo: false }),
  onSmokeGo: () => {},
  openLink: async (url) => { window.open(url, "_blank", "noopener"); },
  openDataFolder: async () => "",
  smokeReport: () => {},
};
window.hifz = api;

mountChrome(["hifz"]);
void import("../../../coran-memorisation/src/ui/main.tsx");
