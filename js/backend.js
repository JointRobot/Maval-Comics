// GYANU HUNT · backend adapters. Both expose the same API:
//   player:  register, setSlogan, state, submit, ack, leaderboard, history, deleteMe,
//            hype(level), homeScore(n), scene(), report(), vote()
//   admin:   admin(action, payload)   (one dispatcher, mirrored by gh_admin() in schema.sql)
// LocalBackend runs the whole game server inside the browser (demo / rehearsal mode).
// SupabaseBackend calls the Postgres functions in supabase/schema.sql.

import { CONFIG, ZONES, SCENE_CATS } from './config.js';
import { RULES, scoreFind } from './rules.js';
import { hamming } from './verify.js';
import { SLOGANS } from './copy.js';
const PRESETS = new Set(SLOGANS);

const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const now = () => Date.now();
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

// ---------- nicknames, slogans, avatars (shared by both backends) ----------
const BLOCK = ['fuck', 'shit', 'bitch', 'chutiya', 'chootiya', 'madarchod', 'bhenchod', 'behenchod', 'gandu', 'randi', 'bsdk', 'bhosdi', 'lavde', 'lawde', 'harami', 'kill', 'maro', 'jala', 'rape', 'nigg'];
const rude = s => { const l = s.toLowerCase().replace(/[^a-z]/g, ''); return BLOCK.some(b => l.includes(b)); };
export function cleanNick(raw) {
  const n = String(raw || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 12);
  if (n.length < 3) return { error: 'Nickname needs 3–12 letters or numbers.' };
  if (rude(n)) return { error: 'Pick a friendlier nickname, bestie.' };
  return { nick: n };
}
export function cleanSlogan(raw) {
  const s = String(raw || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!s) return { slogan: '' };
  if (rude(s)) return { error: 'Keep the placard roast-y, not abusive.' };
  if (/https?:|www\.|@/i.test(s) || /\d{6,}/.test(s.replace(/[\s-]/g, ''))) return { error: 'No links, emails or phone numbers on a placard.' };
  // Custom placards must be in English letters/emoji (our rude-word check can't read other scripts).
  // Tamil, Bengali, Marathi and Hindi placards come from the ready-made list.
  if (/[^\u0000-\u024F\u2000-\u2BFF\uFE0F\u{1F000}-\u{1FAFF}]/u.test(s) && !PRESETS.has(s)) return { error: 'Custom placards need English letters. Pick a ready-made one for Tamil, Bengali, Marathi or Hindi.' };
  return { slogan: s };
}
export const avatarFor = id => {
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { c: h % 6, p: (h >> 3) % 4 };
};
const cleanNote = s => String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);

// =====================================================================
// LocalBackend
// =====================================================================
const KEY = 'gh_db_v2', ME = 'gh_me_v1';

function seed() {
  const t = now();
  const db = {
    v: 2,
    settings: { paused: false, pauseReason: '', ended: false, finalLive: false, winner: null, adminPin: '2468', startedAt: t, hype: null, hypeWins: 0 },
    zones: Object.fromEntries(ZONES.map(z => [z.id, { crowd: 'ok' }])),
    gyanus: [
      { id: 'g_demo1', label: 'Cut-out behind the chai counter', zone: 'chai', hint: 'Follow the smell of elaichi.', type: 'classic', points: 100, verify: 'reference', refs: [], active: true, activatedAt: t - 20000, finds: 0, claimedBy: null },
      { id: 'g_demo2', label: 'Poster on the art wall, left panel', zone: 'art', hint: 'He loves a good mural. Main character of the wall.', type: 'classic', points: 100, verify: 'manual', refs: [], active: true, activatedAt: t - 200000, finds: 0, claimedBy: null },
      { id: 'g_gold', label: 'Gold Gyanu on the stage-left speaker', zone: 'stage', hint: 'Shiny. Loud. Near the music.', type: 'golden', points: 500, verify: 'manual', refs: [], active: false, activatedAt: null, finds: 0, claimedBy: null },
      { id: 'g_final', label: 'Final Gyanu at the main gate arch', zone: 'gate', hint: 'Where it all began.', type: 'final', points: 1000, verify: 'manual', refs: [], active: false, activatedAt: null, finds: 0, claimedBy: null }
    ],
    players: [],
    subs: [],
    scene: [
      { id: 'r_w1', cat: 'water', zone: 'gate', note: 'Free water at the blue tent', by: null, official: true, createdAt: t, yes: [], gone: [] },
      { id: 'r_m1', cat: 'medic', zone: 'gate', note: 'First aid, next to the info booth', by: null, official: true, createdAt: t, yes: [], gone: [] },
      { id: 'r_f1', cat: 'food', zone: 'food', note: 'Vada pav ₹20, short line', by: 'bot', official: false, createdAt: t - 6 * 60e3, yes: ['x', 'y'], gone: [] },
      { id: 'r_c1', cat: 'charge', zone: 'chai', note: 'Plug points behind the counter', by: 'bot', official: false, createdAt: t - 15 * 60e3, yes: [], gone: [] }
    ]
  };
  // Fictional rivals so the leaderboard is alive in the demo.
  const fake = [['GYNUKILLER', 1240, 9, 'Soda lemon ginger pop, Gyanu bhai is a flop', 44], ['CHAIWALA', 1110, 8, 'Cutting chai, cutting Gyanu’s hiding streak', 31], ['TCHUTCHU', 980, 7, 'Go Gyanu go! (no seriously, go)', 52], ['VADAPAVKING', 720, 5, 'Unemployed? Yes. Undefeated? Also yes.', 18], ['LOCALTRAIN', 430, 3, 'Chronically online, briefly outside', 27]];
  for (const [nick, score, finds, slogan, home] of fake) {
    const id = uid('p_');
    db.players.push({ id, nick, slogan, avatar: avatarFor(id), score, finds, streak: 0, bestStreak: 2, lastZone: ZONES[finds % ZONES.length].id, lastSubmitAt: 0, banned: false, createdAt: t, bot: true, notices: [], todayBase: score, homeBest: home, punchBest: 40 + (home * 3) % 70, lastHomeAt: 0, lastPunchAt: 0, lastSeen: 0, reports: [] });
  }
  return db;
}

