'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bureau', {
  ouvrirLien: (url) => ipcRenderer.invoke('ouvrir-lien', String(url)),
});
