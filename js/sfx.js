// GYANU HUNT · sound + voice. Every sound is synthesised live with WebAudio, so there are
// zero audio files to download, nothing to license, and nothing that can be copyright-struck.
// Want real recordings instead? Put CC0 clips (freesound.org / pixabay) in /audio and map them
// in CONFIG.sfxFiles, e.g. { horn: 'audio/horn.mp3' }. Any sound with a file uses it; the rest stay synthesised.
import { CONFIG } from './config.js';

const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let ctx = null, master = null, noiseBuf = null, muted = ls.get('gh_mute') === '1', voice = ls.get('gh_voice') !== '0';
const files = {};            // name -> decoded AudioBuffer (optional overrides)
let beatTimer = 0, beatN = 0;

export const sfxState = { get muted() { return muted; }, get voice() { return voice; } };

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  Object.entries(CONFIG.sfxFiles || {}).forEach(([k, u]) => fetch(u).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => (files[k] = buf)).catch(() => {}));
  return ctx;
}
// Browsers only allow audio after a tap. Call this from any user gesture (done once, globally, in app.js).
export function unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }

const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
function tone(type, f0, f1, t, dur, vol = 0.3, dest = master) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.008, vol, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o;
}
function noise(t, dur, vol, f0, f1, q = 1, type = 'bandpass') {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain(); env(g, t, 0.005, vol, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}

const S = {
  tap: t => tone('square', 900, 700, t, 0.05, 0.12),
  pop: t => { tone('sine', 700, 180, t, 0.13, 0.4); noise(t, 0.04, 0.15, 3000, 2000); },
  whoosh: t => noise(t, 0.35, 0.35, 300, 3500, 0.8),
  // the "vine boom" energy: a falling sub-bass thump with a crunchy click on top
  boom: t => { tone('sine', 120, 34, t, 0.7, 0.9); tone('triangle', 240, 50, t, 0.4, 0.3); noise(t, 0.12, 0.3, 900, 200, 0.7, 'lowpass'); },
  horn: t => { [0, 0.16, 0.32].forEach((d, i) => { const len = i === 2 ? 0.55 : 0.12; [466, 622, 932].forEach(f => { const o = tone('sawtooth', f, f * 0.985, t + d, len, 0.12); }); }); },
  dhol: t => { tone('sine', 150, 55, t, 0.28, 0.9); noise(t, 0.03, 0.25, 2500, 1500); },
  thali: t => { [1180, 1730, 2390, 3150].forEach((f, i) => tone('sine', f, f * 0.99, t, 0.35 - i * 0.05, 0.1)); noise(t, 0.05, 0.12, 6000, 5000, 2, 'highpass'); },
  clap: t => { [0, 0.012, 0.026].forEach(d => noise(t + d, 0.06, 0.28, 1500, 1200, 1.2)); },
  cash: t => { tone('square', 1318, 1318, t, 0.09, 0.14); tone('square', 1760, 1760, t + 0.09, 0.35, 0.14); noise(t + 0.09, 0.25, 0.08, 7000, 6000, 3, 'highpass'); },
  level: t => [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, t + i * 0.08, 0.16, 0.14)),
  tada: t => { [523, 659, 784].forEach(f => tone('sawtooth', f, f, t, 0.18, 0.1)); [523, 659, 784, 1047].forEach(f => tone('sawtooth', f, f, t + 0.2, 0.7, 0.1)); },
  sad: t => { [[392, 0], [370, 0.3], [349, 0.6]].forEach(([f, d]) => tone('sawtooth', f, f * 0.98, t + d, 0.28, 0.16)); tone('sawtooth', 330, 220, t + 0.9, 0.9, 0.16); },
  bruh: t => { tone('sawtooth', 150, 82, t, 0.42, 0.28); noise(t, 0.4, 0.12, 700, 300, 4); },
  siren: t => [0, 1, 2, 3].forEach(i => tone('square', i % 2 ? 940 : 700, i % 2 ? 940 : 700, t + i * 0.18, 0.17, 0.12)),
  whistle: t => { const o = tone('sine', 2100, 2700, t, 0.5, 0.18); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 22; lg.gain.value = 60; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.55); },
  beep: t => tone('square', 1000, 1000, t, 0.12, 0.15)
};

export function play(name, delay = 0) {
  if (muted) return; const c = ensure(); if (!c) return;
  const t = c.currentTime + delay + 0.01;
  if (files[name]) { const s = c.createBufferSource(); s.buffer = files[name]; s.connect(master); s.start(t); return; }
  try { S[name]?.(t); } catch {}
}
export const combo = (...names) => names.forEach((n, i) => play(n, i * 0.14));

// the protest-drum loop used during hype moments: dhol, thali, clap
export function beat(on) {
  clearInterval(beatTimer); beatTimer = 0; if (!on) return;
  beatN = 0;
  beatTimer = setInterval(() => { const k = beatN++ % 4; play(k === 0 || k === 2 ? 'dhol' : k === 1 ? 'thali' : 'clap'); }, 330);
}

export function setMuted(m) { muted = !!m; ls.set('gh_mute', m ? '1' : '0'); if (master) master.gain.value = m ? 0 : 0.9; if (m) { beat(false); stopSpeak(); } }
export function setVoice(v) { voice = !!v; ls.set('gh_voice', v ? '1' : '0'); if (!v) stopSpeak(); }

// ---- narration: the phone's own text-to-speech (free, offline, no files). Prefers an Indian-English / Hindi voice.
let voices = [];
const loadVoices = () => { try { voices = speechSynthesis.getVoices(); } catch {} };
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
export const canSpeak = () => 'speechSynthesis' in window;
export function stopSpeak() { try { speechSynthesis.cancel(); } catch {} }
// Resolves when the line ends (or after a fallback timeout so a silent device never stalls the tour).
export function speak(text) {
  return new Promise(res => {
    const est = Math.max(2500, text.length * 62);
    if (muted || !voice || !canSpeak()) return setTimeout(res, est);
    stopSpeak();
    const u = new SpeechSynthesisUtterance(text);
    const v = voices.find(v => /en[-_]IN/i.test(v.lang)) || voices.find(v => /hi[-_]IN/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-IN';
    u.rate = 1.04; u.pitch = 1.12; u.volume = 1;
    // never resolve before a person could have read the card, even if the voice errors out instantly
    const minAt = performance.now() + Math.max(2200, text.length * 55);
    let done = false; const fin = () => { if (done) return; done = true; setTimeout(res, Math.max(0, minAt - performance.now())); };
    u.onend = fin; u.onerror = fin; setTimeout(fin, est + 6000);
    try { speechSynthesis.speak(u); } catch { fin(); }
  });
}

// Short Hindi lines for Gyanu to say while he is being whacked / punched / slapped. Never queues up: if he is still talking, skip.
let hiBusy = 0;
export function sayHi(text, { rate = 1.1, pitch = 1.5, gap = 0 } = {}) {
  if (muted || !voice || !canSpeak()) return;
  const t = performance.now(); if (hiBusy > t) return;
  const u = new SpeechSynthesisUtterance(text);
  const v = voices.find(v => /hi[-_]IN/i.test(v.lang)) || voices.find(v => /en[-_]IN/i.test(v.lang));
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'hi-IN';
  u.rate = rate; u.pitch = pitch; u.volume = 1;
  hiBusy = t + 400 + text.length * 55 + gap;
  u.onend = u.onerror = () => { hiBusy = performance.now() + gap; };
  try { speechSynthesis.speak(u); } catch { hiBusy = 0; }
}
