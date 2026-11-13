// Pont entre la fenêtre et le processus principal (contextIsolation : rien d'autre n'est exposé).
import { contextBridge, ipcRenderer } from "electron";
import type { SauveApi } from "../renderer/api-types.ts";

const api: SauveApi = {
  getState: () => ipcRenderer.invoke("etat"),
  onState: (cb) => {
    const h = (_: unknown, s: Parameters<typeof cb>[0]) => cb(s);
    ipcRenderer.on("etat", h);
    return () => { ipcRenderer.removeListener("etat", h); };
  },
  updateSettings: (p) => ipcRenderer.invoke("reglages", p),
  backup: () => ipcRenderer.invoke("sauvegarder"),
  cancel: () => ipcRenderer.invoke("annuler"),
  pickDestination: () => ipcRenderer.invoke("choisir-destination"),
  pickSources: () => ipcRenderer.invoke("choisir-source"),
  open: (p) => ipcRenderer.send("ouvrir", p),
  quit: () => ipcRenderer.send("quitter"),
};

contextBridge.exposeInMainWorld("sauve", api);
