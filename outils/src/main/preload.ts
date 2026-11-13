// Pont entre les fenêtres et le processus principal (contextIsolation : rien d'autre n'est exposé).
import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { OutilsApi } from "../renderer/api-types.ts";

const on = <T>(channel: string) => (cb: (v: T) => void) => {
  const h = (_: unknown, v: T) => cb(v);
  ipcRenderer.on(channel, h);
  return () => { ipcRenderer.removeListener(channel, h); };
};

const api: OutilsApi = {
  getState: () => ipcRenderer.invoke("etat"),
  onState: on("etat"),
  onGoto: on("aller"),
  updateSettings: (p) => ipcRenderer.invoke("reglages", p),
  run: (t) => ipcRenderer.invoke("commande", t),
  hidePalette: () => ipcRenderer.send("masquer-palette"),
  pathOf: (f) => webUtils.getPathForFile(f),
  pickFiles: (k, m) => ipcRenderer.invoke("choisir-fichiers", k, m),
  mergePdf: (f, q) => ipcRenderer.invoke("pdf", f, q),
  compressImage: (f, t) => ipcRenderer.invoke("img", f, t),
  shareStart: (f) => ipcRenderer.invoke("partage", f),
  shareStop: () => ipcRenderer.invoke("partage-stop"),
  qr: (t) => ipcRenderer.invoke("qr", t),
  wifi: () => ipcRenderer.invoke("wifi"),
  outputs: () => ipcRenderer.invoke("sorties"),
  setOutput: (id) => ipcRenderer.invoke("sortie", id),
  captureText: () => ipcRenderer.invoke("capturer"),
  schedulePower: (m, n) => ipcRenderer.invoke("alim", m, n),
  cancelPower: () => ipcRenderer.invoke("alim-annuler"),
  showInFolder: (p) => ipcRenderer.send("montrer", p),
  openPath: (p) => ipcRenderer.send("ouvrir", p),
  copy: (t) => ipcRenderer.send("copier", t),
  quit: () => ipcRenderer.send("quitter"),
  suivi: (a) => ipcRenderer.invoke("suivi", a),
  recents: () => ipcRenderer.invoke("recents"),
  exportIcs: () => ipcRenderer.invoke("ics"),
  openUrl: (u) => ipcRenderer.invoke("ouvrir-lien", u),
  onCaptureImage: on("capture-image"),
  captureDone: (r) => ipcRenderer.send("capture-fin", r),
};

contextBridge.exposeInMainWorld("outils", api);
