// GYANU HUNT · the player app. Vanilla JS, no framework, one module graph.
import { CONFIG, ZONES, SCENE_CATS } from './config.js';
import { ROACHES, roachSvg, ensureSprite } from './roaches.js';
import { T, SLOGANS, SLOGAN_SETS, SLOGAN_LANGS, defaultSloganLang, scriptOf, RULES_COPY, INTRO, TOUR, gsay } from './copy.js';
import { RULES, speedBonus } from './rules.js';
import { backend, cleanNick, cleanSlogan } from './backend.js';
import { analyse, verify } from './verify.js';
import { IsoMap } from './iso.js';
import { micMeter, motionMeter, tapMeter } from './sensors.js';
import { shareCard } from './share.js';
import { play, combo, unlock, setMuted, sfxState, stopSpeak } from './sfx.js';
import { runTour, tourOpen } from './tour.js';
import { openFeedback } from './feedback.js';

// ---------------------------------------------------------------- helpers
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('en-IN');
const zoneName = id => ZONES.find(z => z.id === id)?.name || id;
const cat = id => SCENE_CATS.find(c => c.id === id) || { icon: '?', label: id };
const pick = a => a[Math.floor(Math.random() * a.length)];
const ago = t => { const s = Math.max(0, Math.round((serverNow() - t) / 1000)); return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`; };
const buzz = p => { try { navigator.vibrate?.(p); } catch {} };
const AV = ['#FF2E88', '#FFD400', '#00A99D', '#FF8A1F', '#2B59C3', '#6B3FA0'];
const AVP = ['', 'repeating-linear-gradient(45deg,rgba(0,0,0,.14) 0 4px,transparent 4px 9px)', 'radial-gradient(rgba(0,0,0,.18) 1.5px,transparent 2px) 0 0/7px 7px', 'linear-gradient(transparent 55%,rgba(0,0,0,.16) 55%)'];
const avatar = (a, nick, size = 40) => a && Number.isInteger(a.r)
  ? `<div class="av roachav" style="width:${size}px;height:${size}px;background:${ROACHES[a.r % ROACHES.length].bg}" role="img" aria-label="${esc(nick || '')} roach">${roachSvg(a.r)}</div>`
  : `<div class="av" style="width:${size}px;height:${size}px;background:${AV[a?.c ?? 0]};background-image:${AVP[a?.p ?? 0] || 'none'};color:${(a?.c ?? 0) === 1 ? '#15131A' : '#fff'}">${esc((nick || '?')[0])}</div>`;

let offset = 0; const serverNow = () => Date.now() + offset;
let st = null;                       // last server state
let view = 'hunt', selHunt = null, scope = 'global', sceneFilter = null;
let map = null, sceneMap = null, whack = null;
const seen = new Set(JSON.parse(sessionStorage.getItem('gh_seen') || '[]'));
const markSeen = k => { seen.add(k); sessionStorage.setItem('gh_seen', JSON.stringify([...seen])); };

function layer(html, cls = '') {
  const el = document.createElement('div');
  el.className = 'ov ' + cls; el.innerHTML = html;
  $('#layer').appendChild(el);
  return el;
}
const closeAll = sel => document.querySelectorAll('#layer ' + (sel || '.ov')).forEach(e => e.remove());
function toast(msg, ms = 2600) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('#app').appendChild(t); setTimeout(() => t.remove(), ms);
}
function confetti(n = 60) {
  const c = document.createElement('div'); c.className = 'confetti';
  const cols = ['#FFD400', '#FF2E88', '#00A99D', '#fff', '#FF8A1F'];
  c.innerHTML = Array.from({ length: n }, () => `<i style="left:${Math.random() * 100}%;background:${pick(cols)};animation-delay:${Math.random() * 0.5}s;animation-duration:${1.2 + Math.random()}s"></i>`).join('');
  $('#app').appendChild(c); setTimeout(() => c.remove(), 2600);
}

// ---------------------------------------------------------------- landing + join
function fillStatic() {
  $('#edition').textContent = CONFIG.edition; $('#topEd').textContent = CONFIG.edition;
  $('#landSub').textContent = T.sub; $('#playBtn').textContent = T.play; $('#homeLink').textContent = '🔨 WHACK-A-GYANU'; $('#landSafety').textContent = T.safety;
  $('#joinTitle').textContent = T.joinTitle; $('#joinHelp').textContent = T.joinHelp;
  $('#sloganTitle').textContent = T.sloganTitle; $('#sloganHelp').textContent = T.sloganHelp; $('#sloganCustom').placeholder = T.sloganPh;
  $('#otpTitle').textContent = T.otpTitle; $('#otpHelp').textContent = T.otpHelp; $('#otpSend').textContent = T.otpSend;
  $('#landCredit').innerHTML = `🪳 ${esc(CONFIG.credit)}`;
  $('#joinGo').textContent = T.joinGo; $('#ticker').textContent = T.safety;
  document.querySelectorAll('#nav button').forEach(b => (b.querySelector('span').textContent = T.nav[b.dataset.v] || 'SCENE'));
}

let wantHome = false, otpOk = CONFIG.otp === 'off', demoCode = null;
let sloganLang = defaultSloganLang(), chosenSlogan = SLOGAN_SETS[sloganLang][0];
const langTabsHtml = (cur, attr = 'data-l') => SLOGAN_LANGS.map(([id, label]) => `<button class="chip${cur === id ? ' on' : ''}" ${attr}="${id}">${esc(label)}</button>`).join('');
function renderJoinSlogans() {
  const box = $('#slogans'), customOn = chosenSlogan === null;
  $('#sloganLangs').innerHTML = langTabsHtml(sloganLang);
  box.innerHTML = SLOGAN_SETS[sloganLang].map(x => `<button class="chip${x === chosenSlogan ? ' on' : ''}" data-s="${esc(x)}">${esc(x)}</button>`).join('') + `<button class="chip${customOn ? ' on' : ''}" data-custom="1">✍️ ${esc(T.sloganCustom)}</button>`;
}
function showJoin(home) {
  wantHome = !!home;
  $('#landing').classList.add('hide'); $('#join').classList.remove('hide');
  sloganLang = defaultSloganLang(); chosenSlogan = SLOGAN_SETS[sloganLang][0]; renderJoinSlogans();
  $('#sloganLangs').onclick = e => { const b = e.target.closest('[data-l]'); if (!b) return; sloganLang = b.dataset.l; renderJoinSlogans(); };
  $('#slogans').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const custom = !!b.dataset.custom; $('#sloganCustom').classList.toggle('hide', !custom);
    chosenSlogan = custom ? null : b.dataset.s; renderJoinSlogans(); if (custom) $('#sloganCustom').focus();
  };
  $('#otpBox').classList.toggle('hide', CONFIG.otp === 'off');
  $('#nick').focus();
}
async function sendOtp() {
  const phone = $('#phone').value.replace(/[^\d+]/g, '');
  if (phone.replace(/\D/g, '').length < 10) return ($('#joinErr').textContent = 'That number looks short.');
  $('#joinErr').textContent = '';
  try {
    if (CONFIG.otp === 'supabase') await backend.otpSend(phone);
    else { demoCode = String(100000 + Math.floor(Math.random() * 900000)); toast(T.otpDemo(demoCode), 8000); }
    $('#otpCode').classList.remove('hide'); $('#otpCode').focus();
  } catch (e) { $('#joinErr').textContent = e.message; }
}
async function doJoin() {
  const n = cleanNick($('#nick').value); if (n.error) return ($('#joinErr').textContent = n.error);
  const sl = cleanSlogan(chosenSlogan ?? $('#sloganCustom').value); if (sl.error) return ($('#joinErr').textContent = sl.error);
  $('#joinGo').disabled = true; $('#joinErr').textContent = '';
  try {
    if (CONFIG.otp !== 'off' && !otpOk) {
      const code = $('#otpCode').value.trim();
      if (!code) throw new Error('Enter the code we sent.');
      if (CONFIG.otp === 'supabase') await backend.otpVerify($('#phone').value.replace(/[^\d+]/g, ''), code);
      else if (code !== demoCode) throw new Error('That code did not work.');
      otpOk = true;
      $('#phone').value = ''; // the number is never stored by the app itself
    }
    await backend.register(n.nick, sl.slogan);
    play('level'); await enterGame();
    if (wantHome) startWhack();
  } catch (e) { $('#joinErr').textContent = e.message; }
  $('#joinGo').disabled = false;
}

const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
function startTour() { go('hunt'); runTour(TOUR(st?.me?.nick || 'HUNTER'), { onDone: () => { go('hunt'); } }); }

// ---------------------------------------------------------------- game shell
async function enterGame() {
  $('#landing').classList.add('hide'); $('#join').classList.add('hide'); $('#game').classList.remove('hide');
  if (!map) {
    map = new IsoMap($('#map'), {
      onHunt: id => { selHunt = id; renderSheet(); },
      onZone: (z, kind) => { if (kind === 'scene') { go('scene'); sceneFilter = null; renderScene(z); } else { const h = st?.hunts.find(h => h.zone === z && !h.found); if (h) { selHunt = h.id; renderSheet(); } else toast(`${zoneName(z)} — no Gyanu pinging here rn.`); } },
      onPop: p => { if (whack) { play(p.kind === 'roach' ? 'bruh' : p.kind === 'gold' ? 'cash' : 'pop'); whack.hit(p); } },
      padBottom: () => ($('#sheet').offsetHeight || 0) + 10
    });
    new ResizeObserver(() => map.refit()).observe($('#sheet'));
    $('#zin').onclick = () => map.zoomBy(1.4); $('#zout').onclick = () => map.zoomBy(1 / 1.4);
  }
  map.start(); window.gyanuMap = map; // handy for testing from the console
  await refresh();
}

function go(v) {
  view = v;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  for (const id of ['hunt', 'scene', 'score', 'rules', 'profile']) $('#v-' + id).classList.toggle('hide', id !== v);
  if (v === 'hunt') map?.start(); else map?.stop();
  if (v !== 'scene') sceneMap?.stop();
  if (v === 'scene') renderScene(); if (v === 'score') renderBoard(); if (v === 'rules') renderRules(); if (v === 'profile') renderProfile();
}

let refreshing = false, again = false, sceneTick = 0;
async function refresh() {
  if (refreshing) { again = true; return; }
  refreshing = true;
  try {
    const s = await backend.state();
    offset = s.serverNow - Date.now();
    if (!s.me) { // deleted elsewhere, or unknown device
      if (!$('#game').classList.contains('hide')) { localStorage.removeItem('gh_me_v1'); location.reload(); }
      return;
    }
    st = s;
    renderTop(); renderSheet(); renderStatus(); handleAlerts(); handleNotices(); handleHype();
    map.setState({ hunts: whack ? [] : st.hunts, zones: st.zones, mood: st.settings.finalLive ? 'final' : 'evening' });
    if (view === 'scene' || ++sceneTick % 4 === 1) refreshSceneData(); if (view === 'score') renderBoard(true);
  } catch (e) { console.warn(e); renderStatus(true); }
  finally { refreshing = false; if (again) { again = false; refresh(); } }
}

function renderTop() {
  $('#topPts').textContent = fmt(st.me.score);
  const sk = $('#topStreak'); sk.classList.toggle('hide', st.me.streak < 2); sk.textContent = (st.me.streak >= 5 ? '🪳 ×' : 'STREAK ×') + st.me.streak;
}

function renderStatus(offline) {
  const s = st?.stats, chips = [];
  if (offline) chips.push(`<span class="chip alert">📶 weak network — retrying</span>`);
  if (st?.settings.finalLive) chips.push(`<span class="chip alert">FINAL GYANU LIVE</span>`);
  if (s) chips.push(`<span class="chip">🟢 ${s.online} hunting</span>`, `<span class="chip">🎯 ${s.caught} caught today</span>`, `<button class="chip crowdchip" data-crowd="1">🪧 ${fmt(s.crowd || 0)} in the crowd</button>`);
  if (s?.busy?.length) chips.push(`<span class="chip alert">⚠️ busy: ${s.busy.map(z => ZONES.find(q => q.id === z)?.short).join(', ')}</span>`);
  $('#status').innerHTML = chips.join('');
}

const openHunts = () => (st?.hunts || []).filter(h => !h.found).sort((a, b) => ({ final: 0, golden: 1, classic: 2 }[a.type] - { final: 0, golden: 1, classic: 2 }[b.type]));

function speedLine(h) {
  const secs = (serverNow() - h.activatedAt) / 1000;
  const b = speedBonus(secs); if (!b) return '';
  const tier = RULES.speed.find(([lim]) => secs < lim);
  const left = Math.max(0, Math.ceil(tier[0] - secs));
  return `⚡ SPEED BONUS +${b} · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

function renderSheet() {
  if (!st || whack) { $('#sheet').innerHTML = ''; return; }
  const el = $('#sheet');
  if (st.me.banned) { el.innerHTML = `<div class="panel paused"><h3>${esc(T.blockTitle)}</h3><p>${esc(T.banned)}</p></div>`; return; }
  if (st.settings.paused) {
    el.innerHTML = `<div class="panel paused"><h3>⏸ ${esc(T.pausedTitle)}</h3><p style="font-weight:700;margin-top:6px">${esc(st.settings.pauseReason || T.pausedDefault)}</p></div>`; return;
  }
  const open = openHunts();
  if (!open.length) {
    el.innerHTML = `<div class="panel"><h3>${esc(T.noHunts)}</h3><p class="muted" style="margin:6px 0 10px">${esc(T.noHuntsSub)}</p>
      <div class="row"><button class="btn teal" id="wBtn" style="font-size:15px">🔨 WHACK</button><button class="btn teal" id="pBtn" style="font-size:15px">🥊 PUNCH</button></div><button class="btn ghost" data-go="scene" style="margin-top:8px">📍 THE SCENE</button></div>`;
    el.querySelector('[data-go]').onclick = () => go('scene'); $('#wBtn').onclick = startWhack; $('#pBtn').onclick = startPunch;
    return;
  }
  if (!open.some(h => h.id === selHunt)) selHunt = open[0].id;
  const h = open.find(x => x.id === selHunt);
  map.setState({ selected: h.id });
  const triesLeft = RULES.maxTriesPerGyanu - h.tries;
  const tag = h.type === 'golden' ? '✨ GOLDEN' : h.type === 'final' ? '💀 FINAL BOSS' : 'CLASSIC';
  el.innerHTML = `<div class="panel">
    ${open.length > 1 ? `<div class="pickhunts">${open.map(o => `<button class="chip${o.id === h.id ? ' on' : ''}" data-h="${o.id}">${o.type === 'golden' ? '✨' : o.type === 'final' ? '💀' : '🎯'} ${esc(ZONES.find(z => z.id === o.zone)?.short)}</button>`).join('')}</div>` : ''}
    <h3>${esc(T.hiding)}</h3>
    <div class="huntmeta"><span class="tag ${h.type}">${tag}</span><b>📍 ${esc(zoneName(h.zone))}</b>${h.finds ? `<span class="small muted">· ${h.finds} found him</span>` : `<span class="small" style="color:var(--pink);font-weight:800">· nobody yet!</span>`}</div>
    ${h.hint ? `<p class="hint">“${esc(h.hint)}”</p>` : ''}
    <p class="speed" id="speedLine">${speedLine(h)}</p>
    <p class="small muted" style="margin:2px 0 10px">${h.pending ? '⏳ ' + esc(T.pending) : esc(T.tries(triesLeft))} · ${esc(T.safetyShort)}</p>
    <button class="btn pink" id="scanBtn" ${h.pending || triesLeft <= 0 ? 'disabled' : ''}>📸 ${esc(T.scan)}</button>
    <div class="row" style="margin-top:8px"><button class="btn teal" id="wBtn" style="min-height:46px;font-size:15px">🔨 WHACK</button><button class="btn teal" id="pBtn" style="min-height:46px;font-size:15px">🥊 PUNCH</button></div>
  </div>`;
  el.querySelectorAll('[data-h]').forEach(b => (b.onclick = () => { selHunt = b.dataset.h; renderSheet(); }));
  $('#scanBtn').onclick = () => scan(h); $('#wBtn').onclick = startWhack; $('#pBtn').onclick = startPunch;
  coolTick();
}
// After a shot, the button counts down the cooldown instead of letting people spam.
function coolTick() {
  const b = $('#scanBtn'); if (!b || !st) return;
  const left = Math.ceil((st.me.lastSubmitAt + RULES.cooldownSec * 1000 - serverNow()) / 1000);
  const h = st.hunts.find(x => x.id === selHunt);
  if (left > 0) { b.disabled = true; b.textContent = `👀 LOOK AROUND · ${left}s`; }
  else if (b.textContent.startsWith('👀') && h && !h.pending) { b.disabled = false; b.textContent = '📸 ' + T.scan; }
}
setInterval(() => { // live speed-bonus countdown without hitting the server
  const h = st?.hunts.find(x => x.id === selHunt), el = $('#speedLine');
  if (h && el) el.textContent = speedLine(h);
  coolTick();
}, 1000);

// ---------------------------------------------------------------- camera + submit
async function scan(h) {
  if (!localStorage.getItem('gh_cam_ok')) {
    const o = layer(`<img class="mascot" src="img/gyanu.svg" alt=""><h2 class="big" style="font-size:40px">${esc(T.camTitle)}</h2><p style="margin:12px 0 18px">${esc(T.camWhy)}</p>
      <div class="sw stack"><button class="btn" id="camOk">${esc(T.camOk)}</button><button class="link" style="color:#fff" id="camNo">${esc(T.camNo)}</button></div>`);
    o.querySelector('#camNo').onclick = () => o.remove();
    o.querySelector('#camOk').onclick = () => { localStorage.setItem('gh_cam_ok', '1'); o.remove(); openCamera(h); };
    return;
  }
  openCamera(h);
}

function openCamera(h) {
  const o = document.createElement('div'); o.className = 'cam';
  o.innerHTML = `<video playsinline muted autoplay></video><div class="frame" data-tip="${esc(T.frameTip)}"></div>
    <p class="err hide" style="color:#fff;padding:14px;background:var(--red)" id="camErr"></p>
    <div class="bar"><button class="x" id="camX">✕ BACK</button><button class="shutter" id="shot" aria-label="${esc(T.takePhoto)}"></button>
    <label class="x" style="opacity:.8">🖼️<input type="file" accept="image/*" capture="environment" hidden id="camFile"></label></div>`;
  $('#layer').appendChild(o);
  const video = o.querySelector('video');
  let stream = null;
  const stop = () => { stream?.getTracks().forEach(t => t.stop()); o.remove(); };
  o.querySelector('#camX').onclick = stop;
  navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
    .then(s => { stream = s; video.srcObject = s; })
    .catch(() => { const e = o.querySelector('#camErr'); e.textContent = T.camFail; e.classList.remove('hide'); });
  o.querySelector('#shot').onclick = async () => {
    if (!video.videoWidth) { o.querySelector('#camFile').click(); return; }
    buzz(30);
    const a = analyse(video); stop(); submitPhoto(h, a);
  };
  o.querySelector('#camFile').onchange = e => {
    const f = e.target.files?.[0]; if (!f) return;
    const img = new Image(); img.onload = () => { const a = analyse(img); URL.revokeObjectURL(img.src); stop(); submitPhoto(h, a); };
    img.src = URL.createObjectURL(f);
  };
}

async function submitPhoto(h, a) {
  const o = layer(`<div class="spinner"></div><h2 class="big" style="font-size:34px">${esc(pick(T.checking))}</h2>`);
  const t0 = performance.now();
  let res;
  try { const verdict = await verify(h, a); res = await backend.submit({ gyanuId: h.id, analysis: a, verdict }); }
  catch (e) { res = { status: 'blocked', reason: e.message || 'Network hiccup. Try again.' }; }
  await new Promise(r => setTimeout(r, Math.max(0, 1100 - (performance.now() - t0)))); // a beat of suspense
  o.remove();
  showResult(res, h.zone);
  refresh();
}

const gsaysHtml = () => { const [hi, en] = gsay(); return `<div class="gsays"><img src="img/gyanu.svg" alt=""><div><b lang="hi">${esc(hi)}</b><small>${esc(en)}</small></div></div>`; };
function usefulChips(zone) {
  return `${gsaysHtml()}<p style="margin-top:10px;font-weight:700">While you’re at ${esc(zoneName(zone))} — spot anything useful?</p>
    <div class="chips">${SCENE_CATS.filter(c => c.id !== 'exit').map(c => `<button class="chip" data-rep="${c.id}">${c.icon} ${esc(c.label)}</button>`).join('')}</div>`;
}
function wireUseful(o, zone) {
  o.querySelectorAll('[data-rep]').forEach(b => (b.onclick = async () => {
    b.disabled = true;
    try { const r = await backend.report({ cat: b.dataset.rep, zone, note: '' }); b.classList.add('on'); toast(r.merged ? `${cat(b.dataset.rep).icon} confirmed — thanks for keeping it real` : `${cat(b.dataset.rep).icon} dropped on the Scene${r.points ? ` · +${r.points}` : ''}`); }
    catch (e) { toast(e.message); }
  }));
}

function showResult(res, zone, judged) {
  if (res.status === 'approved') {
    buzz([60, 40, 120]); confetti();
    if (res.special) combo('boom', 'tada'); else combo('horn', 'cash');
    const p = res.parts || {};
    const special = res.special === 'golden' ? '<p class="tag golden" style="margin:6px 0">✨ YOU GOT THE GOLDEN GYANU ✨</p>' : res.special === 'final' ? '<p class="tag final" style="margin:6px 0">💀 FINAL BOSS DOWN. LEGEND. 💀</p>' : '';
    const o = layer(`${judged ? `<p class="stamp" style="animation-delay:0s">JUDGES SAY YES</p>` : ''}
      <h2 class="big">${esc(T.found)}</h2>${special}
      <div class="plus">+<span id="countUp">0</span></div>
      <div class="parts">${Object.entries(p).filter(([, v]) => v).map(([k, v]) => `<span class="chip">${esc(T.parts[k])} +${v}</span>`).join('')}</div>
      ${res.streak >= 2 ? `<p class="d" style="font-size:24px;color:var(--pink);margin-bottom:8px">${esc(T.streak(res.streak))}</p>` : ''}
      <p style="font-weight:700">${esc(pick(T.foundSub))}</p>
      <p class="stamp" style="margin:14px 0">VERIFIED ✓</p>
      <p class="d" style="font-size:18px;color:#CFC6B8;margin-bottom:12px">${esc(T.moved)}</p>
      <div class="sw"><button class="btn" id="again">${esc(T.huntAgain)}</button></div>${zone ? usefulChips(zone) : ''}`, 'burst');
    const cu = o.querySelector('#countUp'), end = res.points; let v = 0;
    const tick = () => { v = Math.min(end, v + Math.ceil(end / 24)); cu.textContent = fmt(v); if (v < end) requestAnimationFrame(tick); }; tick();
    o.querySelector('#again').onclick = () => { o.remove(); go('hunt'); };
    if (zone) wireUseful(o, zone);
    return;
  }
  play(res.status === 'pending' ? 'whoosh' : res.status === 'duplicate' ? 'bruh' : 'sad');
  const titles = { pending: T.sentJudges, duplicate: T.dupTitle, cooldown: T.coolTitle, blocked: T.blockTitle };
  const body = { pending: T.sentSub, duplicate: T.dupSub }[res.status] || res.reason;
  const o = layer(`<img class="mascot" src="img/gyanu.svg" alt="">
    <h2 class="big" style="font-size:40px;margin-top:10px">${esc(titles[res.status] || T.blockTitle)}</h2>
    ${res.status === 'pending' ? '<p class="stamp" style="margin:12px 0">PENDING</p>' : ''}
    <p style="margin:10px 0 18px;font-weight:600">${esc(body)}</p>
    <div class="sw"><button class="btn" id="ok">OKAY</button></div>${res.status === 'pending' && zone ? usefulChips(zone) : ''}`);
  o.querySelector('#ok').onclick = () => o.remove();
  if (res.status === 'pending' && zone) wireUseful(o, zone);
}

// ---------------------------------------------------------------- alerts + notices
function handleAlerts() {
  for (const h of st.hunts) {
    if (h.type === 'classic' || h.found) continue;
    const k = h.id + ':' + h.activatedAt; if (seen.has(k)) continue;
    markSeen(k); buzz([200, 80, 200, 80, 300]); combo('siren', 'horn');
    const final = h.type === 'final';
    const o = layer(`<img class="mascot" src="img/gyanu.svg" alt="" style="width:150px">
      <h2 class="big" style="margin-top:12px">${esc(final ? T.finalTitle : T.goldenTitle)}</h2>
      <p style="margin:14px 0 6px;font-weight:700">${esc(final ? T.finalSub : T.goldenSub)}</p>
      <p class="tag ${h.type}" style="margin:6px 0 16px">📍 ${esc(zoneName(h.zone))}</p>
      <div class="sw"><button class="btn ${final ? 'pink' : ''}" id="goH">LET’S GO (WALKING)</button></div>
      <p class="small" style="margin-top:12px">${esc(T.safety)}</p>`, 'burst alertbig ' + h.type);
    o.querySelector('#goH').onclick = () => { selHunt = h.id; o.remove(); go('hunt'); renderSheet(); };
  }
  if (st.settings.ended && !seen.has('end:' + st.settings.winner)) { markSeen('end:' + st.settings.winner); showEnd(); }
}

async function handleNotices() {
  const n = st.me.notices || []; if (!n.length) return;
  await backend.ack(n.map(x => x.id));
  for (const x of n) {
    if (x.kind === 'approved') showResult({ status: 'approved', points: x.points, parts: x.parts, streak: x.streak, special: x.special }, null, true);
    else if (x.kind === 'rejected') toast('❌ ' + T.rejected, 4000);
  }
}

async function showEnd() {
  const b = await backend.leaderboard('global');
  const me = st.me;
  const o = layer(`<div class="end">
    <h2 class="big">${esc(T.endTitle)}</h2>
    ${st.settings.winner ? `<p class="tag final" style="margin:12px 0">${esc(T.endWinner(st.settings.winner))}</p>` : ''}
    <p class="lbl">YOUR SCORE</p><p class="num">${fmt(me.score)}</p>
    <div class="row" style="justify-content:center;gap:34px"><div><p class="lbl">YOUR RANK</p><p class="num">#${b.mine?.rank || '—'}</p></div><div><p class="lbl">GYANU FOUND</p><p class="num">${me.finds}</p></div></div>
    ${me.slogan ? `<p style="margin:16px 0 30px"><span class="placard" style="color:var(--ink)">${esc(me.slogan)}</span></p>` : ''}
    <div class="sw stack"><button class="btn pink" id="shareEnd">${esc(T.share)}</button><button class="btn ghost" id="closeEnd" style="color:var(--ink)">CLOSE</button></div></div>`, 'burst');
  o.querySelector('#shareEnd').onclick = () => doShare(b.mine?.rank);
  o.querySelector('#closeEnd').onclick = () => o.remove();
}

async function doShare(rank) {
  const me = st.me;
  if (!rank) rank = (await backend.leaderboard('global')).mine?.rank;
  const r = await shareCard({ nick: me.nick, slogan: me.slogan, finds: me.finds, score: me.score, rank, homeBest: me.homeBest });
  if (r === 'downloaded') toast('Card saved — post it, flex it.');
}

// ---------------------------------------------------------------- hype moments
let hypeSensor = null, hypeSend = 0, hypeEl = null, hypeId = null, hypeTimer = 0;
const HYPE_COPY = {
  chant: { title: 'CHANT-O-METER', how: 'Scream it. Clap it. Stomp it — in place. Every phone’s mic fills the meter. Max it and Gyanu can’t handle the noise.', join: '🎤 JOIN THE CHANT', need: 'mic' },
  shake: { title: 'SHAKE THE BANYAN', how: 'Shake your phone (hold it tight, stay in place). Everyone’s shakes rattle Gyanu out of the tree.', join: '📳 START SHAKING', need: 'shake' },
  statue: { title: 'STATUE MODE', how: 'FREEZE. Whole crowd, phones still, nobody moves. Gyanu falls asleep when it’s silent-still.', join: '🧊 I’M FROZEN', need: 'still' },
  lights: { title: 'PHONE-LIGHT SHOW', how: 'Brightness up. Hold your phone high. Every screen pulses together.', join: '🔦 LIGHT IT UP', need: null }
};
const LIGHT_COLS = ['#FFD400', '#FF2E88', '#00A99D', '#FFFFFF', '#FF8A1F', '#2B59C3'];

function stopHypeSensor() { hypeSensor?.stop(); hypeSensor = null; clearInterval(hypeTimer); hypeTimer = 0; }

function handleHype() {
  const h = st.hype;
  if (!h) { if (hypeEl) { hypeEl.remove(); hypeEl = null; } stopHypeSensor(); return; }
  const live = !h.done && !h.failed && serverNow() < h.endsAt;
  if (h.id !== hypeId) { // a new moment just dropped
    hypeId = h.id;
    if (!live) return;
    buzz([120, 60, 120]); play('siren'); play('dhol', 0.8);
    hypeEl?.remove(); hypeEl = layer('', 'hype'); renderHype();
    return;
  }
  if (hypeEl) renderHype();
}

function renderHype() {
  const h = st.hype; if (!h || !hypeEl) return;
  const c = HYPE_COPY[h.kind] || HYPE_COPY.chant;
  const left = Math.max(0, Math.ceil((h.endsAt - serverNow()) / 1000));
  if (h.done || h.failed || left === 0) {
    if (hypeEl.dataset.ended) return;
    hypeEl.dataset.ended = 1; stopHypeSensor(); hypeEl.style.background = '';
    if (h.kind === 'lights') { hypeEl.remove(); hypeEl = null; return; }
    if (h.done) {
      buzz([80, 40, 80, 40, 300]); confetti(90); combo('boom', 'horn', 'cash');
      if (map) { const sp = map.popSpots(); map.setPops([...Array(5)].map((_, i) => { const s = pick(sp); return { id: 'h' + i, x: s[0], y: s[1], z: s[2], kind: i ? 'gyanu' : 'gold', born: performance.now() + i * 220, life: 2600 }; })); setTimeout(() => !whack && map.setPops([]), 4200); }
      hypeEl.className = 'ov burst';
      hypeEl.innerHTML = `<img class="mascot" src="img/gyanu.svg" style="width:170px"><h2 class="big" style="margin-top:12px">HE COULDN’T HANDLE IT</h2>
        <p class="d" style="font-size:22px;color:var(--pink);margin:10px 0">${h.joined} PHONE${h.joined === 1 ? "" : "S"} DID THAT</p>
        <p style="font-weight:700">${h.iJoined ? `+${RULES.hypePoints} for showing up 🪳` : 'Join the next one to get points.'}</p>`;
    } else {
      play('sad');
      hypeEl.innerHTML = `<img class="mascot" src="img/gyanu.svg" style="width:130px"><h2 class="big" style="font-size:38px;margin-top:12px">GYANU SURVIVED… THIS TIME</h2><p style="margin-top:10px;font-weight:700">Louder next round. Bring your friends.</p>`;
    }
    setTimeout(() => { hypeEl?.remove(); hypeEl = null; }, 4500);
    return;
  }
  if (!hypeEl.dataset.built) {
    hypeEl.dataset.built = 1;
    hypeEl.innerHTML = `<p class="tag classic">HYPE MOMENT</p><h2 class="d" style="font-size:26px;margin-top:10px;color:#fff">${esc(c.title)}</h2>
      <p class="chant">${esc(h.text)}</p><p style="margin-bottom:14px">${esc(c.how)}</p>
      ${h.kind !== 'lights' ? `<div class="meter"><i id="hyMeter"></i></div><p class="small" style="margin:6px 0" id="hyCount"></p><div class="meter me hide" id="hyMeBox"><i id="hyMe"></i></div>` : ''}
      <div class="sw" style="margin-top:14px"><button class="btn pink" id="hyJoin">${esc(c.join)}</button></div>
      <p class="d" style="font-size:20px;margin-top:12px" id="hyLeft"></p>
      <button class="link" style="color:#CFC6B8" id="hyX">not now</button>`;
    hypeEl.querySelector('#hyX').onclick = () => { stopHypeSensor(); hypeEl.remove(); hypeEl = null; };
    hypeEl.querySelector('#hyJoin').onclick = () => joinHype(c);
  }
  hypeEl.querySelector('#hyLeft').textContent = `${left}s`;
  const m = hypeEl.querySelector('#hyMeter'); if (m) m.style.width = Math.round(h.progress * 100) + '%';
  const n = hypeEl.querySelector('#hyCount'); if (n) n.textContent = `${h.joined} phone${h.joined === 1 ? '' : 's'} in · ${Math.round(h.progress * 100)}%`;
}

async function joinHype(c) {
  const btn = hypeEl.querySelector('#hyJoin');
  if (st.hype.kind === 'lights') { // synced colour pulse from server time — no sensor, no upload
    btn.classList.add('hide');
    hypeTimer = setInterval(() => {
      if (!hypeEl || !st.hype) return stopHypeSensor();
      const i = Math.floor((serverNow() - st.hype.startedAt) / 450) % LIGHT_COLS.length;
      hypeEl.style.background = LIGHT_COLS[i];
      hypeEl.style.color = i === 3 || i === 0 ? '#15131A' : '#fff';
      if (serverNow() > st.hype.endsAt) renderHype();
    }, 60);
    return;
  }
  try {
    if (c.need === 'mic') hypeSensor = await micMeter();
    else hypeSensor = await motionMeter(c.need);
  } catch { hypeSensor = null; }
  if (hypeSensor && c.need !== 'mic') { await new Promise(r => setTimeout(r, 1200)); if (!hypeSensor.hasData()) { hypeSensor.stop(); hypeSensor = null; } }
  if (!hypeSensor) { // no sensor (laptop, denied permission)? mash the button instead
    hypeSensor = tapMeter();
    btn.textContent = '👊 MASH THIS'; btn.onclick = () => { hypeSensor.tap?.(); buzz(15); };
  } else btn.classList.add('hide');
  hypeEl.querySelector('#hyMeBox')?.classList.remove('hide');
  let acc = 0, cnt = 0;
  hypeTimer = setInterval(async () => {
    if (!hypeSensor || !st.hype) return;
    const lv = hypeSensor.level(); acc += lv; cnt++;
    const me = hypeEl?.querySelector('#hyMe'); if (me) me.style.width = Math.round(lv * 100) + '%';
    if (performance.now() - hypeSend > 1500) {
      hypeSend = performance.now();
      const avg = cnt ? acc / cnt : 0; acc = 0; cnt = 0;
      try { const v = await backend.hype(avg); if (v) { st.hype = v; renderHype(); } } catch {}
    } else renderHype();
  }, 100);
}

// ---------------------------------------------------------------- the scene
let sceneData = [];
async function refreshSceneData() {
  try { sceneData = await backend.scene(); } catch { return; }
  sceneMap?.setState({ scene: sceneData, zones: st?.zones });
  map?.setState({ scene: sceneData });
  renderSceneList();
}
function renderScene(zonePick) {
  const v = $('#v-scene');
  if (!v.dataset.built) {
    v.dataset.built = 1;
    v.innerHTML = `${gsaysHtml()}<div class="stats" id="scStats"></div>
      <div class="sceneMap"><canvas id="sceneCanvas"></canvas></div>
      <div class="row" style="margin-bottom:10px"><h2 class="d grow" style="font-size:24px">THE SCENE</h2><button class="btn" style="width:auto;min-height:44px;font-size:16px" id="dropBtn">+ DROP INFO</button></div>
      <p class="small muted" style="margin-bottom:8px">Live tips from hunters + the crew. Tap 👍 if it’s still true, ✋ if it’s gone. Pins fade after ${RULES.sceneTTLMin} min.</p>
      <div class="tabs" id="scFilters"></div><div id="scList"></div>`;
    sceneMap = new IsoMap($('#sceneCanvas'), { showHunts: false, onZone: z => openDrop(z) });
    $('#dropBtn').onclick = () => openDrop();
  }
  sceneMap.start();
  const s = st?.stats || {};
  $('#scStats').innerHTML = `<div><b>${s.online ?? '–'}</b><span>hunting now</span></div><div><b>${s.caught ?? '–'}</b><span>caught today</span></div><div><b>${s.hypeWins ?? 0}</b><span>hype wins</span></div><div><b>${s.water ?? 0}</b><span>water points</span></div>`;
  refreshSceneData();
  if (zonePick) openDrop(zonePick);
}
function renderSceneList() {
  const f = $('#scFilters'); if (!f) return;
  const cats = [...new Set(sceneData.map(r => r.cat))];
  f.innerHTML = `<button class="chip${!sceneFilter ? ' on' : ''}" data-f="">ALL</button>` + cats.map(c => `<button class="chip${sceneFilter === c ? ' on' : ''}" data-f="${c}">${cat(c).icon} ${esc(cat(c).label)}</button>`).join('');
  f.onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; sceneFilter = b.dataset.f || null; renderSceneList(); };
  const urgent = { medic: 0, crowded: 1, water: 2, exit: 3 };
  const list = sceneData.filter(r => !sceneFilter || r.cat === sceneFilter).sort((a, b) => (b.official - a.official) || ((urgent[a.cat] ?? 9) - (urgent[b.cat] ?? 9)) || b.createdAt - a.createdAt);
  $('#scList').innerHTML = list.length ? list.map(r => `<div class="rep">
      <div class="ic">${cat(r.cat).icon}</div>
      <div class="grow"><b>${esc(cat(r.cat).label)} · ${esc(zoneName(r.zone))}</b>${r.official ? ' <span class="off">✔ CREW</span>' : ''}
        ${r.note ? `<div>${esc(r.note)}</div>` : ''}<div class="small muted">${r.official ? 'official' : `by ${esc(r.by || 'a hunter')} · ${ago(r.createdAt)}`} · 👍 ${r.yes}${r.gone ? ` · ✋ ${r.gone}` : ''}</div>
        ${!r.official && !r.mine && !r.voted ? `<div class="acts"><button data-v="yes" data-id="${r.id}">👍 still true</button><button data-v="gone" data-id="${r.id}">✋ gone</button></div>` : ''}
      </div></div>`).join('') : `<p class="muted" style="padding:20px 0">Nothing pinned yet. Be the hero who finds the water.</p>`;
  $('#scList').onclick = async e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    await backend.vote(b.dataset.id, b.dataset.v); toast(b.dataset.v === 'yes' ? '👍 noted' : '✋ noted — thanks'); refreshSceneData();
  };
}
function openDrop(zone) {
  let c = null, z = zone || null;
  const o = layer(`<h2 class="big" style="font-size:36px">DROP INFO</h2><p style="margin:8px 0">What’s here?</p>
    <div class="chips" id="dc">${SCENE_CATS.map(x => `<button class="chip" data-c="${x.id}">${x.icon} ${esc(x.label)}</button>`).join('')}</div>
    <p style="margin:10px 0 4px">Where?</p>
    <div class="chips" id="dz">${ZONES.map(x => `<button class="chip${x.id === z ? ' on' : ''}" data-z="${x.id}">${esc(x.name)}</button>`).join('')}</div>
    <input class="field" id="dn" maxlength="60" placeholder="optional: “vada pav ₹20, short line”" style="max-width:360px;margin:10px 0">
    <p class="err" id="de"></p>
    <div class="sw stack"><button class="btn pink" id="dgo">PIN IT</button><button class="link" style="color:#fff" id="dx">cancel</button></div>`);
  const sel = (box, attr, set) => box.onclick = e => { const b = e.target.closest(`[${attr}]`); if (!b) return; box.querySelectorAll('.chip').forEach(q => q.classList.remove('on')); b.classList.add('on'); set(b.getAttribute(attr)); };
  sel(o.querySelector('#dc'), 'data-c', v => (c = v)); sel(o.querySelector('#dz'), 'data-z', v => (z = v));
  o.querySelector('#dx').onclick = () => o.remove();
  o.querySelector('#dgo').onclick = async () => {
    if (!c || !z) return (o.querySelector('#de').textContent = 'Pick what + where.');
    try { const r = await backend.report({ cat: c, zone: z, note: o.querySelector('#dn').value }); o.remove(); toast(r.merged ? 'Already pinned — counted as a confirm 👍' : `Pinned!${r.points ? ` +${r.points}` : ''}`); refreshSceneData(); }
    catch (e) { o.querySelector('#de').textContent = e.message; }
  };
}

