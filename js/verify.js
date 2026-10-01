// GYANU HUNT · photo analysis + swappable verification layer.
// Everything here runs on the phone: the full-size photo never leaves it.
// Only a ~20 KB thumbnail, its perceptual hash and its colour signature are sent.

import { RULES, qualityFromConfidence } from './rules.js';
import { CONFIG } from './config.js';

const THUMB = 320;

// Draw any image/video/bitmap into a canvas no larger than max px on its long side.
export function toCanvas(src, max = THUMB) {
  const w = src.videoWidth || src.naturalWidth || src.width;
  const h = src.videoHeight || src.naturalHeight || src.height;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// dHash: 9×8 greyscale, one bit per "is the right neighbour darker". 16 hex chars.
export function dhash(canvas) {
  const c = document.createElement('canvas');
  c.width = 9; c.height = 8;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(canvas, 0, 0, 9, 8);
  const d = x.getImageData(0, 0, 9, 8).data;
  const g = i => d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  let hex = '', nib = 0, n = 0;
  for (let y = 0; y < 8; y++) for (let i = 0; i < 8; i++) {
    const p = (y * 9 + i) * 4;
    nib = (nib << 1) | (g(p) > g(p + 4) ? 1 : 0);
    if (++n % 4 === 0) { hex += nib.toString(16); nib = 0; }
  }
  return hex;
}

export function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    let v = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (v) { n += v & 1; v >>= 1; }
  }
  return n;
}

// Colour signature: a brightness-robust hue histogram (18 hue bins for coloured pixels + 3 grey
// bins), plus how much of the frame is Gyanu pink and taxi yellow — the marker's two printed colours.
export function signature(canvas) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(canvas, 0, 0, 64, 64);
  const d = x.getImageData(0, 0, 64, 64).data;
  const hist = new Array(21).fill(0);
  let pink = 0, yellow = 0;
  const N = 64 * 64;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
    if (s < 0.35 || mx < 64) { hist[18 + Math.min(2, Math.floor(mx / 86))]++; continue; }
    let h;
    if (mx === r) h = ((g - b) / (mx - mn)) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4;
    h = (h * 60 + 360) % 360;
    hist[Math.floor(h / 20) % 18]++;
    if (s < 0.45 || mx < 110) continue;
    if (h >= 315 && h < 352) pink++;
    if (h >= 40 && h <= 62) yellow++;
  }
  return { hist: hist.map(v => +(v / N).toFixed(4)), pink: +(pink / N).toFixed(4), yellow: +(yellow / N).toFixed(4) };
}

const intersect = (a, b) => a.reduce((s, v, i) => s + Math.min(v, b[i] || 0), 0);

// 0..1 — how much this photo looks like THIS Gyanu: both marker colours present in real amounts,
// and a colour mix similar to the crew's reference photos of that exact spot.
export function markerScore(sig) { return Math.min(1, sig.yellow / 0.10) * Math.min(1, sig.pink / 0.04); }
export function confidence(analysis, refs = []) {
  const marker = markerScore(analysis.sig);
  if (!refs.length) return +(marker * 0.75).toFixed(3);
  let best = 0;
  for (const r of refs) if (r.sig?.hist?.length === analysis.sig.hist.length) best = Math.max(best, intersect(analysis.sig.hist, r.sig.hist));
  return +(0.5 * best + 0.5 * marker).toFixed(3);
}

// Turn a captured frame into what gets submitted.
export function analyse(source) {
  const canvas = toCanvas(source, THUMB);
  return {
    thumb: canvas.toDataURL('image/jpeg', 0.6),
    hash: dhash(canvas),
    sig: signature(canvas)
  };
}

// ---- The verification layer. Each strategy returns { status, confidence, quality, via }.
// status 'approved' = auto-approved; 'pending' = goes to the judges in the control room.
export const VERIFIERS = {
  // Option A: a human in the control room decides.
  manual: async () => ({ status: 'pending', confidence: null, quality: null, via: 'manual' }),

  // Option B: compare against the appearance's reference photos + Gyanu's marker colours.
  // Anything not confident enough goes to the judges rather than being rejected.
  reference: async (gyanu, a) => {
    const c = confidence(a, gyanu.refs || []);
    if (c >= RULES.autoApprove) return { status: 'approved', confidence: c, quality: qualityFromConfidence(c), via: 'reference' };
    return { status: 'pending', confidence: c, quality: null, via: 'reference' };
  },

  // Option C: a vision API, called only when configured. Falls back to the judges on any failure.
  vision: async (gyanu, a) => {
    if (!CONFIG.visionEndpoint) return VERIFIERS.reference(gyanu, a);
    try {
      const r = await fetch(CONFIG.visionEndpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gyanuId: gyanu.id, image: a.thumb })
      }).then(r => r.json());
      const c = Math.max(0, Math.min(1, Number(r.confidence) || 0));
      if (r.found && c >= RULES.autoApprove) return { status: 'approved', confidence: c, quality: qualityFromConfidence(c), via: 'vision' };
      return { status: 'pending', confidence: c, quality: null, via: 'vision' };
    } catch { return { status: 'pending', confidence: null, quality: null, via: 'vision-fallback' }; }
  }
};

export const verify = (gyanu, analysis) => (VERIFIERS[gyanu.verify] || VERIFIERS.manual)(gyanu, analysis);
