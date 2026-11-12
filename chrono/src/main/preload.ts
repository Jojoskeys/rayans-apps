// Pont entre les fenêtres et le processus principal (contextIsolation : rien d'autre n'est exposé).
import { contextBridge, ipcRenderer } from "electron";
import type { ChronoApi } from "../renderer/api-types.ts";

const api: ChronoApi = {
  getState: () => ipcRenderer.invoke("etat"),
  dispatch: (action) => ipcRenderer.invoke("action", action),
  onState: (cb) => {
    const h = (_: unknown, d: Parameters<typeof cb>[0]) => cb(d);
    ipcRenderer.on("etat", h);
    return () => ipcRenderer.removeListener("etat", h);
  },
  onSignal: (cb) => {
    const h = (_: unknown, s: Parameters<typeof cb>[0]) => cb(s);
    ipcRenderer.on("signal", h);
    return () => ipcRenderer.removeListener("signal", h);
  },
  exportCsv: (req) => ipcRenderer.invoke("export-csv", req),
  command: (cmd) => ipcRenderer.invoke("commande", cmd),
};

contextBridge.exposeInMainWorld("chrono", api);