// ---------------------------------------------------------------- leaderboard
async function renderBoard(quiet) {
  const v = $('#v-score');
  if (!quiet) v.innerHTML = `<div class="tabs">${Object.entries(T.scopes).map(([k, l]) => `<button class="chip${k === scope ? ' on' : ''}" data-sc="${k}">${l}</button>`).join('')}</div><div id="bl"><div class="spinner" style="margin:30px auto;border-color:#ddd;border-top-color:var(--pink)"></div></div>`;
  v.querySelectorAll('[data-sc]').forEach(b => (b.onclick = () => { scope = b.dataset.sc; renderBoard(); }));
  let b; try { b = await backend.leaderboard(scope); } catch { return; }
  const row = r => `<div class="rowp${r.me ? ' me' : ''}"><div class="rk">${r.rank}</div>${avatar(r.avatar, r.nick)}
    <div class="grow" style="min-width:0"><div class="nk">${esc(r.nick)}</div>${r.slogan ? `<div class="sl">🪧 ${esc(r.slogan)}</div>` : ''}</div><div class="sc">${fmt(r.score)}</div></div>`;
  const note = scope === 'nearby' ? `<p class="small muted" style="margin-bottom:8px">${esc(T.nearbyHelp(b.zone && zoneName(b.zone)))}</p>` : scope === 'home' ? `<p class="small muted" style="margin-bottom:8px">${esc(T.homeBoardNote)}</p>` : scope === 'punch' ? `<p class="small muted" style="margin-bottom:8px">${esc(T.punchBoardNote)}</p>` : '';
  const mineExtra = b.mine && !b.rows.some(r => r.me) ? `<p class="small muted" style="margin:8px 0">…</p>${row({ ...b.mine, me: true })}` : '';
  $('#bl').innerHTML = `<h2 class="d" style="font-size:26px;margin-bottom:6px">${esc(T.boardTitle)}</h2>${note}<div class="podium">${b.rows.map(row).join('') || `<p class="muted">${esc(T.emptyBoard)}</p>`}</div>${mineExtra}`;
}

