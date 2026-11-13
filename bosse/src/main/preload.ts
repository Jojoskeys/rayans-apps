// Pont entre la fenêtre et le processus principal (contextIsolation : rien d'autre n'est exposé).
import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { BosseApi } from "../renderer/api-types.ts";

const on = <T>(channel: string) => (cb: (v: T) => void) => {
  const h = (_: unknown, v: T) => cb(v);
  ipcRenderer.on(channel, h);
  return () => { ipcRenderer.removeListener(channel, h); };
};

const api: BosseApi = {
  getState: () => ipcRenderer.invoke("etat"),
  onState: on("etat"),
  onMessage: on("message"),
  save: (d) => ipcRenderer.invoke("enregistrer", d),
  openWorkspace: (id) => ipcRenderer.invoke("ouvrir-espace", id),
  testItem: (it) => ipcRenderer.invoke("tester", it),
  pick: (k) => ipcRenderer.invoke("choisir", k),
  inspect: (p) => ipcRenderer.invoke("chemins", p),
  pathOf: (f) => webUtils.getPathForFile(f),
  openDataDir: () => ipcRenderer.send("ouvrir-donnees"),
  quit: () => ipcRenderer.send("quitter"),
};

contextBridge.exposeInMainWorld("bosse", api);
