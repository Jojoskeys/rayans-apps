// Pont entre la fenêtre et le processus principal (contextIsolation : rien d'autre n'est exposé).
import { contextBridge, ipcRenderer } from "electron";
import type { TelecommandeApi } from "../renderer/api-types.ts";

const api: TelecommandeApi = {
  etat: () => ipcRenderer.invoke("etat"),
  commande: (c) => ipcRenderer.invoke("commande", c),
  surEtat: (cb) => {
    const h = (_: unknown, e: Parameters<typeof cb>[0]) => cb(e);
    ipcRenderer.on("etat", h);
    return () => ipcRenderer.removeListener("etat", h);
  },
};

contextBridge.exposeInMainWorld("telecommande", api);