// ---------------------------------------------------------------- rules + profile
function renderRules() {
  $('#v-rules').innerHTML = `<div class="panel" style="background:var(--yellow)"><b>⚠️ ${esc(T.safety)}</b></div>
    ${RULES_COPY.map(([h, p]) => `<h3>${esc(h)}</h3><p>${esc(p)}</p>`).join('')}
    <h3>Hype Moments</h3><p>Sometimes the crew drops a moment on everyone’s phone: chant, shake, freeze or a phone-light show. Fill the shared meter together and everyone who joined gets +${RULES.hypePoints}. Always in place — no running, no pushing.</p>
    <h3>The Scene</h3><p>Drop live info — food, water, toilets, medic, charging, shade, exits, crowded spots. +${RULES.reportPoints} per new pin (max ${RULES.reportCapPerHour}/hr), +${RULES.confirmPoints} when others confirm yours.</p>
    <div style="margin:18px 0 8px" class="stack"><button class="btn pink" id="rFb">💬 SPILL THE CHAI: BUG / IDEA / RANT</button><button class="btn ghost" id="rTour">👆 REPLAY THE HAND-HELD TOUR</button><button class="btn ghost" id="rIntro">🎧 LISTEN: 40-SEC HOW TO PLAY</button></div>
    <div style="margin:8px 0 18px" class="stack"><button class="btn ghost" id="rW">🔨 ${esc(T.homeTitle)}</button><button class="btn ghost" id="rP">🥊 ${esc(T.punchTitle)}</button></div>`;
  $('#v-rules').insertAdjacentHTML('beforeend', `<p class="foot-credit">${esc(CONFIG.credit)} · v${esc(CONFIG.version)}</p>`);
  $('#rW').onclick = startWhack; $('#rP').onclick = startPunch;
  $('#rFb').onclick = () => openFeedback({ screen: () => 'rules' }); $('#rTour').onclick = startTour; $('#rIntro').onclick = () => runTour(INTRO, { autoChoice: true, doneLabel: 'BACK TO THE HUNT' });
}

