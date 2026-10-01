// GYANU HUNT · preview-only crew panel. Lets one person play both sides in a single screen:
// snap a sample Gyanu (no camera needed), approve photos, drop golden / final / hype, pause.
import { backend } from './backend.js';

const PIN = '2468';
const $ = s => document.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
const css = `
#demoBtn{position:absolute;left:10px;top:calc(var(--top) + 30px + 114px);z-index:25;font:12px var(--display);background:var(--ink);color:var(--yellow);border:2.5px solid var(--yellow);border-radius:8px;padding:8px 10px;box-shadow:3px 3px 0 var(--pink)}
#demoPanel{position:absolute;left:10px;right:10px;top:calc(var(--top) + 36px);z-index:45;background:var(--ink);color:#fff;border:3px solid var(--yellow);border-radius:12px;padding:12px;box-shadow:5px 5px 0 var(--pink);max-height:calc(100% - var(--top) - 120px);overflow:auto}
#demoPanel h4{font:16px var(--display);color:var(--yellow);margin:2px 0 8px}
#demoPanel p{font-size:12px;color:#CFC6B8;margin:10px 0 6px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
#demoPanel .g{display:grid;grid-template-columns:1fr 1fr;gap:6px}
#demoPanel button.d{font:12px var(--display);padding:10px 6px;border-radius:8px;border:2px solid #000;background:var(--yellow);color:var(--ink);box-shadow:2px 2px 0 #000}
#demoPanel button.d.p{background:var(--pink);color:#fff}#demoPanel button.d.r{background:var(--red);color:#fff}#demoPanel button.d.t{background:var(--teal);color:#fff}#demoPanel button.d.k{background:#2C2836;color:#fff;border-color:#555}
#demoPanel .note{font-size:11.5px;color:#A79FB4;margin-top:10px;text-transform:none;letter-spacing:0;font-weight:500}`;

function sampleImage() { // a printed Gyanu marker, photographed slightly differently each time
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 480;
      const x = c.getContext('2d');
      x.fillStyle = `hsl(${20 + Math.random() * 40},${15 + Math.random() * 15}%,${30 + Math.random() * 25}%)`; x.fillRect(0, 0, 640, 480);
      for (let i = 0; i < 30; i++) { x.fillStyle = `hsla(${Math.random() * 360},30%,${30 + Math.random() * 40}%,.5)`; x.fillRect(Math.random() * 640, Math.random() * 480, 20 + Math.random() * 120, 20 + Math.random() * 80); }
      x.save(); x.translate(320 + (Math.random() - .5) * 120, 240 + (Math.random() - .5) * 60); x.rotate((Math.random() - .5) * .4);
      const w = 300 + Math.random() * 60, h = w * 1.3;
      x.fillStyle = '#FFD400'; x.fillRect(-w / 2, -h / 2, w, h);
      for (let i = -w / 2; i < w / 2; i += 26) { x.fillStyle = '#FF2E88'; x.fillRect(i, -h / 2 + 8, 20, 36); x.fillRect(i, h / 2 - 44, 20, 36); }
      x.drawImage(img, -w * .4, -h * .3, w * .8, w * .83);
      x.restore();
      c.toBlob(b => res(new File([b], 'gyanu.jpg', { type: 'image/jpeg' })), 'image/jpeg', .85);
    };
    img.src = 'img/gyanu.svg';
  });
}

async function snapSample() {
  try { localStorage.setItem('gh_cam_ok', '1'); } catch {}
  document.querySelector('[data-v=hunt]')?.click(); await wait(150);
  const scan = $('#scanBtn');
  if (!scan) return toast('No Gyanu is live right now — drop one first.');
  if (scan.disabled) return toast('Still on cooldown — wait for the button to unlock.');
  scan.click(); await wait(400);
  const input = $('#camFile'); if (!input) return;
  const dt = new DataTransfer(); dt.items.add(await sampleImage());
  input.files = dt.files; input.dispatchEvent(new Event('change'));
}

function toast(m) { document.querySelector('.toast')?.remove(); const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; $('#app').appendChild(t); setTimeout(() => t.remove(), 2600); }
const A = (action, args = {}) => backend.admin(action, { pin: PIN, ...args });

