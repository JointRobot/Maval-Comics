const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const loadConfig = require('./config');
const { YouTubeAuth } = require('./src/core/youtube/oauth');
const { YouTubeUploadClient } = require('./src/core/youtube/upload');
const { QuotaTracker } = require('./src/core/youtube/quota');
const { renderVideo } = require('./src/core/render/composer');

let auth;
let quota;
let uploadClient;
let activePublish = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: '#e9e7e3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  const config = loadConfig(app.getPath('userData'));
  auth = new YouTubeAuth(config.youtubeClientId, config.youtubeClientSecret);
  quota = new QuotaTracker();
  uploadClient = new YouTubeUploadClient(() => auth.getAccessToken());

  ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
  ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.on('window:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
  });

  ipcMain.handle('youtube:status', () => ({
    configured: auth.isConfigured(),
    signedIn: auth.hasSession(),
  }));

  ipcMain.handle('youtube:signIn', async (e) => {
    if (!auth.isConfigured()) {
      throw new Error(`YouTube isn't configured yet — add clientId/clientSecret to ${path.join(app.getPath('userData'), 'config.json')}`);
    }
    await auth.signIn((prompt) => {
      BrowserWindow.fromWebContents(e.sender)?.webContents.send('youtube:signin-prompt', prompt);
    });
    return true;
  });

  ipcMain.handle('youtube:signOut', () => {
    auth.signOut();
    return true;
  });

  ipcMain.handle('quota:snapshot', () => quota.snapshot());
  ipcMain.handle('quota:remaining', (_e, captions) => quota.remainingPublishes(captions));

  // job: { audioPath, coverPath, title, artist, composition, resolution,
  //         metaTitle, metaDesc, tags, privacy, captions }
  ipcMain.handle('publish:start', async (e, job) => {
    const send = (payload) => e.sender.send('publish:progress', payload);
    activePublish = { cancelled: false };
    try {
      const videoPath = await renderVideo(
        {
          audioPath: job.audioPath,
          coverPath: job.coverPath,
          title: job.title,
          artist: job.artist,
          composition: job.composition,
          resolution: job.resolution,
        },
        (p) => send({ stage: 'render', ...p }),
      );
      // Cancellation is checked between stages only — an in-flight render or upload
      // chunk always finishes before a cancel takes effect. See src/core/render/composer.js.
      if (activePublish.cancelled) throw new Error('Cancelled');

      const video = await uploadClient.upload(
        videoPath,
        { title: job.metaTitle, description: job.metaDesc, tags: job.tags, privacyStatus: job.privacy },
        (p) => send({ stage: 'upload', ...p }),
      );

      if (job.coverPath) {
        // Best-effort — a failed thumbnail set shouldn't fail the whole publish.
        await uploadClient.setThumbnail(video.id, job.coverPath).catch(() => {});
      }

      quota.recordPublish({ captions: job.captions });

      return { videoId: video.id, url: `https://youtu.be/${video.id}`, videoPath };
    } finally {
      activePublish = null;
    }
  });

  ipcMain.handle('publish:cancel', () => {
    if (activePublish) activePublish.cancelled = true;
    return true;
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
