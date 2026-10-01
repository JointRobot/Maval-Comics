// GYANU CONTROL ROOM — everything the crew needs, nothing more.
import { ZONES, SCENE_CATS, CONFIG } from './config.js';
import { backend } from './backend.js';
import { analyse } from './verify.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const zn = id => ZONES.find(z => z.id === id)?.name || id;
const ci = id => SCENE_CATS.find(c => c.id === id)?.icon || '?';
const ago = t => { if (!t) return '—'; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`; };
let pin = sessionStorage.getItem('gh_pin') || '', tab = 'live', S = null, editing = null, pendingRefs = [];
const toast = m => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2000); };
const act = async (a, p = {}, msg) => { try { await backend.admin(a, { pin, ...p }); if (msg) toast(msg); await load(); } catch (e) { toast('⚠️ ' + e.message); } };

if (backend.kind !== 'local') $('#login p.mut').textContent = 'Crew only.';
async function login() {
  pin = $('#pin').value || pin;
  try { await backend.admin('login', { pin }); sessionStorage.setItem('gh_pin', pin); $('#login').classList.add('hide'); $('#room').classList.remove('hide'); load(); }
  catch (e) { $('#loginErr').textContent = e.message; }
}
$('#loginBtn').onclick = login; $('#pin').onkeydown = e => e.key === 'Enter' && login();
if (pin) login();

$('#tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b)); render(); };
$('#pauseBtn').onclick = () => {
  if (S.settings.paused) return act('settings', { patch: { paused: false, pauseReason: '' } }, 'Hunt resumed');
  const r = prompt('Pause message for players:', 'Crowd’s getting thick. Stay where you are, chill, sip something. We’ll be back.');
  if (r !== null) act('settings', { patch: { paused: true, pauseReason: r } }, 'Hunt paused for everyone');
};

async function load() {
  try { S = await backend.admin('state', { pin }); } catch (e) { toast(e.message); return; }
  const pb = $('#pauseBtn'); pb.textContent = S.settings.paused ? '▶ RESUME HUNT' : '⏸ PAUSE'; pb.className = 'b ' + (S.settings.paused ? 'g' : 'r');
  const pending = S.subs.filter(s => s.status === 'pending').length;
  $('[data-t=subs]').textContent = `SUBMISSIONS${pending ? ` (${pending})` : ''}`;
  const crowded = S.scene.filter(r => r.cat === 'crowded').length;
  $('[data-t=crowd]').textContent = `CROWD + SCENE${crowded ? ` ⚠️${crowded}` : ''}`;
  if (!document.activeElement?.matches('input,textarea,select')) render();
}
backend.on(() => load());
setInterval(() => !document.hidden && $('#room').offsetParent && load(), 4000);

function render() {
  if (!S) return;
  const b = $('#body');
  const views = { live, create, subs, hype, crowd, players, board, settings };
  b.innerHTML = views[tab]();
  wire[tab]?.();
}

// ---------- LIVE: what's out there now
function live() {
  const s = S.stats;
  const g = S.gyanus.map(x => `<div class="card">
    <div class="row"><span class="tag ${x.type}">${x.type.toUpperCase()}</span>${x.active ? '<span class="tag on">● LIVE</span>' : '<span class="tag">off</span>'}<b>${esc(zn(x.zone))}</b></div>
    <p style="margin:8px 0 2px;font-weight:700">${esc(x.label)}</p><p class="mut">Hint: “${esc(x.hint)}” · ${x.points} pts · verify: ${x.verify} · refs: ${x.refs.length}</p>
    <p class="mut">${x.active ? `live ${ago(x.activatedAt)} · ` : ''}${x.finds} found${x.claimedName ? ` · claimed by ${esc(x.claimedName)}` : ''}</p>
    <div class="row" style="margin-top:10px">
      ${x.active ? `<button class="b k sm" data-off="${x.id}">DEACTIVATE</button>` : `<button class="b ${x.type === 'final' ? 'r' : x.type === 'golden' ? 'o' : 'g'} sm" data-on="${x.id}">${x.type === 'final' ? 'START FINAL BOSS' : x.type === 'golden' ? 'DROP GOLDEN' : 'ACTIVATE'}</button>`}
      ${x.active ? `<select data-move="${x.id}" style="width:auto"><option value="">MOVE TO…</option>${S.gyanus.filter(y => !y.active && y.id !== x.id).map(y => `<option value="${y.id}">${esc(zn(y.zone))} — ${esc(y.label).slice(0, 30)}</option>`).join('')}</select>` : ''}
      <button class="b k sm" data-edit="${x.id}">EDIT</button><button class="b k sm" data-del="${x.id}">🗑</button>
    </div></div>`).join('');
  return `<div class="grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:12px">
      <div class="stat"><b>${s.online}</b>online</div><div class="stat"><b>${s.caught}</b>caught today</div><div class="stat"><b>${S.subs.filter(x => x.status === 'pending').length}</b>to judge</div><div class="stat"><b>${s.hypeWins}</b>hype wins</div><div class="stat"><b>${s.busy.length}</b>busy zones</div></div>
    ${S.settings.paused ? `<div class="card paused"><h2 style="color:#fff">⏸ HUNT PAUSED</h2><p>${esc(S.settings.pauseReason)}</p></div>` : ''}
    ${S.settings.ended ? `<div class="card"><h2>HUNT COMPLETE${S.settings.winner ? ` — ${esc(S.settings.winner)} caught the Final Gyanu` : ''}</h2><button class="b sm" id="reopen">REOPEN HUNT</button></div>` : ''}
    <div class="grid">${g}</div>`;
}
const wire = {
  live() {
    document.querySelectorAll('[data-on]').forEach(b => (b.onclick = () => { const x = S.gyanus.find(g => g.id === b.dataset.on); if (x.type !== 'classic' && !confirm(`Drop ${x.type.toUpperCase()} Gyanu now? Every phone gets an alert.`)) return; act('activate', { id: x.id, on: true }, 'Gyanu is live'); }));
    document.querySelectorAll('[data-off]').forEach(b => (b.onclick = () => act('activate', { id: b.dataset.off, on: false }, 'Deactivated')));
    document.querySelectorAll('[data-move]').forEach(s => (s.onchange = () => s.value && act('move', { from: s.dataset.move, to: s.value }, 'Gyanu has moved')));
    document.querySelectorAll('[data-edit]').forEach(b => (b.onclick = () => { editing = S.gyanus.find(g => g.id === b.dataset.edit); pendingRefs = []; tab = 'create'; document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === 'create')); render(); }));
    document.querySelectorAll('[data-del]').forEach(b => (b.onclick = () => confirm('Delete this Gyanu?') && act('deleteGyanu', { id: b.dataset.del })));
    $('#reopen')?.addEventListener('click', () => act('settings', { patch: { ended: false, winner: null } }, 'Hunt reopened'));
  },
  create() {
    $('#refIn').onchange = async e => {
      for (const f of e.target.files) {
        const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = URL.createObjectURL(f); });
        const a = analyse(img); pendingRefs.push({ hash: a.hash, sig: a.sig, thumb: a.thumb });
      }
      $('#refPrev').innerHTML = pendingRefs.map(r => `<img src="${r.thumb}">`).join('') + ` <span class="mut">${pendingRefs.length} new</span>`;
    };
    $('#saveG').onclick = async () => {
      const v = id => $('#' + id).value;
      if (!v('gLabel').trim()) return toast('Give it a crew label');
      const gyanu = { id: editing?.id, label: v('gLabel'), zone: v('gZone'), hint: v('gHint'), type: v('gType'), points: Number(v('gPts')), verify: v('gVer'), addRefs: pendingRefs, clearRefs: $('#gClear')?.checked };
      await act('saveGyanu', { gyanu }, editing ? 'Saved' : 'Gyanu created');
      editing = null; pendingRefs = []; tab = 'live'; document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === 'live')); render();
    };
    $('#gType').onchange = e => { $('#gPts').value = { classic: 100, golden: 500, final: 1000 }[e.target.value]; };
  },
  subs() {
    document.querySelectorAll('[data-ok]').forEach(b => (b.onclick = () => act('review', { id: b.dataset.ok, decision: 'approve', quality: b.dataset.q }, 'Approved ✓')));
    document.querySelectorAll('[data-no]').forEach(b => (b.onclick = () => { const r = prompt('Reason (players see this):', 'Not Gyanu'); if (r !== null) act('review', { id: b.dataset.no, decision: 'reject', reason: r }, 'Rejected'); }));
    document.querySelectorAll('[data-ban]').forEach(b => (b.onclick = () => confirm('Ban this player?') && act('ban', { id: b.dataset.ban, on: true }, 'Banned')));
  },
  hype() {
    document.querySelectorAll('[data-preset]').forEach(b => (b.onclick = () => { const [k, t] = b.dataset.preset.split('|'); $('#hKind').value = k; $('#hText').value = t; }));
    $('#hGo').onclick = () => act('hype', { kind: $('#hKind').value, text: $('#hText').value, dur: Number($('#hDur').value), goal: Number($('#hGoal').value) }, 'Hype moment dropped!');
    $('#hStop')?.addEventListener('click', () => act('hypeStop', {}, 'Stopped'));
  },
  crowd() {
    document.querySelectorAll('[data-z]').forEach(b => (b.onclick = () => act('zone', { id: b.dataset.z, crowd: b.dataset.c }, `${zn(b.dataset.z)}: ${b.dataset.c}`)));
    document.querySelectorAll('[data-rdel]').forEach(b => (b.onclick = () => act('sceneDelete', { id: b.dataset.rdel }, 'Removed')));
    $('#pinGo').onclick = () => act('scenePin', { cat: $('#pinCat').value, zone: $('#pinZone').value, note: $('#pinNote').value }, 'Official pin posted');
  },
  players() {
    $('#pq').oninput = e => document.querySelectorAll('#ptab tr[data-n]').forEach(r => (r.style.display = r.dataset.n.includes(e.target.value.toUpperCase()) ? '' : 'none'));
    document.querySelectorAll('[data-pban]').forEach(b => (b.onclick = () => act('ban', { id: b.dataset.pban, on: b.dataset.on === '1' }, b.dataset.on === '1' ? 'Banned' : 'Unbanned')));
  },
  settings() {
    $('#savePin').onclick = () => { const p = $('#newPin').value.trim(); if (p.length < 4) return toast('PIN needs 4+ chars'); act('settings', { patch: { adminPin: p } }, 'PIN changed').then(() => { pin = p; sessionStorage.setItem('gh_pin', p); }); };
    $('#reset').onclick = () => confirm('Reset ALL scores and submissions? Cannot be undone.') && act('resetScores', {}, 'Scores reset');
    $('#purge').onclick = () => act('purgePhotos', {}, 'Photos wiped');
    $('#factory')?.addEventListener('click', () => confirm('Wipe the whole demo database?') && act('factoryReset', {}, 'Demo reset'));
  }
};

// ---------- CREATE
function create() {
  const g = editing || { label: '', zone: 'chai', hint: '', type: 'classic', points: 100, verify: 'manual', refs: [] };
  const opt = (arr, v) => arr.map(([k, l]) => `<option value="${k}"${k === v ? ' selected' : ''}>${l}</option>`).join('');
  return `<div class="card" style="max-width:640px"><h2>${editing ? 'EDIT GYANU' : 'CREATE GYANU'}</h2>
    <label>Crew label (players never see this)</label><input id="gLabel" value="${esc(g.label)}" placeholder="e.g. Cut-out taped behind the chai counter">
    <div class="row"><div style="flex:1"><label>Zone</label><select id="gZone">${opt(ZONES.map(z => [z.id, z.name]), g.zone)}</select></div>
    <div style="flex:1"><label>Type</label><select id="gType">${opt([['classic', 'Classic'], ['golden', 'Golden (+500 first)'], ['final', 'Final Boss (+1000, ends hunt)']], g.type)}</select></div></div>
    <label>Hint players see</label><input id="gHint" value="${esc(g.hint)}" maxlength="80" placeholder="e.g. Follow the smell of elaichi.">
    <div class="row"><div style="flex:1"><label>First-find points</label><input id="gPts" type="number" value="${g.points}"></div>
    <div style="flex:1"><label>Verification</label><select id="gVer">${opt([['manual', 'A · Judges approve'], ['reference', 'B · Auto-match reference photos'], ['vision', 'C · Vision API (if configured)']], g.verify)}</select></div></div>
    <label>Reference photos (for B — take 2–4 of the actual marker/spot)</label>
    <input type="file" id="refIn" accept="image/*" multiple>
    <div class="refs" id="refPrev" style="margin-top:8px">${(g.refs || []).map(r => r.thumb ? `<img src="${r.thumb}">` : '').join('')}</div>
    ${editing && g.refs.length ? '<label><input type="checkbox" id="gClear" style="width:auto"> Clear old reference photos</label>' : ''}
    <div class="row" style="margin-top:14px"><button class="b p" id="saveG">${editing ? 'SAVE' : 'CREATE'}</button>${editing ? '<span class="mut">Activate it from LIVE.</span>' : ''}</div>
    <p class="mut" style="margin-top:10px">Tip: Gyanu should always be a marked cut-out, poster, prop or a crew member in the Gyanu cap — never a random member of the public. Never place him on roads, barricades, stage edges, or near exits.</p></div>`;
}

// ---------- SUBMISSIONS
function subs() {
  const pend = S.subs.filter(s => s.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
  const rest = S.subs.filter(s => s.status !== 'pending').slice(0, 40);
  const one = s => `<div class="sub"><div>${s.thumb ? `<img src="${s.thumb}" alt="">` : '<div class="mut" style="width:110px;height:110px;display:grid;place-items:center;border:2px dashed var(--line);border-radius:8px">photo wiped</div>'}</div>
    <div><div class="row"><b>${esc(s.nick)}</b><span class="tag ${s.gyanuType}">${esc(zn(s.zone))}</span><span class="mut">${ago(s.createdAt)} ago · ${s.via}${s.confidence != null ? ` · match ${Math.round(s.confidence * 100)}%` : ''}</span></div>
    <p class="mut">${esc(s.gyanuLabel)}</p>
    ${s.status === 'pending' ? `<div class="row" style="margin-top:8px"><button class="b g sm" data-ok="${s.id}" data-q="clear">✓ CLEAR (+25)</button><button class="b t sm" data-ok="${s.id}" data-q="partial">✓ PARTIAL (+10)</button><button class="b r sm" data-no="${s.id}">✕ REJECT</button><button class="b k sm" data-ban="${s.playerId}">BAN</button></div>`
      : `<p><span class="tag ${s.status === 'approved' ? 'on' : ''}">${s.status.toUpperCase()}</span> ${s.points ? `+${s.points}` : ''} ${s.reason ? `· ${esc(s.reason)}` : ''} ${s.status === 'approved' ? `<button class="b r sm" data-no="${s.id}">REVOKE (fraud)</button>` : ''}</p>`}</div></div>`;
  return `<div class="card"><h2>JUDGE QUEUE (${pend.length}) — oldest first, so the real first-finder gets the bonus</h2>${pend.map(one).join('') || '<p class="mut">All clear. Touch grass.</p>'}</div>
    <div class="card"><h2>RECENT</h2>${rest.map(one).join('') || '<p class="mut">Nothing yet.</p>'}</div>`;
}

// ---------- HYPE
function hype() {
  const h = S.settings.hype, live = h && !h.done && Date.now() < h.endsAt;
  const presets = [['chant', 'GYANU BAHAR AAO!'], ['chant', 'EK DO TEEN CHAAR, GYANU AB TOH HAAR'], ['chant', 'SODA LEMON GINGER POP!'], ['shake', 'SHAKE THE BANYAN!'], ['statue', 'FREEZE. NOBODY MOVES.'], ['lights', 'LIGHT IT UP 🔦']];
  return `<div class="card" style="max-width:640px"><h2>DROP A HYPE MOMENT</h2>
    ${live ? `<div class="card" style="background:#14111A"><b>LIVE: ${esc(h.kind.toUpperCase())} — “${esc(h.text)}”</b><div class="meter"><i style="width:${Math.round(h.progress * 100)}%"></i></div><p class="mut">${h.joined} phones in · ${Math.round(h.progress * 100)}% · ${Math.max(0, Math.round((h.endsAt - Date.now()) / 1000))}s left</p><button class="b r sm" id="hStop">STOP</button></div>`
      : h ? `<p class="mut" style="margin-bottom:10px">Last: ${esc(h.text)} — ${h.done ? `WON by ${h.joined} phones ✓` : 'Gyanu survived'}</p>` : ''}
    <div class="row">${presets.map(([k, t]) => `<button class="b k sm" data-preset="${k}|${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="row"><div style="flex:1"><label>Type</label><select id="hKind"><option value="chant">Chant-o-meter (mic)</option><option value="shake">Shake the Banyan (motion)</option><option value="statue">Statue mode (stillness)</option><option value="lights">Phone-light show (no score)</option></select></div>
    <div style="flex:1"><label>Seconds</label><input id="hDur" type="number" value="45" min="10" max="180"></div><div style="flex:1"><label>Effort per phone</label><input id="hGoal" type="number" value="8" min="2" max="40"></div></div>
    <label>Big text on every phone</label><input id="hText" maxlength="40" value="GYANU BAHAR AAO!">
    <button class="b p" style="margin-top:12px" id="hGo">🔥 DROP IT ON EVERY PHONE</button>
    <p class="mut" style="margin-top:10px">All moments are in place: scream, clap, shake, freeze. Use STATUE MODE as a calm-down tool if a section gets pushy. Mic audio never leaves the phones — only a loudness number.</p></div>`;
}

// ---------- CROWD + SCENE
function crowd() {
  const crowded = S.scene.filter(r => r.cat === 'crowded');
  const zones = ZONES.map(z => { const c = S.zones[z.id]?.crowd || 'ok', n = crowded.filter(r => r.zone === z.id).length;
    return `<tr><td><b>${esc(z.name)}</b>${n ? ` <span class="tag final">⚠️ ${n} crowd report${n > 1 ? 's' : ''}</span>` : ''}</td><td class="zonebtns"><div class="row">${[['ok', 'g', 'OK'], ['busy', 'o', 'BUSY'], ['closed', 'r', 'CLOSED']].map(([k, cl, l]) => `<button class="b ${cl} sm${c === k ? ' on' : ''}" data-z="${z.id}" data-c="${k}">${l}</button>`).join('')}</div></td></tr>`; }).join('');
  return `<div class="card"><h2>CROWD STATUS BY ZONE</h2><p class="mut" style="margin-bottom:8px">BUSY = warning on every map. CLOSED = hunts there disappear and photos there are refused. For a full stop, use ⏸ PAUSE.</p><table>${zones}</table></div>
    <div class="card"><h2>POST AN OFFICIAL PIN</h2><div class="row"><select id="pinCat" style="width:auto">${SCENE_CATS.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}</select><select id="pinZone" style="width:auto">${ZONES.map(z => `<option value="${z.id}">${z.name}</option>`).join('')}</select><input id="pinNote" maxlength="60" placeholder="e.g. Free water refills here" style="flex:1;min-width:180px"><button class="b p sm" id="pinGo">POST</button></div></div>
    <div class="card"><h2>LIVE SCENE (${S.scene.length})</h2><table>${S.scene.map(r => `<tr><td>${ci(r.cat)}</td><td><b>${esc(zn(r.zone))}</b> ${esc(r.note)}</td><td class="mut">${r.official ? 'CREW' : esc(r.by)} · ${ago(r.createdAt)} · 👍${r.yes} ✋${r.gone}</td><td><button class="b k sm" data-rdel="${r.id}">REMOVE</button></td></tr>`).join('')}</table></div>`;
}

// ---------- PLAYERS / BOARD / SETTINGS
function players() {
  return `<div class="card"><h2>PLAYERS (${S.players.length})</h2><input id="pq" placeholder="search nickname" style="max-width:300px;margin-bottom:8px">
    <table id="ptab"><tr><th>NICK</th><th>SLOGAN</th><th>SCORE</th><th>FOUND</th><th></th></tr>${S.players.map(p => `<tr data-n="${esc(p.nick)}"><td><b>${esc(p.nick)}</b>${p.bot ? ' <span class="tag">demo</span>' : ''}${p.banned ? ' <span class="tag final">BANNED</span>' : ''}</td><td class="mut">${esc(p.slogan)}</td><td>${p.score}</td><td>${p.finds}</td><td><button class="b ${p.banned ? 'g' : 'r'} sm" data-pban="${p.id}" data-on="${p.banned ? 0 : 1}">${p.banned ? 'UNBAN' : 'BAN'}</button></td></tr>`).join('')}</table>
    <p class="mut" style="margin-top:8px">The control room never sees phone numbers — they live (if OTP is on) only in the auth provider.</p></div>`;
}
function board() {
  return `<div class="card" style="max-width:640px"><h2>TOP HUNTERS</h2><table>${S.board.map(r => `<tr><td class="big" style="font-size:20px">${r.rank}</td><td><b>${esc(r.nick)}</b><div class="mut">🪧 ${esc(r.slogan)}</div></td><td style="font:20px var(--d)">${r.score}</td></tr>`).join('')}</table></div>`;
}
function settings() {
  return `<div class="card" style="max-width:640px"><h2>SETTINGS</h2>
    <p class="mut">Backend: <b>${backend.kind}</b>${backend.kind === 'local' ? ' (demo — data lives in this browser only; switch to Supabase in js/config.js for a real event)' : ''}</p>
    <label>New control-room PIN</label><div class="row"><input id="newPin" type="password" style="max-width:220px"><button class="b sm" id="savePin">CHANGE PIN</button></div>
    <h2 style="margin-top:20px">DANGER ZONE</h2>
    <div class="row"><button class="b o" id="purge">🧽 WIPE ALL PHOTOS NOW</button><button class="b r" id="reset">♻ RESET SCORES</button>${backend.kind === 'local' ? '<button class="b r" id="factory">💣 RESET DEMO DATABASE</button>' : ''}</div>
    <p class="mut" style="margin-top:10px">Photos auto-delete after ${CONFIG.photoRetentionHours}h. Wipe them all right after the event.</p></div>`;
}