async function renderProfile() {
  const me = st.me, v = $('#v-profile');
  let hist = []; try { hist = await backend.history(); } catch {}
  v.innerHTML = `<div class="row" style="margin-bottom:14px"><button class="avbtn" id="chRoach" aria-label="Change my roach">${avatar(me.avatar, me.nick, 72)}<span class="avedit">✏️</span></button><div><div class="d" style="font-size:28px">${esc(me.nick)}</div><div class="small muted">hunter since today · rank #${me.rank || '—'}</div></div></div>
    <p style="margin:6px 0 34px"><span class="placard" id="myPlac">${esc(me.slogan || 'no slogan (yet)')}</span></p>
    <div class="stack"><button class="btn ghost" id="editRoach">🪳 PICK MY ROACH</button><button class="btn ghost" id="editSl">✏️ CHANGE MY PLACARD</button></div>
    <div class="stats" style="margin-top:14px"><div><b>${fmt(me.score)}</b><span>points</span></div><div><b>${me.finds}</b><span>found</span></div><div><b>${me.bestStreak}</b><span>best streak</span></div><div><b>${me.homeBest}</b><span>whack best</span></div></div>
    <div class="stack" style="margin:14px 0"><button class="btn pink" id="pShare">${esc(T.share)}</button><button class="btn ghost" id="pW">🔨 ${esc(T.homeTitle)}</button></div>
    <h3 class="d" style="font-size:18px;margin:16px 0 6px">MY CATCHES</h3>
    ${hist.length ? hist.map(h => `<div class="rowp"><div class="grow"><b>${esc(zoneName(h.zone))}</b><div class="small muted">${ago(h.createdAt)}</div></div><span class="chip">${{ approved: '✅ +' + h.points, pending: '⏳ judges', rejected: '❌ nope', duplicate: '🔁 repeat' }[h.status] || h.status}</span></div>`).join('') : '<p class="muted">No catches yet. The map is right there 👀</p>'}
    <div class="panel" style="margin-top:20px"><b>Your data</b><p class="small" style="margin:6px 0 12px">We keep your nickname, slogan, score and tiny photo copies (deleted within ${CONFIG.photoRetentionHours}h). No phone number on display, no GPS, no gallery access.</p>
    <button class="btn" style="background:var(--red);color:#fff" id="delMe">${esc(T.deleteBtn)}</button></div>`;
  $('#pShare').onclick = () => doShare(); $('#pW').onclick = startWhack;
  $('#chRoach').onclick = $('#editRoach').onclick = () => {
    const cur = me.avatar?.r;
    const o = layer(`<h2 class="big" style="font-size:34px">PICK YOUR ROACH</h2><p class="small" style="margin:8px 0 14px">This is your face on the leaderboard.</p>
      <div class="roachgrid">${ROACHES.map((r, i) => `<button class="roachpick${i === cur ? ' on' : ''}" data-r="${i}"><span class="av roachav" style="background:${r.bg}">${roachSvg(i)}</span><b>${r.name}</b></button>`).join('')}</div>
      <div class="sw stack" style="margin-top:14px"><button class="link" style="color:#fff" id="rcX">cancel</button></div>`);
    o.querySelector('#rcX').onclick = () => o.remove();
    o.querySelectorAll('[data-r]').forEach(b => (b.onclick = async () => {
      try { await backend.setRoach(+b.dataset.r); play('pop'); buzz(15); o.remove(); await refresh(); renderProfile?.(); } catch (e) { toast(e.message, 1800); }
    }));
  };
  $('#editSl').onclick = () => {
    let pl = defaultSloganLang();
    const o = layer(`<h2 class="big" style="font-size:34px">NEW PLACARD</h2><div class="langtabs" id="pLangs" style="justify-content:center;margin-top:10px"></div><div class="slogans" id="pSl" style="justify-content:center;margin:12px 0"></div>
      <input class="field" id="sl2" maxlength="60" placeholder="${esc(T.sloganPh)}" style="max-width:360px"><p class="err" id="sle"></p>
      <div class="sw stack"><button class="btn pink" id="slGo">SAVE</button><button class="link" style="color:#fff" id="slX">cancel</button></div>`);
    const paint = () => { o.querySelector('#pLangs').innerHTML = langTabsHtml(pl); o.querySelector('#pSl').innerHTML = SLOGAN_SETS[pl].map(x => `<button class="chip${o.querySelector('#sl2').value === x ? ' on' : ''}" data-s="${esc(x)}">${esc(x)}</button>`).join(''); };
    paint();
    o.querySelector('#pLangs').onclick = e => { const b = e.target.closest('[data-l]'); if (b) { pl = b.dataset.l; paint(); } };
    o.querySelector('#pSl').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { o.querySelector('#sl2').value = b.dataset.s; paint(); } };
    o.querySelector('#slX').onclick = () => o.remove();
    o.querySelector('#slGo').onclick = async () => { try { await backend.setSlogan(o.querySelector('#sl2').value); o.remove(); await refresh(); renderProfile(); } catch (e) { o.querySelector('#sle').textContent = e.message; } };
  };
  $('#delMe').onclick = () => { // in-app confirm: some in-app browsers silently block confirm()
    const o = layer(`<h2 class="big" style="font-size:36px">FOR REAL?</h2><p style="margin:12px 0 18px">${esc(T.deleteConfirm)}</p>
      <div class="sw stack"><button class="btn" style="background:var(--red);color:#fff" id="delYes">YES, DELETE EVERYTHING</button><button class="link" style="color:#fff" id="delNo">keep my stuff</button></div>`);
    o.querySelector('#delNo').onclick = () => o.remove();
    o.querySelector('#delYes').onclick = async () => {
      await backend.deleteMe(); try { localStorage.removeItem('gh_cam_ok'); sessionStorage.clear(); } catch {}
      o.innerHTML = `<h2 class="big" style="font-size:36px">${esc(T.deleted)}</h2>`; setTimeout(() => location.reload(), 1200);
    };
  };
}

