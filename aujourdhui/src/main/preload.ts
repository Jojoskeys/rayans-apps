// Pont entre la fenêtre et le processus principal (contextIsolation : rien d'autre n'est exposé).
import { contextBridge, ipcRenderer } from "electron";
import type { AujourdhuiApi } from "../renderer/api-types.ts";

const api: AujourdhuiApi = {
  getState: () => ipcRenderer.invoke("etat"),
  onState: (cb) => {
    const h = (_: unknown, s: Parameters<typeof cb>[0]) => cb(s);
    ipcRenderer.on("etat", h);
    return () => { ipcRenderer.removeListener("etat", h); };
  },
  refresh: () => ipcRenderer.invoke("actualiser"),
  updateSettings: (p) => ipcRenderer.invoke("reglages", p),
  openApp: (id) => ipcRenderer.invoke("ouvrir-app", id),
  testNotification: () => ipcRenderer.invoke("tester-notification"),
  openFolder: (p) => ipcRenderer.send("ouvrir-dossier", p),
  quit: () => ipcRenderer.send("quitter"),
};

contextBridge.exposeInMainWorld("aujourdhui", api);
