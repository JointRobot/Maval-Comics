// GYANU HUNT · hand-held walkthrough + narrated intro. One small engine, two modes:
//   spotlight steps (target = a selector): dims the screen, rings the button, a 👆 hand points at it
//   card steps (no target): a big full-screen card; in `auto` mode it advances itself after the narration
import { play, speak, stopSpeak, canSpeak, sfxState, setVoice } from './sfx.js';

const $ = s => document.querySelector(s);

let live = null;
export const tourOpen = () => !!live;

export function runTour(steps, { auto = false, autoChoice = false, doneLabel = 'LET’S HUNT', onDone } = {}) {
  live?.end(true);
  const app = $('#app'); let i = -1, dead = false, token = 0;
  const root = document.createElement('div'); root.className = 'tour';
  root.innerHTML = `<div class="tour-hole"></div><div class="tour-hand">👆</div>
    <div class="tour-card"><div class="tour-emoji"></div><h3></h3><p></p>
      <div class="tour-dots"></div><button class="btn teal tour-auto" style="display:none;margin:0 0 10px;min-height:44px;font-size:15px">▶ AUTO-PLAY THE 40-SEC VERSION</button>
      <div class="tour-row"><button class="link tour-skip">skip</button><button class="tour-snd" aria-label="Toggle voice"></button><button class="btn pink tour-next">NEXT</button></div></div>`;
  app.appendChild(root);
  const hole = root.querySelector('.tour-hole'), hand = root.querySelector('.tour-hand'), card = root.querySelector('.tour-card');
  const next = root.querySelector('.tour-next'), snd = root.querySelector('.tour-snd'), autoBtn = root.querySelector('.tour-auto');
  autoBtn.onclick = () => { auto = true; autoBtn.style.display = 'none'; say(steps[i]); };
  // tap anywhere on a full-screen card to move on (buttons keep their own jobs)
  root.addEventListener('click', e => { if (root.classList.contains('full') && !e.target.closest('button')) advance(); });
  const paintSnd = () => { snd.textContent = sfxState.voice && !sfxState.muted ? '🔊' : '🔇'; snd.style.display = canSpeak() ? '' : 'none'; };
  paintSnd();
  snd.onclick = () => { setVoice(!sfxState.voice); paintSnd(); if (sfxState.voice) say(steps[i]); };
  root.querySelector('.tour-skip').onclick = () => end(true);
  next.onclick = () => advance();
  root.querySelector('.tour-dots').innerHTML = steps.map(() => '<i></i>').join('');

  function say(s) {
    const my = ++token;
    return speak(s.say || s.text).then(() => { if (auto && !dead && my === token) setTimeout(() => my === token && advance(), 700); });
  }

  async function show(n) {
    const s = steps[n]; if (!s) return end(false);
    i = n;
    if (s.before) { try { await s.before(); } catch {} await new Promise(r => setTimeout(r, 260)); }
    if (dead) return;
    play(s.sfx || 'pop');
    root.querySelectorAll('.tour-dots i').forEach((d, k) => d.classList.toggle('on', k <= n));
    card.querySelector('.tour-emoji').textContent = s.emoji || '';
    card.querySelector('h3').textContent = s.title || '';
    card.querySelector('p').textContent = s.text;
    next.textContent = n === steps.length - 1 ? doneLabel : (n === 0 && autoChoice ? 'TAP TO START' : 'NEXT');
    autoBtn.style.display = n === 0 && autoChoice && !auto ? '' : 'none';
    card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    place(s);
    say(s);
  }

  function place(s) {
    const a = app.getBoundingClientRect();
    let r = null;
    if (typeof s.target === 'function') r = s.target();
    else { const el = s.target && $(s.target); r = el && el.offsetParent !== null ? el.getBoundingClientRect() : null; }
    if (!r || r.height < 8) { // card step: whole screen dimmed, card in the middle
      root.classList.add('full'); root.classList.remove('spot');
      hole.style.cssText = ''; hand.style.display = 'none'; card.style.top = card.style.bottom = ''; return;
    }
    root.classList.add('spot'); root.classList.remove('full');
    const pad = 6, x = r.left - a.left - pad, y = r.top - a.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
    hole.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    const lower = (y + h / 2) > a.height * 0.55;       // target in the bottom half → card goes on top, hand points up from below… or down from above
    hand.style.display = '';
    hand.textContent = lower ? '👇' : '👆';
    hand.style.left = Math.min(a.width - 46, Math.max(6, x + w / 2 - 22)) + 'px';
    hand.style.top = (lower ? y - 52 : y + h + 4) + 'px';
    if (lower) { card.style.top = '70px'; card.style.bottom = ''; } else { card.style.top = ''; card.style.bottom = '14px'; }
  }

  function advance() { stopSpeak(); token++; if (i >= steps.length - 1) end(false); else show(i + 1); }
  function end(skipped) {
    if (dead) return; dead = true; token++; stopSpeak(); root.remove(); live = null;
    if (!skipped) play('tada');
    onDone?.(skipped);
  }
  const onResize = () => { if (!dead && steps[i]) place(steps[i]); };
  addEventListener('resize', onResize);
  live = { end: s => { removeEventListener('resize', onResize); end(s); } };
  show(0);
  return live;
}