// ---------------------------------------------------------------- the crowd wall
// A head-count and the placards people carry. No names, no scores, no locations. Anyone can look; anyone can join.
async function openCrowd() {
  if (document.querySelector('.wall')) return;
  const joined = !!backend.meId(); let data = { total: 0, slogans: [] }, lang = 'all', picked = null, alive = true;
  const o = layer('', 'wall');
  const paint = () => {
    const list = data.slogans.filter(x => lang === 'all' || scriptOf(x.s) === lang || (lang === 'hinglish' && scriptOf(x.s) === 'latin'));
    const tabs = [['all', 'All'], ['hinglish', 'Hinglish / English'], ['tamil', 'தமிழ்'], ['bengali', 'বাংলা'], ['marathi', 'मराठी / हिंदी']];
    o.innerHTML = `<div class="wallcard"><button class="fbx" id="wX" aria-label="Close">✕</button>
      <h2>THE CROWD</h2>
      <div class="wallcount"><b>${fmt(data.total)}</b><span>${data.total === 1 ? 'person' : 'people'} in the hunt right now</span></div>
      <p class="wallsub">At the ground or on the couch, everyone counts. Outsiders welcome. Hunt, whack, chant and share, same game for all.</p>
      <div class="langtabs">${tabs.map(([id, l]) => `<button class="chip${lang === id ? ' on' : ''}" data-wl="${id}">${esc(l)}</button>`).join('')}</div>
      <div class="wallgrid">${list.length ? list.map((x, i) => `<button class="placard c${i % 5}${picked === x.s ? ' sel' : ''}" data-p="${i}" style="--r:${((i * 37) % 7 - 3) * 0.6}deg">${esc(x.s)}${x.n > 1 ? `<i>×${fmt(x.n)}</i>` : ''}</button>`).join('') : '<p class="wallsub">No placards here yet. Be the first.</p>'}</div>
      ${picked && joined ? `<button class="btn" id="wWear">🪧 WEAR THIS PLACARD</button>` : ''}
      <button class="btn pink" id="wJoin">${joined ? '✍️ CHANGE MY PLACARD' : 'JOIN THE CROWD'}</button></div>`;
    o.querySelector('#wX').onclick = close;
    o.querySelectorAll('[data-wl]').forEach(b => (b.onclick = () => { lang = b.dataset.wl; paint(); }));
    o.querySelectorAll('[data-p]').forEach(b => (b.onclick = () => { picked = picked === list[+b.dataset.p].s ? null : list[+b.dataset.p].s; play('tap'); paint(); }));
    o.querySelector('#wWear')?.addEventListener('click', async () => { try { await backend.setSlogan(picked); toast('You’re carrying that placard now 🪧'); play('level'); close(); refresh(); } catch (e) { toast(e.message); } });
    o.querySelector('#wJoin').onclick = () => { close(); if (joined) { go('profile'); } else { $('#landing').classList.add('hide'); showJoin(false); } };
  };
  const close = () => { alive = false; o.remove(); };
  const load = async () => { try { data = await backend.crowd(); if (alive && !picked) paint(); else if (alive) { /* keep selection stable */ } } catch {} };
  paint(); await load(); const iv = setInterval(() => (alive ? load() : clearInterval(iv)), 8000);
}
async function landingCrowd() {
  try {
    const c = await backend.crowd(); if (!c?.total) return;
    const l = $('#crowdLink'); l.style.display = ''; l.textContent = `🪧 ${fmt(c.total)} already in the crowd · peek at the placards`; l.onclick = openCrowd;
  } catch {}
}

