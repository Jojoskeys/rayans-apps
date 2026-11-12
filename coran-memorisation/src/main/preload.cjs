'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hifz', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (json) => ipcRenderer.invoke('data:save', json),
  exportData: (json) => ipcRenderer.invoke('data:export', json),
  importData: () => ipcRenderer.invoke('data:import'),
  cachedAudio: (names) => ipcRenderer.invoke('audio:cached', names),
  downloadAudio: (names) => ipcRenderer.invoke('audio:download', names),
  audioInfo: () => ipcRenderer.invoke('audio:info'),
  clearAudio: () => ipcRenderer.invoke('audio:clear'),
  onAudioProgress: (cb) => {
    const fn = (_e, p) => cb(p);
    ipcRenderer.on('audio:progress', fn);
    return () => ipcRenderer.removeListener('audio:progress', fn);
  },
  info: () => ipcRenderer.invoke('app:info'),
  openLink: (url) => ipcRenderer.invoke('app:open-link', url),
  openDataFolder: () => ipcRenderer.invoke('app:open-data-folder'),
  smokeReport: (r) => ipcRenderer.send('smoke:report', r),
  onSmokeGo: (cb) => ipcRenderer.on('smoke:go', (_e, v) => cb(v)),
});
