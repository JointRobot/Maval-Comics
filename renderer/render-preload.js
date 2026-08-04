const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('renderBridge', {
  onStart: (cb) => ipcRenderer.on('render:start', (_e, payload) => cb(payload)),
  sendProgress: (payload) => ipcRenderer.send('render:progress', payload),
  sendDone: (base64) => ipcRenderer.send('render:done', base64),
  sendError: (message) => ipcRenderer.send('render:error', message),
});