// ---------------------------------------------------------------- whack-a-gyanu (at home)
function startWhack() {
  if (whack) return;
  go('hunt'); closeAll();
  const intro = layer(`<img class="mascot" src="img/gyanu.svg" style="width:140px"><h2 class="big" style="margin-top:10px">${esc(T.homeTitle)}</h2>
    <p style="margin:12px 0 18px;font-weight:600">${esc(T.homeSub)}</p><p class="small" style="margin-bottom:14px">${esc(T.homeBest(st?.me.homeBest || 0))}</p>
    <div class="sw stack"><button class="btn pink" id="wGo">${esc(T.homeStart)}</button><button class="link" style="color:#fff" id="wX">nah</button></div>`);
  intro.querySelector('#wX').onclick = () => intro.remove();
  intro.querySelector('#wGo').onclick = () => { intro.remove(); runWhack(); };
}
function runWhack() {
  const spots = map.popSpots(), DUR = 30000, t0 = performance.now();
  let score = 0, pops = [], nextAt = t0 + 400, id = 0;
  const bar = $('#whackbar'); bar.classList.remove('hide'); $('#status').classList.add('hide');
  whack = {
    hit(p) {
      if (p.hit) return; p.hit = true; p.hitAt = performance.now();
      if (p.kind === 'roach') { score = Math.max(0, score - 3); buzz([40, 30, 40]); toast(T.homeRoach, 900); }
      else { score += p.kind === 'gold' ? 5 : 1; buzz(18); }
      draw();
    }
  };
  map.setState({ hunts: [] }); renderSheet();
  const draw = () => {
    const left = Math.max(0, Math.ceil((DUR - (performance.now() - t0)) / 1000));
    bar.innerHTML = `<span class="chip">⏱ ${left}s</span><span class="chip" style="margin-left:auto">🔨 ${score}</span>`;
  };
  const loop = () => {
    const now = performance.now(), el = now - t0;
    if (el >= DUR) return end();
    pops = pops.filter(p => now - p.born < p.life + 350);
    if (now >= nextAt) {
      const busy = new Set(pops.map(p => p.si));
      const free = spots.map((s, i) => i).filter(i => !busy.has(i));
      const si = pick(free), s = spots[si], r = Math.random();
      const life = 1250 - (el / DUR) * 450;
      pops.push({ id: ++id, si, x: s[0], y: s[1], z: s[2], kind: r < 0.1 ? 'roach' : r < 0.18 ? 'gold' : 'gyanu', born: now, life });
      nextAt = now + 520 - (el / DUR) * 220 + Math.random() * 260;
    }
    map.setPops(pops); draw();
    requestAnimationFrame(loop);
  };
  const end = async () => {
    map.setPops([]); bar.classList.add('hide'); $('#status').classList.remove('hide'); whack = null;
    let r = { ok: false, reason: '' }; try { r = await backend.homeScore(score); } catch (e) { r.reason = e.message; }
    confetti(score > 10 ? 70 : 20); play(score > 10 ? 'tada' : 'bruh');
    const o = layer(`<h2 class="big">${score} BONKS</h2><p class="d" style="font-size:20px;color:var(--pink);margin:10px 0">${esc(T.homeDone(score))}</p>
      ${r.ok ? `<p>${r.best ? '🏆 NEW PERSONAL BEST' : esc(T.homeBest(r.homeBest))}</p>` : `<p>${esc(r.reason)}</p>`}
      <div class="sw stack" style="margin-top:16px"><button class="btn pink" id="wA">${esc(T.homeAgain)}</button><button class="btn ghost" style="color:var(--ink)" id="wB">LEADERBOARD</button><button class="link" style="color:#fff" id="wC">done</button></div>`, 'burst');
    o.querySelector('#wA').onclick = () => { o.remove(); runWhack(); };
    o.querySelector('#wB').onclick = () => { o.remove(); scope = 'home'; go('score'); };
    o.querySelector('#wC').onclick = () => { o.remove(); refresh(); };
    refresh();
  };
  draw(); loop();
}

