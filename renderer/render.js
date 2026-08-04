'use strict';

const canvas = document.getElementById('c');
const audio = document.getElementById('a');

window.renderBridge.onStart(async (payload) => {
  try {
    await run(payload);
  } catch (err) {
    window.renderBridge.sendError(err.message || String(err));
  }
});

async function run({ audioPath, coverPath, title, artist, composition, resolution }) {
  const w = resolution === '4K' ? 3840 : 1920;
  const h = resolution === '4K' ? 2160 : 1080;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const cover = coverPath ? await loadImage(coverPath).catch(() => null) : null;

  audio.src = audioPath;
  await new Promise((resolve, reject) => {
    audio.addEventListener('loadedmetadata', resolve, { once: true });
    audio.addEventListener('error', () => reject(new Error('Could not load audio for rendering')), { once: true });
  });

  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaElementSource(audio);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  // Audio isn't needed in the recorded stream — ffmpeg muxes the original file back in
  // at full quality afterward, so route to a silent sink purely to keep the AnalyserNode fed.
  const silent = audioCtx.createGain();
  silent.gain.value = 0;
  analyser.connect(silent);
  silent.connect(audioCtx.destination);

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: resolution === '4K' ? 20_000_000 : 8_000_000,
  });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = async () => {
    try {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const buf = await blob.arrayBuffer();
      window.renderBridge.sendDone(arrayBufferToBase64(buf));
    } catch (err) {
      window.renderBridge.sendError(err.message || String(err));
    }
  };

  const duration = audio.duration;
  let raf;
  let lastProgress = 0;

  function draw() {
    drawFrame(ctx, w, h, composition, title, artist, cover, analyser, dataArray);
    const now = audio.currentTime;
    if (now - lastProgress > 0.5) {
      lastProgress = now;
      window.renderBridge.sendProgress({
        phase: `Rendering frames… ${Math.floor(now)}s of ${Math.floor(duration)}s`,
        uploadedBytes: now,
        totalBytes: duration,
      });
    }
    if (!audio.ended) raf = requestAnimationFrame(draw);
  }

  audio.addEventListener('ended', () => {
    cancelAnimationFrame(raf);
    recorder.stop();
  }, { once: true });

  recorder.start(1000);
  await audio.play();
  draw();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawFrame(ctx, w, h, composition, title, artist, cover, analyser, dataArray) {
  analyser.getByteFrequencyData(dataArray);

  ctx.fillStyle = '#141311';
  ctx.fillRect(0, 0, w, h);

  if (composition === 'Backdrop' && cover) {
    ctx.save();
    ctx.filter = 'blur(40px) brightness(0.55)';
    drawCover(ctx, cover, -w * 0.1, -h * 0.1, w * 1.2, h * 1.2, 0);
    ctx.restore();
  }

  if (composition === 'Vinyl') {
    const t = performance.now() / 1000;
    const r = h * 0.32;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((t * (2 * Math.PI / 8)) % (2 * Math.PI));
    const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    grad.addColorStop(0, '#2a2723');
    grad.addColorStop(0.19, '#191713');
    grad.addColorStop(0.6, '#211e1a');
    grad.addColorStop(1, '#191713');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  const coverSize = (composition === 'Waveform' || composition === 'Minimal') ? h * 0.16 : h * 0.24;
  const cx = w / 2;
  const cy = h / 2 - h * 0.05;
  if (cover) {
    drawCover(ctx, cover, cx - coverSize / 2, cy - coverSize / 2, coverSize, coverSize, h * 0.012);
  } else {
    ctx.fillStyle = '#2a2723';
    roundRect(ctx, cx - coverSize / 2, cy - coverSize / 2, coverSize, coverSize, h * 0.012);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4f2ee';
  ctx.font = `600 ${Math.round(h * 0.028)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillText(title, cx, cy + coverSize / 2 + h * 0.05);
  ctx.fillStyle = '#8a867e';
  ctx.font = `${Math.round(h * 0.02)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillText(artist, cx, cy + coverSize / 2 + h * 0.08);

  const barCount = 24;
  const barW = composition === 'Waveform' ? w * 0.006 : w * 0.0035;
  const gap = w * 0.003;
  const totalW = barCount * (barW + gap);
  const baseY = h * 0.86;
  const maxH = h * 0.12;
  const opacity = composition === 'Minimal' ? 0.3 : 0.9;
  ctx.fillStyle = `rgba(201,196,186,${opacity})`;
  for (let i = 0; i < barCount; i++) {
    const v = dataArray[Math.floor((i / barCount) * dataArray.length)] / 255;
    const bh = Math.max(h * 0.004, v * maxH);
    const x = w / 2 - totalW / 2 + i * (barW + gap);
    ctx.fillRect(x, baseY - bh, barW, bh);
  }
}

function drawCover(ctx, img, x, y, w, h, radius) {
  if (radius) {
    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.clip();
  }
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale;
  const ih = img.height * scale;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  if (radius) ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function arrayBufferToBase64(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
