const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mytube', {
  windowClose: () => ipcRenderer.send('window:close'),
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),

  // Electron attaches a real filesystem path to File objects from <input type=file> /
  // drag-drop (an Electron-specific extension over the web File API).
  getFilePath: (file) => file.path,

  youtube: {
    status: () => ipcRenderer.invoke('youtube:status'),
    signIn: () => ipcRenderer.invoke('youtube:signIn'),
    signOut: () => ipcRenderer.invoke('youtube:signOut'),
    onSignInPrompt: (cb) => ipcRenderer.on('youtube:signin-prompt', (_e, prompt) => cb(prompt)),
  },

  quota: {
    snapshot: () => ipcRenderer.invoke('quota:snapshot'),
    remaining: (captions) => ipcRenderer.invoke('quota:remaining', captions),
  },

  publish: {
    start: (job) => ipcRenderer.invoke('publish:start', job),
    cancel: () => ipcRenderer.invoke('publish:cancel'),
    onProgress: (cb) => ipcRenderer.on('publish:progress', (_e, payload) => cb(payload)),
  },
});
