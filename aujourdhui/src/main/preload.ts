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
  fac: {
    setUrl: (u) => ipcRenderer.invoke("fac-url", u),
    refresh: () => ipcRenderer.invoke("fac-actualiser"),
    addMail: (t) => ipcRenderer.invoke("fac-mail", t),
    accept: (m, id) => ipcRenderer.invoke("fac-valider", m, id),
    ignore: (m, id) => ipcRenderer.invoke("fac-ignorer", m, id),
    undoCorrection: (uid) => ipcRenderer.invoke("fac-annuler-correction", uid),
    resolveConflict: (uid, keep) => ipcRenderer.invoke("fac-conflit", uid, keep),
    removeDeadline: (id) => ipcRenderer.invoke("fac-supprimer-echeance", id),
    removeMail: (id) => ipcRenderer.invoke("fac-supprimer-mail", id),
    setSenders: (l) => ipcRenderer.invoke("fac-expediteurs", l),
    forget: () => ipcRenderer.invoke("fac-oublier"),
    openWebmail: (s) => ipcRenderer.invoke("fac-webmail", s),
  },
};

contextBridge.exposeInMainWorld("aujourdhui", api);
