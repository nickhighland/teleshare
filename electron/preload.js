const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  download: (url) => ipcRenderer.send('start-download', url),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  onDownloadComplete: (callback) => ipcRenderer.on('download-complete', callback),
  onDownloadError: (callback) => ipcRenderer.on('download-error', callback),
  removeDownloadListeners: () => {
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('download-complete');
    ipcRenderer.removeAllListeners('download-error');
  },
  saveMedia: async (buffer, ext) => {
    return await ipcRenderer.invoke('save-media', buffer, ext);
  },
  getPlatform: () => process.platform,
  isElectron: true
});
