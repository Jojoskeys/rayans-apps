// Pont entre la fenêtre et le processus principal (contextIsolation : rien d'autre n'est exposé).
import { contextBridge, ipcRenderer } from "electron";
import type { RecettesApi } from "../renderer/api-types.ts";

const api: RecettesApi = {
  getState: () => ipcRenderer.invoke("etat"),
  actualiser: () => ipcRenderer.invoke("actualiser"),
  dispatch: (action) => ipcRenderer.invoke("action", action),
  ouvrirLien: (url) => ipcRenderer.invoke("ouvrir-lien", url),
  ouvrirDossier: () => ipcRenderer.invoke("ouvrir-dossier"),
  copier: (texte) => ipcRenderer.invoke("copier", texte),
  onChange: (cb) => {
    const h = () => cb();
    ipcRenderer.on("change", h);
    return () => ipcRenderer.removeListener("change", h);
  },
};

contextBridge.exposeInMainWorld("recettes", api);
