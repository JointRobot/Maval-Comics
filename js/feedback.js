// GYANU HUNT · the suggestion / complaint box. Tap the mic, talk, send. Or just type.
// - voice is recorded with MediaRecorder (small: ~24 kbit/s, 60 s max), played back before sending
// - live captions (optional) use the browser's own speech recognition so the crew gets text too
// - we attach only: screen name, phone/browser type, app version. No phone number, no location.
import { backend } from './backend.js';
import { CONFIG } from './config.js';
import { play } from './sfx.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAX_SEC = 60, MAX_B64 = 520000;
const KINDS = [['bug', '🐛', 'Something’s broken'], ['annoying', '😤', 'Annoying'], ['idea', '💡', 'Idea'], ['love', '❤️', 'Love it']];
const MOODS = ['😡', '😕', '😐', '🙂', '🤩'];
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const canRecord = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

function deviceInfo() {
  const ua = navigator.userAgent || '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'other';
  const inApp = /Instagram|FBAN|FBAV|Line\/|WhatsApp|Snapchat|; wv\)/i.test(ua) ? 'in-app browser' : '';
  const br = /SamsungBrowser/i.test(ua) ? 'Samsung Internet' : /Edg\//i.test(ua) ? 'Edge' : /Firefox/i.test(ua) ? 'Firefox' : /Chrome|CriOS/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'other';
  return { os, browser: inApp || br, w: innerWidth, h: innerHeight, lang: navigator.language, online: navigator.onLine, pwa: matchMedia('(display-mode: standalone)').matches };
}
const pickMime = () => ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find(m => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } });
const toB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function openFeedback({ screen } = {}) {
  document.querySelector('.fb')?.remove();
  const o = document.createElement('div'); o.className = 'ov fb';
  document.querySelector('#layer').appendChild(o);

  let kind = null, mood = 0, blob = null, blobUrl = '', mime = '', stream = null, mr = null, sr = null, srOn = false, capText = '';
  let secs = 0, timer = 0, raf = 0, actx = null, sending = false;

  const close = () => { stopRec(true); if (blobUrl) URL.revokeObjectURL(blobUrl); o.remove(); };

  function paint() {
    o.innerHTML = `<div class="fbcard">
      <button class="fbx" id="fbClose" aria-label="Close">✕</button>
      <h2>SPILL THE CHAI ☕</h2>
      <p class="fbsub">Bug? Idea? Rant? Love letter? Tap the mic and just talk. 20 seconds is plenty. Maval Comics reads every one.</p>

      <div class="fbmic" id="fbMic">
        ${!canRecord ? `<p class="fbhint">Voice notes aren’t available in this browser. No stress, type it below 👇</p>`
        : blob ? `<audio controls src="${blobUrl}" preload="metadata"></audio><button class="fbredo" id="fbRedo">🔁 re-record</button>`
        : mr ? `<button class="micbtn rec" id="fbStop" aria-label="Stop recording"><i></i></button><canvas id="fbWave" width="240" height="40"></canvas><p class="fbtime" id="fbTime">${mmss(secs)} / ${mmss(MAX_SEC)} · tap to stop</p>`
        : `<button class="micbtn" id="fbRec" aria-label="Start recording">🎙️</button><p class="fbtime">TAP &amp; TALK</p>`}
        <p class="fberr" id="fbErr"></p>
      </div>

      <label class="fblab" for="fbText">${blob || capText ? 'What we heard (fix it if it’s off)' : 'Or type it'}</label>
      <textarea id="fbText" rows="3" maxlength="1200" placeholder="e.g. The camera didn’t open on my phone"></textarea>

      <div class="fbchips" id="fbKinds">${KINDS.map(([k, e, l]) => `<button class="chip${kind === k ? ' on' : ''}" data-k="${k}">${e} ${l}</button>`).join('')}</div>
      <div class="fbmoods" id="fbMoods">${MOODS.map((m, i) => `<button class="${mood === i + 1 ? 'on' : ''}" data-m="${i + 1}" aria-label="Mood ${i + 1} of 5">${m}</button>`).join('')}</div>

      ${blob ? `<label class="fbtog"><input type="checkbox" id="fbVoice" checked> Send my voice too <small>(auto-deleted after 30 days)</small></label>` : ''}
      <button class="btn pink" id="fbSend" disabled>SEND IT 🚀</button>
      <p class="fbfine">We attach: the screen you’re on, phone/browser type, app version. No phone number. No location.${SR && canRecord ? ' Live captions use your browser’s speech service.' : ''}</p>
      <p class="fbcredit">${esc(CONFIG.credit)}</p>
    </div>`;
    const ta = o.querySelector('#fbText'); ta.value = keep; refresh();
    o.querySelector('#fbClose').onclick = close;
    o.querySelector('#fbRec')?.addEventListener('click', startRec);
    o.querySelector('#fbStop')?.addEventListener('click', () => stopRec(false));
    o.querySelector('#fbRedo')?.addEventListener('click', () => { if (blobUrl) URL.revokeObjectURL(blobUrl); blob = null; blobUrl = ''; capText = ''; paint(); });
    o.querySelector('#fbKinds').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; kind = kind === b.dataset.k ? null : b.dataset.k; play('tap'); o.querySelectorAll('#fbKinds .chip').forEach(c => c.classList.toggle('on', c.dataset.k === kind)); };
    o.querySelector('#fbMoods').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; mood = mood === +b.dataset.m ? 0 : +b.dataset.m; play('tap'); o.querySelectorAll('#fbMoods button').forEach(c => c.classList.toggle('on', +c.dataset.m === mood)); };
    ta.oninput = () => { keep = ta.value; refresh(); };
    o.querySelector('#fbSend').onclick = send;
    if (mr) drawWave();
  }
  let keep = '';
  const refresh = () => { const b = o.querySelector('#fbSend'); if (b) b.disabled = sending || !(keep.trim() || blob); };
  const setErr = m => { const e = o.querySelector('#fbErr'); if (e) e.textContent = m || ''; };

  // ---------------- recording ----------------
  async function startRec() {
    setErr('');
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { return setErr('Couldn’t reach the mic. Allow it in your browser, or just type below.'); }
    mime = pickMime() || '';
    const chunks = [];
    try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 }); }
    catch { stream.getTracks().forEach(t => t.stop()); stream = null; return setErr('This browser can’t record. Type it below instead.'); }
    mime = mr.mimeType || mime || 'audio/webm';
    mr.ondataavailable = e => e.data?.size && chunks.push(e.data);
    mr.onstop = () => {
      stream?.getTracks().forEach(t => t.stop()); stream = null; mr = null; cancelAnimationFrame(raf); clearInterval(timer); actx?.close?.().catch(() => {}); actx = null;
      stopCaptions();
      if (cancelled) return;
      blob = new Blob(chunks, { type: mime.split(';')[0] || 'audio/webm' }); blobUrl = URL.createObjectURL(blob);
      if (capText && !keep.trim()) keep = capText.trim();
      play('pop'); paint();
    };
    cancelled = false; secs = 0; capText = '';
    mr.start(1000); play('beep');
    timer = setInterval(() => { secs++; const t = o.querySelector('#fbTime'); if (t) t.textContent = `${mmss(secs)} / ${mmss(MAX_SEC)} · tap to stop`; if (secs >= MAX_SEC) stopRec(false); }, 1000);
    try { // level meter
      const AC = window.AudioContext || window.webkitAudioContext; actx = new AC(); const src = actx.createMediaStreamSource(stream);
      analyser = actx.createAnalyser(); analyser.fftSize = 128; src.connect(analyser);
    } catch { analyser = null; }
    startCaptions();
    paint();
  }
  let cancelled = false, analyser = null;
  function stopRec(discard) { cancelled = !!discard; if (mr && mr.state !== 'inactive') { try { mr.stop(); } catch {} } else { stream?.getTracks().forEach(t => t.stop()); stream = null; } clearInterval(timer); cancelAnimationFrame(raf); stopCaptions(); }
  function drawWave() {
    const c = o.querySelector('#fbWave'); if (!c || !analyser) return; const x = c.getContext('2d'), d = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      if (!mr || !o.isConnected) return; analyser.getByteFrequencyData(d); x.clearRect(0, 0, c.width, c.height);
      const n = 24, w = c.width / n; for (let i = 0; i < n; i++) { const v = d[i * 2] / 255, h = 4 + v * 34; x.fillStyle = i % 2 ? '#FF2E88' : '#FFD400'; x.fillRect(i * w + 2, (c.height - h) / 2, w - 4, h); }
      raf = requestAnimationFrame(loop);
    }; loop();
  }
  function startCaptions() {
    if (!SR) return;
    try {
      sr = new SR(); sr.continuous = true; sr.interimResults = true; sr.lang = /^hi/i.test(navigator.language) ? 'hi-IN' : 'en-IN'; srOn = true; let fin = '';
      sr.onresult = e => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript + ' '; else interim += r[0].transcript; } capText = (fin + interim).trim(); };
      sr.onend = () => { if (srOn && mr) { try { sr.start(); } catch {} } };
      sr.onerror = () => {};
      sr.start();
    } catch { sr = null; }
  }
  function stopCaptions() { srOn = false; try { sr?.stop(); } catch {} sr = null; }

  // ---------------- sending ----------------
  async function send() {
    if (sending) return; sending = true; const btn = o.querySelector('#fbSend'); btn.disabled = true; btn.textContent = 'SENDING…'; setErr('');
    try {
      let audio = null;
      if (blob && o.querySelector('#fbVoice')?.checked) { audio = await toB64(blob); if (audio.length > MAX_B64) audio = null; }
      await backend.feedback({ kind: kind || 'other', text: keep.trim(), mood, audio, mime: audio ? (blob.type || mime) : null, ctx: { screen: typeof screen === 'function' ? screen() : screen || '', v: CONFIG.version, backend: backend.kind, ...deviceInfo() } });
      play('level'); done();
    } catch (e) {
      sending = false; btn.textContent = 'SEND IT 🚀'; refresh(); setErr(e?.message || 'No signal? Your note is still here. Tap send again.');
    }
  }
  function done() {
    const demo = backend.kind === 'local', note = keep.trim(), voice = blob, canShare = demo && !!navigator.share;
    o.innerHTML = `<div class="fbcard center"><div class="fbbig">${demo ? '📝' : '🙌'}</div><h2>${demo ? 'SAVED ON THIS PHONE' : 'GOT IT. THANK YOU.'}</h2>
      <p class="fbsub">${demo ? 'This is the demo version, so the crew inbox isn’t connected yet and your note stayed on this phone. Want it to actually reach the makers? Share it from here.' : 'Every note gets read by a human at Maval Comics. If it was a bug, you just helped everyone playing.'}</p>
      ${canShare ? '<button class="btn pink" id="fbShare">📤 SHARE THIS NOTE</button>' : ''}
      <button class="btn ${canShare ? 'ghost' : 'pink'}" id="fbAgain">SEND ANOTHER</button><button class="link" id="fbDone">back to the hunt</button><p class="fbcredit">${esc(CONFIG.credit)}</p></div>`;
    o.querySelector('#fbDone').onclick = close;
    o.querySelector('#fbShare')?.addEventListener('click', async () => {
      const text = `Gyanu Hunt feedback${note ? ': ' + note : ''}`; const data = { title: 'Gyanu Hunt feedback', text };
      try {
        if (voice) { const f = new File([voice], 'gyanu-feedback.' + (voice.type.includes('mp4') ? 'm4a' : 'webm'), { type: voice.type }); if (navigator.canShare?.({ files: [f] })) data.files = [f]; }
        await navigator.share(data);
      } catch {}
    });
    o.querySelector('#fbAgain').onclick = () => { kind = null; mood = 0; keep = ''; capText = ''; blob = null; if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = ''; sending = false; paint(); };
  }

  paint();
  return { close };
}