async function act(kind) {
  close();
  const s = await A('state');
  const byType = t => s.gyanus.find(g => g.type === t);
  switch (kind) {
    case 'snap': return snapSample();
    case 'approve': {
      const p = s.subs.filter(x => x.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
      if (!p.length) return toast('Nothing waiting for the judges.');
      for (const x of p) await A('review', { id: x.id, decision: 'approve', quality: 'clear' });
      return;
    }
    case 'pay': {
      const l = (await A('callReqs')).filter(q => q.status === 'new'); if (!l.length) return toast('No payment requests waiting.');
      for (const q of l) await A('callApprove', { id: q.id }); return toast(`Approved ${l.length} payment${l.length === 1 ? '' : 's'}.`);
    }
    case 'reject': {
      const p = s.subs.find(x => x.status === 'pending'); if (!p) return toast('Nothing waiting for the judges.');
      return A('review', { id: p.id, decision: 'reject', reason: 'That’s a chai cup, not Gyanu' });
    }
    case 'move': {
      const live = s.gyanus.filter(g => g.active && g.type === 'classic'), off = s.gyanus.filter(g => !g.active && g.type === 'classic');
      if (!off.length) { // make a fresh classic Gyanu somewhere new
        const zones = ['banyan', 'food', 'games', 'gate', 'stage'];
        await A('saveGyanu', { gyanu: { label: 'Demo prop', zone: zones[Math.floor(Math.random() * zones.length)], hint: 'Fresh drop. Look up, look around.', type: 'classic', points: 100, verify: 'reference' } });
        const s2 = await A('state'); const n = s2.gyanus.find(g => !g.active && g.type === 'classic');
        return A('move', { from: live[0]?.id, to: n.id });
      }
      return A('move', { from: live[0]?.id, to: off[0].id });
    }
    case 'golden': return A('activate', { id: byType('golden').id, on: true });
    case 'final': return A('activate', { id: byType('final').id, on: true });
    case 'chant': return A('hype', { kind: 'chant', text: 'GYANU BAHAR AAO!', dur: 30, goal: 4 });
    case 'shake': return A('hype', { kind: 'shake', text: 'SHAKE THE BANYAN!', dur: 30, goal: 4 });
    case 'statue': return A('hype', { kind: 'statue', text: 'FREEZE. NOBODY MOVES.', dur: 25, goal: 4 });
    case 'lights': return A('hype', { kind: 'lights', text: 'LIGHT IT UP', dur: 20 });
    case 'pause': return A('settings', { patch: s.settings.paused ? { paused: false, pauseReason: '' } : { paused: true, pauseReason: 'Crowd’s getting thick near the stage. Stay where you are, chill, sip something. We’ll be back.' } });
    case 'busy': return A('zone', { id: 'food', crowd: s.zones.food?.crowd === 'busy' ? 'ok' : 'busy' });
    case 'closed': return A('zone', { id: 'games', crowd: s.zones.games?.crowd === 'closed' ? 'ok' : 'closed' });
    case 'reset': try { localStorage.clear(); sessionStorage.clear(); } catch {} return location.reload();
  }
}

function close() { $('#demoPanel')?.remove(); }
function open() {
  if ($('#demoPanel')) return close();
  const p = document.createElement('div'); p.id = 'demoPanel';
  p.innerHTML = `<h4>🎛 PREVIEW CREW PANEL</h4>
    <p>You, the hunter</p><div class="g"><button class="d p" data-a="snap">📸 SNAP A SAMPLE GYANU</button><button class="d k" data-a="close">close panel</button></div>
    <p>Judges</p><div class="g"><button class="d t" data-a="approve">✓ APPROVE PENDING</button><button class="d k" data-a="reject">✕ REJECT ONE</button><button class="d t" data-a="pay">💸 APPROVE ₹5 CALL PAYMENTS</button></div>
    <p>Gyanu</p><div class="g"><button class="d" data-a="move">🚶 GYANU HAS MOVED</button><button class="d" data-a="golden">✨ DROP GOLDEN</button><button class="d r" data-a="final">💀 START FINAL BOSS</button></div>
    <p>Hype moments</p><div class="g"><button class="d p" data-a="chant">🎤 CHANT-O-METER</button><button class="d p" data-a="shake">📳 SHAKE THE BANYAN</button><button class="d p" data-a="statue">🧊 STATUE MODE</button><button class="d p" data-a="lights">🔦 LIGHT SHOW</button></div>
    <p>Crowd safety</p><div class="g"><button class="d r" data-a="pause">⏸ PAUSE / RESUME</button><button class="d k" data-a="busy">⚠️ FOOD GALI BUSY</button><button class="d k" data-a="closed">⛔ GAMES CLOSED</button><button class="d k" data-a="reset">♻ RESET PREVIEW</button></div>
    <p class="note">Preview limits: this frame blocks the camera, mic and file downloads, so photos come from "Snap a sample", hype moments fall back to MASH THIS, and Share can't save the card. On your real site all three work.</p>`;
  p.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; b.dataset.a === 'close' ? close() : act(b.dataset.a).catch(err => toast(err.message)); };
  $('#app').appendChild(p);
}

const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
const btn = document.createElement('button'); btn.id = 'demoBtn'; btn.textContent = '🎛 CREW'; btn.onclick = open;
const show = () => { const inGame = !$('#game')?.classList.contains('hide'); btn.style.display = inGame ? '' : 'none'; };
$('#app').appendChild(btn); show();
new MutationObserver(show).observe($('#game'), { attributes: true, attributeFilter: ['class'] });
