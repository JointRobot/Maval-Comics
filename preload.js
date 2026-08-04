const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mytube', {
  windowClose: () => ipcRenderer.send('window:close'),
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
});
