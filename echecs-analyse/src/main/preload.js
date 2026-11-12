'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bureau', {
  copierTexte: (text) => ipcRenderer.invoke('copier-texte', String(text)),
  ouvrirLien: (url) => ipcRenderer.invoke('ouvrir-lien', String(url)),
});
