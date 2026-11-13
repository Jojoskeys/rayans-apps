// Pont entre la fenêtre et le processus principal (contextIsolation : rien d'autre n'est exposé).
import { contextBridge, ipcRenderer } from "electron";
import type { PriereApi } from "../renderer/api-types.ts";

const api: PriereApi = {
  getState: () => ipcRenderer.invoke("etat"),
  updateSettings: (patch) => ipcRenderer.invoke("reglages", patch),
  onState: (cb) => {
    const h = (_: unknown, d: Parameters<typeof cb>[0]) => cb(d);
    ipcRenderer.on("etat", h);
    return () => ipcRenderer.removeListener("etat", h);
  },
  command: (cmd) => ipcRenderer.invoke("commande", cmd),
};

contextBridge.exposeInMainWorld("priere", api);