export class LocalBackend {
  constructor() {
    this.kind = 'local';
    this.listeners = new Set();
    try { this.bc = new BroadcastChannel('gyanu_hunt'); this.bc.onmessage = () => this.emit(); } catch { this.bc = null; }
    addEventListener('storage', e => { if (e.key === KEY) this.emit(); });
  }
  on(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  emit() { for (const cb of this.listeners) cb(); }
  load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.v === 2) return d; } catch {}
    const d = seed(); this.save(d, true); return d;
  }
  save(db, quiet) {
    // Keep the demo inside localStorage limits: only the newest 60 thumbnails survive.
    const withThumb = db.subs.filter(s => s.thumb);
    if (withThumb.length > 60) withThumb.slice(0, withThumb.length - 60).forEach(s => (s.thumb = null));
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch { db.subs.forEach(s => (s.thumb = null)); localStorage.setItem(KEY, JSON.stringify(db)); }
    if (!quiet) { this.bc?.postMessage(1); this.emit(); }
  }
  meId() { try { return JSON.parse(localStorage.getItem(ME))?.id || null; } catch { return null; } }
  me(db) { return db.players.find(p => p.id === this.meId()) || null; }

  async register(rawNick, rawSlogan = '') {
    const c = cleanNick(rawNick); if (c.error) throw new Error(c.error);
    const s = cleanSlogan(rawSlogan); if (s.error) throw new Error(s.error);
    const db = this.load();
    let nick = c.nick;
    while (db.players.some(p => p.nick === nick)) nick = c.nick.slice(0, 9) + '#' + (10 + Math.floor(Math.random() * 90));
    const id = uid('p_');
    const p = { id, nick, slogan: s.slogan, avatar: avatarFor(id), score: 0, finds: 0, streak: 0, bestStreak: 0, lastZone: null, lastSubmitAt: 0, banned: false, createdAt: now(), notices: [], homeBest: 0, punchBest: 0, lastHomeAt: 0, lastPunchAt: 0, lastSeen: now(), reports: [] };
    db.players.push(p); this.save(db);
    localStorage.setItem(ME, JSON.stringify({ id, token: uid('t_') }));
    return { id, nick, avatar: p.avatar, slogan: p.slogan };
  }
  async setSlogan(raw) {
    const s = cleanSlogan(raw); if (s.error) throw new Error(s.error);
    const db = this.load(); const me = this.me(db); if (!me) throw new Error('Join first');
    me.slogan = s.slogan; this.save(db); return s.slogan;
  }

  hypeView(db, meId) {
    const h = db.settings.hype; if (!h) return null;
    const n = Object.keys(h.contrib || {}).length;
    return { id: h.id, kind: h.kind, text: h.text, startedAt: h.startedAt, endsAt: h.endsAt, done: h.done, doneAt: h.doneAt, failed: !h.done && now() > h.endsAt,
      progress: h.kind === 'lights' ? 0 : Math.min(1, h.total / (h.goal * Math.max(1, n))), joined: n, iJoined: !!(meId && h.contrib?.[meId]) };
  }
  stats(db) {
    const t0 = startOfToday(), live = this.liveScene(db);
    return {
      online: db.players.filter(p => now() - (p.lastSeen || 0) < 5 * 60e3).length,
      crowd: db.players.filter(p => !p.banned).length,
      caught: db.subs.filter(s => s.status === 'approved' && s.createdAt >= t0).length,
      hypeWins: db.settings.hypeWins || 0,
      water: live.filter(r => r.cat === 'water').length,
      busy: ZONES.filter(z => db.zones[z.id]?.crowd !== 'ok' || live.some(r => r.cat === 'crowded' && r.zone === z.id)).map(z => z.id)
    };
  }

  async state() {
    const db = this.load();
    this.purgeOld(db);
    const me = this.me(db);
    if (me && now() - (me.lastSeen || 0) > 20e3) { me.lastSeen = now(); this.save(db, true); }
    const mySubs = me ? db.subs.filter(s => s.playerId === me.id && s.status !== 'void') : [];
    const closed = id => db.zones[id]?.crowd === 'closed';
    const hunts = db.gyanus.filter(g => g.active && !closed(g.zone)).map(g => ({
      id: g.id, zone: g.zone, hint: g.hint, type: g.type, activatedAt: g.activatedAt, finds: g.finds, points: g.points,
      verify: g.verify, refs: (g.refs || []).map(r => ({ hash: r.hash, sig: r.sig })), // fingerprints only, never the photos
      found: mySubs.some(s => s.gyanuId === g.id && s.status === 'approved'),
      pending: mySubs.some(s => s.gyanuId === g.id && s.status === 'pending'),
      tries: mySubs.filter(s => s.gyanuId === g.id && (s.status === 'rejected' || s.status === 'duplicate')).length
    }));
    const board = this.rank(db, 'global');
    return {
      serverNow: now(),
      settings: { paused: db.settings.paused, pauseReason: db.settings.pauseReason, ended: db.settings.ended, finalLive: db.settings.finalLive, winner: db.settings.winner },
      hype: this.hypeView(db, me?.id),
      stats: this.stats(db),
      zones: db.zones,
      hunts,
      me: me && {
        id: me.id, nick: me.nick, slogan: me.slogan, avatar: me.avatar, score: me.score, finds: me.finds, streak: me.streak, bestStreak: me.bestStreak,
        banned: me.banned, rank: (board.findIndex(r => r.id === me.id) + 1) || null, players: board.length,
        lastSubmitAt: me.lastSubmitAt, notices: me.notices || [], homeBest: me.homeBest || 0, punchBest: me.punchBest || 0
      }
    };
  }

  async ack(ids) {
    const db = this.load(); const me = this.me(db); if (!me) return;
    me.notices = (me.notices || []).filter(n => !ids.includes(n.id)); this.save(db, true);
  }

  // The heart of the server: one photo in, one verdict out.
  async submit({ gyanuId, analysis, verdict }) {
    const db = this.load();
    const me = this.me(db);
    if (!me) throw new Error('Join the hunt first.');
    if (me.banned) return { status: 'blocked', reason: 'Your account is on hold. Talk to the Gyanu crew.' };
    if (db.settings.ended) return { status: 'blocked', reason: 'The hunt is over. GG.' };
    if (db.settings.paused) return { status: 'blocked', reason: db.settings.pauseReason || 'Hunt paused. Stay where you are, bestie.' };
    const g = db.gyanus.find(x => x.id === gyanuId && x.active);
    if (!g) return { status: 'blocked', reason: 'Gyanu already dipped from here. Check the map.' };
    if (db.zones[g.zone]?.crowd === 'closed') return { status: 'blocked', reason: 'That zone is closed right now. Not worth it.' };
    const t = now();
    const wait = Math.ceil((me.lastSubmitAt + RULES.cooldownSec * 1000 - t) / 1000);
    if (wait > 0) return { status: 'cooldown', wait, reason: `Chill for ${wait}s — look around, then shoot.` };
    const mine = db.subs.filter(s => s.playerId === me.id && s.gyanuId === g.id && s.status !== 'void');
    if (mine.some(s => s.status === 'approved')) return { status: 'blocked', reason: 'You already caught this one. Find the next.' };
    if (mine.some(s => s.status === 'pending')) return { status: 'blocked', reason: 'Your last pic is still with the judges.' };
    if (mine.filter(s => s.status === 'rejected' || s.status === 'duplicate').length >= RULES.maxTriesPerGyanu) return { status: 'blocked', reason: 'Out of tries on this one. Wait for Gyanu to move.' };

    me.lastSubmitAt = t;
    const sub = { id: uid('s_'), playerId: me.id, gyanuId: g.id, zone: g.zone, hash: analysis.hash, thumb: analysis.thumb, createdAt: t, status: 'pending', confidence: verdict.confidence, via: verdict.via, quality: null, points: 0, parts: null, reason: '' };

    // Fake detection: the same picture (or a screenshot of it) seen before.
    const recent = db.subs.filter(s => t - s.createdAt < 6 * 3600e3 && s.hash);
    const dup = recent.find(s => hamming(s.hash, analysis.hash) <= (s.playerId === me.id ? RULES.dupHamming : 4));
    if (dup) {
      sub.status = 'duplicate'; sub.reason = 'Same photo as an earlier one.';
      me.streak = 0;
      db.subs.push(sub); this.save(db);
      return { status: 'duplicate', points: 0 };
    }
    db.subs.push(sub);
    if (verdict.status === 'approved') {
      const r = this.approve(db, sub, verdict.quality);
      this.save(db);
      return { status: 'approved', zone: g.zone, ...r };
    }
    this.save(db);
    return { status: 'pending', zone: g.zone };
  }

  // Award points for an approved submission (auto or by a judge).
  approve(db, sub, quality) {
    const g = db.gyanus.find(x => x.id === sub.gyanuId);
    const p = db.players.find(x => x.id === sub.playerId);
    const order = g.finds;
    const secs = Math.max(0, (sub.createdAt - (g.activatedAt || sub.createdAt)) / 1000);
    const r = scoreFind({ order, gyanu: g, secondsSinceLive: secs, quality: quality || 'partial', streakBefore: p.streak });
    Object.assign(sub, { status: 'approved', quality: quality || 'partial', points: r.total, parts: r.parts });
    g.finds++;
    p.score += r.total; p.finds++; p.streak = r.streak; p.bestStreak = Math.max(p.bestStreak, r.streak); p.lastZone = g.zone;
    let special = null;
    if (g.type === 'golden' && order === 0) { g.claimedBy = p.id; g.active = false; special = 'golden'; }
    if (g.type === 'final' && order === 0) {
      g.claimedBy = p.id; g.active = false; special = 'final';
      db.settings.finalLive = false; db.settings.ended = true; db.settings.winner = p.nick;
    }
    return { points: r.total, parts: r.parts, streak: r.streak, order, special };
  }

  // ---------- hype moments: phones send a 0..1 level every ~1.5 s
  async hype(level) {
    const db = this.load(); const me = this.me(db); const h = db.settings.hype;
    if (!me || !h || h.done || now() > h.endsAt || h.kind === 'lights' || me.banned) return this.hypeView(db, me?.id);
    const last = h.last?.[me.id] || 0;
    if (now() - last < 1000) return this.hypeView(db, me.id); // rate limit
    const v = Math.max(0, Math.min(1, Number(level) || 0));
    h.last = { ...(h.last || {}), [me.id]: now() };
    h.contrib = { ...(h.contrib || {}), [me.id]: (h.contrib?.[me.id] || 0) + v };
    h.total += v;
    const n = Object.keys(h.contrib).length;
    if (h.total >= h.goal * n) { // the crowd did it
      h.done = true; h.doneAt = now(); db.settings.hypeWins = (db.settings.hypeWins || 0) + 1;
      for (const pid of Object.keys(h.contrib)) {
        const p = db.players.find(x => x.id === pid); if (!p || h.contrib[pid] < 1) continue;
        p.score += RULES.hypePoints;
        p.notices = [...(p.notices || []), { id: uid('n_'), kind: 'hype', points: RULES.hypePoints }];
      }
    }
    this.save(db);
    return this.hypeView(db, me.id);
  }

  // ---------- whack-a-Gyanu (at home)
  async homeScore(n) {
    const db = this.load(); const me = this.me(db); if (!me) throw new Error('Join first');
    n = Math.floor(Number(n) || 0);
    if (n < 0 || n > RULES.homeMaxPerRound) return { ok: false, reason: 'That score looks sus. Try again, legit.' };
    if (now() - (me.lastHomeAt || 0) < RULES.homeCooldownSec * 1000) return { ok: false, reason: 'Too fast. Rounds need a breather.' };
    me.lastHomeAt = now();
    const best = n > (me.homeBest || 0);
    if (best) me.homeBest = n;
    this.save(db);
    return { ok: true, best, homeBest: me.homeBest };
  }
  // ---------- punch the bag (60 seconds)
  async punchScore(n) {
    const db = this.load(); const me = this.me(db); if (!me) throw new Error('Join first');
    n = Math.floor(Number(n) || 0);
    if (n < 0 || n > RULES.punchMaxPerRound) return { ok: false, reason: 'That score looks sus. Real fists only.' };
    if (now() - (me.lastPunchAt || 0) < RULES.punchCooldownSec * 1000) return { ok: false, reason: 'Too fast. Shake your hand out.' };
    me.lastPunchAt = now();
    const best = n > (me.punchBest || 0);
    if (best) me.punchBest = n;
    this.save(db);
    return { ok: true, best, punchBest: me.punchBest };
  }

  // ---------- the scene (crowd-sourced live info)
  liveScene(db) {
    const ttl = RULES.sceneTTLMin * 60e3;
    return db.scene.filter(r => r.official || (now() - Math.max(r.createdAt, r.lastYes || 0) < ttl && r.gone.length < r.yes.length + 2));
  }
  async scene() {
    const db = this.load(); const me = this.meId();
    const nick = id => db.players.find(p => p.id === id)?.nick || null;
    return this.liveScene(db).sort((a, b) => b.official - a.official || b.createdAt - a.createdAt)
      .map(r => ({ id: r.id, cat: r.cat, zone: r.zone, note: r.note, official: r.official, createdAt: r.createdAt, yes: r.yes.length, gone: r.gone.length, mine: r.by === me, voted: r.yes.includes(me) || r.gone.includes(me), by: r.official ? 'CREW' : nick(r.by) }));
  }
  async report({ cat, zone, note }) {
    const db = this.load(); const me = this.me(db); if (!me) throw new Error('Join first');
    if (me.banned) throw new Error('Account on hold');
    if (!SCENE_CATS.some(c => c.id === cat) || !ZONES.some(z => z.id === zone)) throw new Error('Pick a type and a zone');
    me.reports = (me.reports || []).filter(t => now() - t < 3600e3);
    // same thing already pinned there? count it as a confirmation instead of a duplicate pin
    const same = this.liveScene(db).find(r => r.cat === cat && r.zone === zone && !r.official);
    if (same) { if (!same.yes.includes(me.id) && same.by !== me.id) { same.yes.push(me.id); same.lastYes = now(); } this.save(db); return { merged: true, points: 0 }; }
    const pts = me.reports.length < RULES.reportCapPerHour ? RULES.reportPoints : 0;
    me.reports.push(now()); me.score += pts;
    db.scene.push({ id: uid('r_'), cat, zone, note: cleanNote(note), by: me.id, official: false, createdAt: now(), yes: [], gone: [] });
    this.save(db);
    return { merged: false, points: pts };
  }
  async vote(id, kind) {
    const db = this.load(); const me = this.me(db); if (!me) throw new Error('Join first');
    const r = db.scene.find(x => x.id === id); if (!r || r.by === me.id || r.yes.includes(me.id) || r.gone.includes(me.id)) return false;
    if (kind === 'yes') { r.yes.push(me.id); r.lastYes = now(); const a = db.players.find(p => p.id === r.by); if (a && r.yes.length <= 5) a.score += RULES.confirmPoints; }
    else r.gone.push(me.id);
    this.save(db); return true;
  }

  rank(db, scope, meId) {
    let rows;
    const live = db.players.filter(p => !p.banned);
    if (scope === 'today') {
      const t0 = startOfToday();
      const sum = {};
      for (const s of db.subs) if (s.status === 'approved' && s.createdAt >= t0) sum[s.playerId] = (sum[s.playerId] || 0) + s.points;
      rows = live.map(p => ({ ...p, score: (sum[p.id] || 0) + (p.bot ? p.todayBase : 0) }));
    } else if (scope === 'nearby') {
      const me = db.players.find(p => p.id === meId);
      rows = me?.lastZone ? live.filter(p => p.lastZone === me.lastZone) : [];
    } else if (scope === 'home') {
      rows = live.map(p => ({ ...p, score: p.homeBest || 0 }));
    } else if (scope === 'punch') {
      rows = live.map(p => ({ ...p, score: p.punchBest || 0 }));
    } else rows = live;
    return rows.filter(p => p.score > 0 || p.id === meId).sort((a, b) => b.score - a.score || a.createdAt - b.createdAt)
      .map((p, i) => ({ rank: i + 1, id: p.id, nick: p.nick, slogan: p.slogan || '', avatar: p.avatar, score: p.score, finds: p.finds }));
  }

  async leaderboard(scope = 'global') {
    const db = this.load(); const me = this.meId();
    const rows = this.rank(db, scope, me);
    const zone = db.players.find(p => p.id === me)?.lastZone || null;
    return { rows: rows.slice(0, 50).map(r => ({ ...r, me: r.id === me })), mine: rows.find(r => r.id === me) || null, zone };
  }

  async history() {
    const db = this.load(); const me = this.meId();
    return db.subs.filter(s => s.playerId === me && s.status !== 'void').reverse().slice(0, 30)
      .map(s => ({ id: s.id, zone: s.zone, status: s.status, points: s.points, createdAt: s.createdAt }));
  }

  async deleteMe() {
    const db = this.load(); const me = this.meId();
    db.subs = db.subs.filter(s => s.playerId !== me);
    db.feedback = (db.feedback || []).filter(x => x.deviceMe !== me);
    db.scene = db.scene.filter(r => r.by !== me).map(r => ({ ...r, yes: r.yes.filter(x => x !== me), gone: r.gone.filter(x => x !== me) }));
    if (db.settings.hype?.contrib) delete db.settings.hype.contrib[me];
    db.players = db.players.filter(p => p.id !== me);
    this.save(db);
    localStorage.removeItem(ME);
  }

  // ---------------- the crowd wall: head-count + placards, nothing else ----------------
  async crowd() {
    const db = this.load(), live = db.players.filter(p => !p.banned), by = new Map();
    for (const p of live) if (p.slogan) { const e = by.get(p.slogan) || { s: p.slogan, n: 0, t: 0 }; e.n++; e.t = Math.max(e.t, p.createdAt || 0); by.set(p.slogan, e); }
    return { total: live.length, slogans: [...by.values()].sort((a, b) => b.n - a.n || b.t - a.t).slice(0, 120).map(({ s, n }) => ({ s, n })) };
  }

  // ---------------- suggestion box ----------------
  async feedback(f) {
    const db = this.load(); db.feedback = db.feedback || []; const me = this.me(db);
    const text = String(f.text || '').replace(/[<>]/g, '').trim().slice(0, 1200);
    if (!text && !f.audio) throw new Error('Say or type something first.');
    const mine = db.feedback.filter(x => x.deviceMe === (me?.id || 'anon') && x.createdAt > now() - 3600e3).length;
    if (mine >= 6) throw new Error('Easy, that’s plenty for now. Try again in a bit.');
    db.feedback.unshift({ id: uid('f_'), kind: ['bug', 'annoying', 'idea', 'love'].includes(f.kind) ? f.kind : 'other', text, mood: f.mood > 0 && f.mood <= 5 ? f.mood : null,
      ctx: f.ctx || {}, nick: me?.nick || null, deviceMe: me?.id || 'anon', audio: f.audio && f.audio.length < 240000 ? f.audio : null, mime: f.mime || null, status: 'new', createdAt: now() });
    db.feedback = db.feedback.slice(0, 20); db.feedback.forEach((x, i) => { if (i >= 4) x.audio = null; }); // keep demo storage small
    this.save(db); return { ok: true };
  }

  purgeOld(db) {
    const cut = now() - CONFIG.photoRetentionHours * 3600e3;
    let changed = false;
    for (const s of db.subs) if (s.thumb && s.createdAt < cut && s.status !== 'pending') { s.thumb = null; changed = true; }
    if (changed) this.save(db, true);
  }

  // ---------------- control room ----------------
  async admin(action, a = {}) {
    const db = this.load();
    if (action === 'login') { if (String(a.pin) !== String(db.settings.adminPin)) throw new Error('Wrong PIN'); return true; }
    if (String(a.pin) !== String(db.settings.adminPin)) throw new Error('Not authorised');
    const P = id => db.players.find(p => p.id === id);
    const G = id => db.gyanus.find(g => g.id === id);
    switch (action) {
      case 'state': {
        const name = id => P(id)?.nick || '—';
        const live = this.liveScene(db);
        return {
          settings: { ...db.settings, hype: this.hypeView(db) }, zones: db.zones, stats: this.stats(db),
          gyanus: db.gyanus.map(g => ({ ...g, refs: (g.refs || []).map(r => ({ thumb: r.thumb })), claimedName: g.claimedBy ? name(g.claimedBy) : null })),
          players: db.players.map(p => ({ id: p.id, nick: p.nick, slogan: p.slogan, score: p.score, finds: p.finds, banned: p.banned, bot: !!p.bot, createdAt: p.createdAt })).sort((x, y) => y.score - x.score),
          subs: db.subs.filter(s => s.status !== 'void').slice(-120).reverse().map(s => ({ ...s, nick: name(s.playerId), gyanuLabel: G(s.gyanuId)?.label || '?', gyanuType: G(s.gyanuId)?.type })),
          scene: live.map(r => ({ id: r.id, cat: r.cat, zone: r.zone, note: r.note, official: r.official, createdAt: r.createdAt, yes: r.yes.length, gone: r.gone.length, by: r.official ? 'CREW' : name(r.by) })),
          board: this.rank(db, 'global').slice(0, 20)
        };
      }
      case 'saveGyanu': {
        const g = a.gyanu; let cur = g.id && G(g.id);
        if (!cur) { cur = { id: uid('g_'), active: false, activatedAt: null, finds: 0, claimedBy: null, refs: [] }; db.gyanus.push(cur); }
        Object.assign(cur, { label: g.label, zone: g.zone, hint: g.hint, type: g.type, points: Number(g.points) || 100, verify: g.verify });
        if (g.addRefs) cur.refs = [...(cur.refs || []), ...g.addRefs].slice(-6);
        if (g.clearRefs) cur.refs = [];
        break;
      }
      case 'deleteGyanu': db.gyanus = db.gyanus.filter(g => g.id !== a.id); break;
      case 'activate': {
        const g = G(a.id); if (!g) break;
        g.active = !!a.on;
        if (a.on) { g.activatedAt = now(); g.finds = 0; g.claimedBy = null; if (g.type === 'final') { db.settings.finalLive = true; db.settings.ended = false; db.settings.winner = null; } }
        else if (g.type === 'final') db.settings.finalLive = false;
        break;
      }
      case 'move': { // "Gyanu has moved": switch one appearance off and another on
        const from = G(a.from), to = G(a.to);
        if (from) from.active = false;
        if (to) { to.active = true; to.activatedAt = now(); to.finds = 0; to.claimedBy = null; }
        break;
      }
      case 'settings': Object.assign(db.settings, a.patch || {}); break;
      case 'zone': db.zones[a.id] = { crowd: a.crowd }; break;
      case 'hype': {
        const dur = Math.max(10, Math.min(180, Number(a.dur) || 45));
        db.settings.hype = { id: uid('h_'), kind: a.kind || 'chant', text: String(a.text || '').slice(0, 40) || 'GYANU BAHAR AAO!', startedAt: now(), endsAt: now() + dur * 1000, goal: Number(a.goal) || RULES.hypeGoalPerPhone, total: 0, contrib: {}, last: {}, done: false };
        break;
      }
      case 'hypeStop': if (db.settings.hype) db.settings.hype.endsAt = Math.min(db.settings.hype.endsAt, now()); break;
      case 'scenePin': db.scene.push({ id: uid('r_'), cat: a.cat, zone: a.zone, note: cleanNote(a.note), by: null, official: true, createdAt: now(), yes: [], gone: [] }); break;
      case 'sceneDelete': db.scene = db.scene.filter(r => r.id !== a.id); break;
      case 'review': {
        const s = db.subs.find(x => x.id === a.id); if (!s) break;
        const g = G(s.gyanuId), p = P(s.playerId);
        if (a.decision === 'approve' && s.status !== 'approved') {
          if (!g || !p) throw new Error('Gyanu or player no longer exists');
          const r = this.approve(db, s, a.quality || 'clear');
          p.notices = [...(p.notices || []), { id: uid('n_'), kind: 'approved', points: r.points, parts: r.parts, streak: r.streak, special: r.special, zone: s.zone }];
        } else if (a.decision === 'reject') {
          if (s.status === 'approved' && p) { p.score -= s.points; p.finds--; if (g) g.finds = Math.max(0, g.finds - 1); }
          s.status = 'rejected'; s.points = 0; s.reason = a.reason || 'Not Gyanu';
          if (p) { p.streak = 0; p.notices = [...(p.notices || []), { id: uid('n_'), kind: 'rejected', zone: s.zone, reason: s.reason }]; }
        }
        break;
      }
      case 'clearSlogan': { const p = P(a.id); if (p) p.slogan = ''; break; }
      case 'ban': { const p = P(a.id); if (p) p.banned = !!a.on; break; }
      case 'resetScores':
        db.players.forEach(p => { p.score = 0; p.finds = 0; p.streak = 0; p.bestStreak = 0; p.lastZone = null; p.todayBase = 0; p.notices = []; p.homeBest = 0; p.punchBest = 0; });
        db.subs.forEach(s => { s.status = 'void'; s.thumb = null; });
        db.gyanus.forEach(g => { g.finds = 0; g.claimedBy = null; });
        db.settings.ended = false; db.settings.winner = null; db.settings.hypeWins = 0;
        break;
      case 'feedback': return (db.feedback || []).map(({ audio, deviceMe, ...r }) => ({ ...r, hasAudio: !!audio }));
      case 'feedbackAudio': { const f = (db.feedback || []).find(x => x.id === a.id); return { audio: f?.audio || null, mime: f?.mime || null }; }
      case 'feedbackMark': { const f = (db.feedback || []).find(x => x.id === a.id); if (f) f.status = a.status; break; }
      case 'feedbackDelete': db.feedback = (db.feedback || []).filter(x => x.id !== a.id); break;
      case 'purgePhotos': db.subs.forEach(s => { if (s.status !== 'pending') s.thumb = null; }); break;
      case 'factoryReset': localStorage.removeItem(KEY); this.save(seed()); return true;
      default: throw new Error('Unknown action ' + action);
    }
    this.save(db);
    return true;
  }
}