// ---------------------------------------------------------------- punch the bag (60s)
function startPunch() {
  if (!st) return;
  go('hunt'); closeAll();
  const intro = layer(`<div class="bagwrap"><div class="bagrope"></div><div class="bag"><img src="img/gyanu.svg" alt=""></div></div><h2 class="big" style="margin-top:6px">${esc(T.punchTitle)}</h2>
    <p style="margin:12px 0 10px;font-weight:600">${esc(T.punchSub)}</p><p class="small" style="margin-bottom:14px">Your best: ${st.me.punchBest || 0}</p>
    <div class="sw stack"><button class="btn pink" id="pGo">${esc(T.punchStart)}</button><button class="link" style="color:#fff" id="pX">nah</button></div>`);
  intro.querySelector('#pX').onclick = () => intro.remove();
  intro.querySelector('#pGo').onclick = () => { intro.remove(); runPunch(); };
}
function runPunch() {
  const DUR = 15000; let n = 0, t0 = 0, over = false, tick = 0;
  const o = layer(`<div class="punchhud"><span class="chip" id="pT">⏱ 15s</span><span class="chip" id="pN" style="margin-left:auto">🥊 0</span></div>
    <div class="bagwrap big2"><div class="bagrope"></div><button class="bag" id="bag" aria-label="Punch the bag"><img src="img/gyanu.svg" alt="" draggable="false"></button></div>
    <p class="small" id="pHint" style="margin-top:12px">TAP THE BAG. TIMER STARTS ON YOUR FIRST PUNCH.</p>`, 'punchov');
  const bag = o.querySelector('#bag'), N = o.querySelector('#pN'), T0 = o.querySelector('#pT');
  const words = ['POW', 'BAM', 'THWACK', 'BONK', 'WHAM', 'OOF'];
  const hit = e => {
    if (over) return; e.preventDefault();
    if (!t0) { t0 = performance.now(); o.querySelector('#pHint').textContent = 'GO GO GO!'; tick = setInterval(upd, 100); setTimeout(finish, DUR); }
    n++; N.textContent = '🥊 ' + n;
    bag.classList.remove('swing'); void bag.offsetWidth; bag.classList.add('swing');
    if (n % 3 === 0) play(n % 15 === 0 ? 'boom' : 'pop'); buzz(8);
    const w = document.createElement('i'); w.className = 'pw'; w.textContent = words[n % words.length];
    const r = bag.getBoundingClientRect(); w.style.left = (r.left + r.width / 2 + (Math.random() - .5) * 120) + 'px'; w.style.top = (r.top + r.height * .35 + (Math.random() - .5) * 60) + 'px';
    o.appendChild(w); setTimeout(() => w.remove(), 450);
  };
  const upd = () => { const left = Math.max(0, Math.ceil((DUR - (performance.now() - t0)) / 1000)); T0.textContent = '⏱ ' + left + 's'; };
  bag.addEventListener('pointerdown', hit);
  const finish = async () => {
    if (over) return; over = true; clearInterval(tick); o.remove();
    let r = { ok: false, reason: '' }; try { r = await backend.punchScore(n); } catch (e) { r.reason = e.message; }
    confetti(n > 70 ? 70 : 20); play(n > 40 ? 'tada' : 'bruh');
    const d = layer(`<h2 class="big">${n} PUNCHES</h2><p class="d" style="font-size:20px;color:var(--pink);margin:10px 0">${esc(T.punchDone(n))}</p>
      ${r.ok ? `<p>${r.best ? '🏆 NEW PERSONAL BEST' : 'Your best: ' + r.punchBest}</p>` : `<p>${esc(r.reason)}</p>`}
      <div class="sw stack" style="margin-top:16px"><button class="btn pink" id="pA">AGAIN, OBVIOUSLY</button><button class="btn ghost" style="color:var(--ink)" id="pB">LEADERBOARD</button><button class="link" style="color:#fff" id="pC">back to the hunt</button></div>`);
    d.querySelector('#pA').onclick = () => { d.remove(); runPunch(); };
    d.querySelector('#pB').onclick = () => { d.remove(); scope = 'punch'; go('score'); };
    d.querySelector('#pC').onclick = () => { d.remove(); refresh(); };
    refresh();
  };
}

