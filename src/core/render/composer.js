'use strict';
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

let activeJob = null;

ipcMain.on('render:progress', (event, payload) => {
  if (activeJob && event.sender === activeJob.sender) activeJob.onProgress(payload);
});

ipcMain.on('render:done', async (event, webmBase64) => {
  if (!activeJob || event.sender !== activeJob.sender) return;
  const job = activeJob;
  activeJob = null;
  clearTimeout(job.timeout);
  try {
    const tmpWebm = path.join(os.tmpdir(), `mytube-${Date.now()}.webm`);
    fs.writeFileSync(tmpWebm, Buffer.from(webmBase64, 'base64'));

    const outDir = path.join(os.homedir(), 'Movies', 'MyTube');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `${sanitize(job.title)}-${Date.now()}.mp4`);

    job.onProgress({ phase: 'Encoding…' });
    await mux(tmpWebm, job.audioPath, outFile);
    fs.unlinkSync(tmpWebm);
    job.win.destroy();
    job.resolve(outFile);
  } catch (err) {
    if (!job.win.isDestroyed()) job.win.destroy();
    job.reject(err);
  }
});

ipcMain.on('render:error', (event, message) => {
  if (!activeJob || event.sender !== activeJob.sender) return;
  const job = activeJob;
  activeJob = null;
  clearTimeout(job.timeout);
  if (!job.win.isDestroyed()) job.win.destroy();
  job.reject(new Error(message));
});

// job: { audioPath, coverPath, title, artist, composition, resolution }
// onProgress({ phase, uploadedBytes, totalBytes }) — reused field names so the renderer's
// existing progress-bar UI works unchanged for both render and upload phases.
function renderVideo(job, onProgress) {
  return new Promise((resolve, reject) => {
    if (activeJob) { reject(new Error('A render is already in progress — renders run one at a time')); return; }

    const win = new BrowserWindow({
      show: false,
      width: job.resolution === '4K' ? 3840 : 1920,
      height: job.resolution === '4K' ? 2160 : 1080,
      webPreferences: {
        preload: path.join(__dirname, '..', '..', '..', 'renderer', 'render-preload.js'),
        contextIsolation: true,
        autoplayPolicy: 'no-user-gesture-required',
      },
    });

    const timeout = setTimeout(() => {
      if (activeJob) {
        activeJob = null;
        if (!win.isDestroyed()) win.destroy();
        reject(new Error('Render timed out'));
      }
    }, 10 * 60 * 1000);

    activeJob = { sender: win.webContents, win, onProgress, resolve, reject, timeout, audioPath: job.audioPath, title: job.title };

    win.loadFile(path.join(__dirname, '..', '..', '..', 'renderer', 'render.html'))
      .then(() => {
        win.webContents.send('render:start', {
          audioPath: toFileUrl(job.audioPath),
          coverPath: job.coverPath ? toFileUrl(job.coverPath) : null,
          title: job.title,
          artist: job.artist,
          composition: job.composition,
          resolution: job.resolution,
        });
      })
      .catch((err) => {
        activeJob = null;
        clearTimeout(timeout);
        reject(err);
      });
  });
}

function toFileUrl(p) {
  return 'file://' + p.split(path.sep).join('/');
}

function sanitize(s) {
  return String(s).replace(/[^\w\- ]+/g, '').trim().slice(0, 80) || 'MyTube';
}

function mux(videoPath, audioPath, outFile) {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', videoPath, '-i', audioPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', outFile];
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-2000)}`))));
    proc.on('error', reject);
  });
}

module.exports = { renderVideo };