// =====================================================================
// SupabaseBackend — thin fetch() wrapper around the RPCs in schema.sql.
// No supabase-js (saves ~50 KB). Polling instead of websockets: one tiny
// JSON every few seconds survives crowded event networks better.
// =====================================================================
export class SupabaseBackend {
  constructor() {
    this.kind = 'supabase';
    this.url = CONFIG.supabase.url.replace(/\/$/, '');
    this.key = CONFIG.supabase.anonKey;
    this.listeners = new Set();
    this.timer = setInterval(() => { if (!document.hidden) this.emit(); }, CONFIG.pollMs);
  }
  on(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  emit() { for (const cb of this.listeners) cb(); }
  creds() { try { return JSON.parse(localStorage.getItem(ME)) || {}; } catch { return {}; } }
  tok() { return this.creds().token || null; }
  async rpc(fn, body, bearer) {
    const r = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: this.key, Authorization: `Bearer ${bearer || this.key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.message || `Server error ${r.status}`);
    return j;
  }
  // Phone OTP through Supabase Auth (only if CONFIG.otp === 'supabase').
  async otpSend(phone) {
    const r = await fetch(`${this.url}/auth/v1/otp`, { method: 'POST', headers: { apikey: this.key, 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
    if (!r.ok) throw new Error('Could not send the code. Check the number.');
  }
  async otpVerify(phone, token) {
    const r = await fetch(`${this.url}/auth/v1/verify`, { method: 'POST', headers: { apikey: this.key, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'sms', phone, token }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error('That code did not work.');
    this.jwt = j.access_token; // used once, for gh_register, then discarded
  }
  meId() { return this.creds().id || null; }
  async register(nick, slogan = '') {
    const c = cleanNick(nick); if (c.error) throw new Error(c.error);
    const s = cleanSlogan(slogan); if (s.error) throw new Error(s.error);
    const r = await this.rpc('gh_register', { p_nick: c.nick, p_slogan: s.slogan }, this.jwt);
    this.jwt = null;
    localStorage.setItem(ME, JSON.stringify({ id: r.id, token: r.token }));
    return { id: r.id, nick: r.nick, avatar: avatarFor(r.id), slogan: s.slogan };
  }
  async setSlogan(raw) { const s = cleanSlogan(raw); if (s.error) throw new Error(s.error); await this.rpc('gh_set_slogan', { p_token: this.tok(), p_slogan: s.slogan }); return s.slogan; }
  async state() {
    const s = await this.rpc('gh_state', { p_token: this.tok() });
    if (s.me) s.me.avatar = avatarFor(s.me.id);
    return s;
  }
  async ack(ids) { return this.rpc('gh_ack', { p_token: this.tok(), p_ids: ids }); }
  async submit({ gyanuId, analysis, verdict }) {
    return this.rpc('gh_submit', {
      p_token: this.tok(), p_gyanu: gyanuId, p_hash: analysis.hash, p_thumb: analysis.thumb,
      p_status: verdict.status, p_confidence: verdict.confidence, p_quality: verdict.quality, p_via: verdict.via
    });
  }
  async hype(level) { return this.rpc('gh_hype', { p_token: this.tok(), p_level: level }); }
  async homeScore(n) { return this.rpc('gh_home_score', { p_token: this.tok(), p_score: n }); }
  async punchScore(n) { return this.rpc('gh_punch_score', { p_token: this.tok(), p_score: n }); }
  async scene() { return this.rpc('gh_scene', { p_token: this.tok() }); }
  async report(r) { return this.rpc('gh_report', { p_token: this.tok(), p_cat: r.cat, p_zone: r.zone, p_note: cleanNote(r.note) }); }
  async vote(id, kind) { return this.rpc('gh_vote', { p_token: this.tok(), p_id: id, p_kind: kind }); }
  async leaderboard(scope = 'global') {
    const r = await this.rpc('gh_leaderboard', { p_token: this.tok(), p_scope: scope });
    r.rows = (r.rows || []).map(x => ({ ...x, avatar: avatarFor(x.id) }));
    return r;
  }
  async history() { return this.rpc('gh_history', { p_token: this.tok() }); }
  async crowd() { return this.rpc('gh_crowd', {}); }
  async feedback(f) { return this.rpc('gh_feedback', { p_token: this.tok(), p_kind: f.kind, p_text: f.text, p_mood: f.mood || null, p_ctx: f.ctx || {}, p_audio: f.audio || null, p_mime: f.mime || null }); }
  async deleteMe() { await this.rpc('gh_delete_me', { p_token: this.tok() }); localStorage.removeItem(ME); }
  async admin(action, a = {}) {
    const { pin, ...rest } = a;
    return this.rpc('gh_admin', { p_key: String(pin), p_action: action, p_args: rest });
  }
}

export const backend = CONFIG.backend === 'supabase' && CONFIG.supabase.url ? new SupabaseBackend() : new LocalBackend();