// ---------------------------------------------------------------- boot
function boot() {
  ensureSprite();
  fillStatic();
  $('#playBtn').onclick = () => showJoin(false);
  $('#homeLink').onclick = () => showJoin(true);
  $('#status').addEventListener('click', e => { if (e.target.closest('[data-crowd]')) openCrowd(); });
  if (!backend.meId()) landingCrowd();
  $('#introBtn').onclick = () => runTour(INTRO, { autoChoice: true, doneLabel: 'LET’S PLAY' });
  setInterval(() => { // Gyanu pops up now and then with a share-what-you-know nudge
    if (document.hidden || $('#game').classList.contains('hide') || $('#layer').children.length || tourOpen() || whack || document.querySelector('.gtip')) return;
    const [hi, en] = gsay(); const t = document.createElement('div'); t.className = 'gtip'; t.innerHTML = `<img src="img/gyanu.svg" alt=""><div><b lang="hi">${esc(hi)}</b><small>${esc(en)}</small></div>`;
    t.onclick = () => { t.remove(); go('scene'); }; $('#app').appendChild(t); setTimeout(() => t.remove(), 7000);
  }, 150000);
  $('#fbBtn').onclick = () => openFeedback({ screen: () => view });
  $('#joinBack').onclick = () => { $('#join').classList.add('hide'); $('#landing').classList.remove('hide'); };
  $('#joinGo').onclick = doJoin; $('#otpSend').onclick = sendOtp;
  $('#nick').addEventListener('keydown', e => e.key === 'Enter' && doJoin());
  $('#nav').onclick = e => { const b = e.target.closest('button'); if (b) { play('tap'); go(b.dataset.v); } };
  addEventListener('pointerdown', unlock, { once: true, capture: true });
  const paintSnd = () => ($('#sndBtn').textContent = sfxState.muted ? '🔇' : '🔊');
  $('#sndBtn').onclick = () => { setMuted(!sfxState.muted); paintSnd(); if (!sfxState.muted) play('pop'); }; paintSnd();
  let deb = 0; backend.on(() => { clearTimeout(deb); deb = setTimeout(refresh, 120); });
  setInterval(() => { if (!document.hidden && st && (backend.kind === 'local' || (st.hype && serverNow() < st.hype.endsAt + 6000))) refresh(); }, backend.kind === 'local' ? 2500 : 2000);
  if (backend.meId()) enterGame();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') { const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.register('sw.js').catch(() => {}); let rl = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !rl && !document.querySelector('.ov, .tour')) { rl = true; location.reload(); } }); }
  if (new URLSearchParams(location.search).get('mode') === 'home' && !backend.meId()) showJoin(true);
}
boot();
