// GYANU HUNT · the isometric event ground, in plain Canvas 2D (~0 KB of libraries).
// Follows the isokit conventions: plan metres with x east, y south, z up; the camera looks
// along (1,1,1) so the screen's top corner is the plan's north-west; faces pointing south (+y)
// or east (+x) face the viewer; hero zone (Main Stage) sits bottom/south-east; skyline at the back.
// People only ever walk on path centre-lines or sit/stand in clear plots, so nobody stands inside
// anything. Statics are pre-rendered into sprites once per zoom level; each frame draws sprites +
// people depth-sorted, so a budget phone only pays for drawImage calls and ~120 tiny figures.

import { ZONES, MAP, SCENE_CATS } from './config.js';

const C = Math.cos(Math.PI / 6);
const INK = '#15131A';
const COL = {
  ground: '#D8B98C', ground2: '#C9A676', path: '#F1E4C6', lawn: '#7FAE58', lawn2: '#6D9A4A',
  sea: '#2C8AA6', sea2: '#57B3C9', sky1: '#5A4A7E', sky2: '#7B5E96', win: '#FFD45E',
  yellow: '#FFD400', pink: '#FF2E88', teal: '#00A99D', red: '#E8262B', maroon: '#7A1F2B',
  cream: '#F6EEDD', orange: '#FF8A1F', blue: '#2B59C3', purple: '#6B3FA0', dark: '#2A2633', wood: '#9A6A3E'
};
const OUTFITS = ['#FF2E88', '#FFD400', '#00A99D', '#E8262B', '#2B59C3', '#F6EEDD', '#FF8A1F', '#6B3FA0', '#1E1E1E', '#7FAE58'];
const SKINS = ['#8D5A3B', '#A86B45', '#C68A5E', '#6E4229', '#B97C55'];

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(20261002);

// ---------------------------------------------------------------- drawing kit
function kit(ctx, S, ox, oy) {
  const lw = Math.max(1, S * 0.11);
  const P = (x, y, z = 0) => [ox + (x - y) * C * S, oy + (x + y) * 0.5 * S - z * S];
  const path = pts => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
  const poly = (pts3, fill, ink = true, w = lw) => {
    path(pts3.map(p => P(...p)));
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (ink) { ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); }
  };
  const flat = (x, y, w, h, fill, z = 0, ink = false) => poly([[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]], fill, ink);
  const box = (x, y, w, h, z0, ht, col, o = {}) => {
    const z1 = z0 + ht;
    poly([[x, y + h, z0], [x + w, y + h, z0], [x + w, y + h, z1], [x, y + h, z1]], o.south || col);             // south face
    poly([[x + w, y, z0], [x + w, y + h, z0], [x + w, y + h, z1], [x + w, y, z1]], o.east || shade(col, -0.22)); // east face
    poly([[x, y, z1], [x + w, y, z1], [x + w, y + h, z1], [x, y + h, z1]], o.top || shade(col, 0.18));            // top
  };
  // Gable roof with stripes, ridge running along x (axis 'x') or y.
  const roof = (x, y, w, h, z0, ht, cA, cB, axis = 'x', n = 6) => {
    const z1 = z0 + ht;
    if (axis === 'x') {
      const ym = y + h / 2;
      for (let i = 0; i < n; i++) { // south slope, striped
        const a = x + (w * i) / n, b = x + (w * (i + 1)) / n;
        poly([[a, y + h, z0], [b, y + h, z0], [b, ym, z1], [a, ym, z1]], i % 2 ? cB : cA, false);
      }
      poly([[x, y + h, z0], [x + w, y + h, z0], [x + w, ym, z1], [x, ym, z1]], null);
      poly([[x + w, y, z0], [x + w, y + h, z0], [x + w, ym, z1]], shade(cA, -0.25)); // east gable
    } else {
      const xm = x + w / 2;
      for (let i = 0; i < n; i++) { // east slope, striped
        const a = y + (h * i) / n, b = y + (h * (i + 1)) / n;
        poly([[x + w, a, z0], [x + w, b, z0], [xm, b, z1], [xm, a, z1]], i % 2 ? shade(cB, -0.15) : shade(cA, -0.15), false);
      }
      poly([[x + w, y, z0], [x + w, y + h, z0], [xm, y + h, z1], [xm, y, z1]], null);
      poly([[x, y + h, z0], [x + w, y + h, z0], [xm, y + h, z1]], cA); // south gable
    }
  };
  const cyl = (x, y, r, z0, ht, col) => {
    const [cx, cyb] = P(x, y, z0), [, cyt] = P(x, y, z0 + ht);
    const rx = r * S * C * 1.414 * 0.82, ry = rx * 0.58;
    ctx.beginPath(); ctx.ellipse(cx, cyb, rx, ry, 0, 0, Math.PI); ctx.lineTo(cx - rx, cyt); ctx.ellipse(cx, cyt, rx, ry, 0, Math.PI, 0, true); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cyt, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = shade(col, 0.2); ctx.fill(); ctx.stroke();
  };
  const tree = (x, y, r, ht, col = COL.lawn) => {
    cyl(x, y, r * 0.16, 0, ht * 0.55, COL.wood);
    const [cx, cy] = P(x, y, ht * 0.75);
    const R = r * S * 1.05;
    const blob = (dx, dy, rr, c) => { ctx.beginPath(); ctx.arc(cx + dx * R, cy + dy * R, rr * R, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); };
    blob(-0.35, 0.12, 0.62, shade(col, -0.18)); blob(0.38, 0.1, 0.6, shade(col, -0.3)); blob(0, -0.18, 0.7, col);
    ctx.fillStyle = shade(col, 0.25);
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx + (rnd() - 0.6) * R, cy + (rnd() - 0.7) * R * 0.8, R * 0.09, 0, 7); ctx.fill(); }
  };
  // Draw onto a face plane: south face (fixed y, u along x, v up) or east face (fixed x, u along y).
  const onFace = (face, x, y, z, fn) => {
    ctx.save();
    const [px, py] = P(x, y, z);
    if (face === 'south') ctx.transform(C * S, 0.5 * S, 0, -S, px, py);
    else ctx.transform(C * S, -0.5 * S, 0, -S, px, py); // east face: u runs north (−y), so pass the face's south end
    fn(ctx); ctx.restore();
  };
  return { ctx, S, P, poly, flat, box, roof, cyl, tree, onFace, lw, path };
}

// ---------------------------------------------------------------- the site
// Paths (flat), walk loops (centre-lines), structures (sprites).
const PATHS = [
  [2, 14.5, 40.5, 2], [13.5, 2, 2, 40], [25.5, 15, 2, 27], [14, 26.5, 28, 1.6],
  [0, 33, 15, 2], [19.2, 16.5, 1.6, 19.5], [40.2, 15, 1.8, 13]
];
const LOOPS = [
  { pts: [[14.5, 15.5], [26.5, 15.5], [26.5, 27.3], [14.5, 27.3]], loop: true, n: 8 },
  { pts: [[14.5, 15.5], [41.1, 15.5], [41.1, 27.3], [26.5, 27.3], [26.5, 15.5]], loop: true, n: 9 },
  { pts: [[1.5, 34], [14.5, 34], [14.5, 15.5], [14.5, 3]], n: 7 },
  { pts: [[20, 15.5], [20, 35.5]], n: 8 },
  { pts: [[26.5, 27.3], [26.5, 41.5]], n: 5 },
  { pts: [[2.5, 15.5], [14.5, 15.5]], n: 3 }
];

function structures() {
  const L = [];
  const add = (x0, y0, x1, y1, zTop, draw, dx = 0, dy = 0) => L.push({ bb: [x0, y0, x1, y1, zTop], depth: (x0 + x1) / 2 + (y0 + y1) / 2 + dx + dy, draw });

  // perimeter fences: back (north/west) are cheap boxes, front ones (south/east) are low
  add(0, 0, 44, 0.3, 1.2, g => g.box(0, 0, 44, 0.3, 0, 1.2, COL.cream), -40, -40);
  add(0, 0, 0.3, 31.5, 1.2, g => g.box(0, 0.3, 0.3, 31.2, 0, 1.2, COL.cream), -40, 0);
  add(0, 36.5, 0.3, 44, 1.2, g => g.box(0, 36.5, 0.3, 7.5, 0, 1.2, COL.cream));
  add(0, 43.7, 44, 44, 0.7, g => { g.box(0.3, 43.7, 43.7, 0.3, 0, 0.7, COL.cream); }, 30, 30);
  add(43.7, 0, 44, 43.7, 0.7, g => { g.box(43.7, 0.3, 0.3, 43.4, 0, 0.7, COL.cream); }, 30, 30);

  // GATE: arch with marquee + info booth + water tent
  add(2, 31, 3, 37.2, 6.2, g => {
    g.box(2, 31, 1, 1, 0, 4.6, COL.pink); g.box(2, 36, 1, 1, 0, 4.6, COL.pink);
    g.box(2, 30.6, 1, 6.8, 4.6, 1.5, COL.yellow);
    g.onFace('east', 3, 37.4, 4.6, c => { c.fillStyle = INK; c.font = 'bold 1.05px Bungee, Impact, sans-serif'; c.save(); c.scale(1, -1); c.fillText('ENTRY', 1.6, -0.35); c.restore(); });
  });
  add(7, 30.5, 9.4, 32.6, 3.2, g => { g.box(7, 30.6, 2.4, 1.9, 0, 2.3, COL.teal); g.roof(6.8, 30.4, 2.8, 2.3, 2.3, 0.9, COL.yellow, COL.cream, 'x', 4); });
  add(6.5, 35.6, 10, 38, 2.6, g => { g.roof(6.5, 35.6, 3.5, 2.4, 0, 2.6, COL.blue, COL.cream, 'x', 6); });

  // CHAI CORNER: stall, kettle, stools, sign
  add(5, 5, 9.6, 8.6, 4, g => {
    g.box(5, 5, 4.5, 3, 0, 2.2, COL.maroon);
    g.onFace('south', 5.3, 8, 1.5, c => { c.fillStyle = COL.yellow; c.font = 'bold 0.85px Bungee, Impact, sans-serif'; c.save(); c.scale(1, -1); c.fillText('CUTTING ₹10', 0, 0); c.restore(); });
    g.roof(4.8, 4.8, 4.9, 3.8, 2.2, 1.2, COL.red, COL.cream, 'x', 8);
    g.cyl(8.6, 9.0, 0.45, 0, 0.9, '#B8B8B8');
  });
  for (const [sx, sy] of [[6, 10.5], [8, 10.5], [10, 10.5], [10.5, 7]]) add(sx, sy, sx + 0.6, sy + 0.6, 0.5, g => g.box(sx, sy, 0.6, 0.6, 0, 0.45, COL.red));

  // BANYAN LAWN: the big banyan + aerial roots
  add(19.5, 6, 25.5, 11, 8, g => {
    const [a, b] = [g.P(20.5, 8.2, 3.6), g.P(20.5, 8.2, 0)], [c, d] = [g.P(24.6, 8.6, 3.4), g.P(24.6, 8.6, 0)];
    g.ctx.strokeStyle = COL.wood; g.ctx.lineWidth = g.lw * 1.2;
    for (const [p, q] of [[a, b], [c, d]]) { g.ctx.beginPath(); g.ctx.moveTo(...p); g.ctx.lineTo(...q); g.ctx.stroke(); }
    g.tree(22.5, 8.5, 4.4, 7.4, '#5E9A3E');
  });

  // ART WALL: L-shaped wall with mural
  add(32.5, 4.2, 39.5, 12.5, 3.4, g => {
    g.box(34, 4.2, 5.5, 0.8, 0, 2.8, COL.cream);
    g.onFace('south', 34, 5, 0, c => {
      const cols = [COL.pink, COL.yellow, COL.teal, COL.orange, COL.blue];
      for (let i = 0; i < 9; i++) { c.fillStyle = cols[i % 5]; c.beginPath(); c.arc(0.4 + i * 0.6, 0.6 + (i % 3) * 0.7, 0.45 + (i % 2) * 0.2, 0, 7); c.fill(); }
      c.strokeStyle = INK; c.lineWidth = 0.12; c.strokeRect(0.1, 0.1, 5.3, 2.6);
    });
    g.box(32.5, 4.2, 0.8, 8.3, 0, 3.2, COL.cream);
    g.onFace('east', 33.3, 12.5, 0, c => {
      const cols = [COL.purple, COL.pink, COL.yellow, COL.teal];
      for (let i = 0; i < 4; i++) { c.fillStyle = cols[i]; c.fillRect(0.2 + i * 2, 0.3, 1.8, 2.6); }
      c.fillStyle = INK; c.font = 'bold 0.9px Bungee, Impact, sans-serif'; c.save(); c.scale(1, -1); c.fillText('CHALO', 1.2, -1.75); c.fillText('KUCH KARO', 0.6, -0.65); c.restore();
    });
  });
  for (const [px, py, cc] of [[35, 7.4, COL.pink], [36.2, 8.3, COL.teal], [37.6, 7.1, COL.yellow]]) add(px, py, px + 0.5, py + 0.5, 0.6, g => g.cyl(px, py, 0.28, 0, 0.55, cc));

  // FOOD GALI: two rows of stalls with striped awnings over a lane
  const segs = [[18.4, 3], [21.9, 3.6], [28.6, 3], [32.1, 3.6]];
  const awn = [[COL.red, COL.cream], [COL.teal, COL.cream], [COL.yellow, COL.red], [COL.pink, COL.cream]];
  segs.forEach(([y, h], i) => {
    const [a1, a2] = awn[i % 4], [b1, b2] = awn[(i + 2) % 4];
    add(16.2, y, 18.9, y + h, 2.5, g => { g.box(16.2, y, 2, h, 0, 2.0, COL.orange); g.box(16.2, y, 2.7, h, 2.0, 0.28, a1, { top: a1, south: a2, east: shade(a1, -0.2) }); });
    add(21.1, y, 23.8, y + h, 2.5, g => { g.box(21.8, y, 2, h, 0, 2.0, COL.purple); g.box(21.1, y, 2.7, h, 2.0, 0.28, b1, { top: b1, south: b2, east: shade(b1, -0.2) }); });
  });

  // GAMES ALLEY: ring-toss booth (the giant wheel is animated, drawn live)
  add(30.6, 23, 34, 25.4, 3, g => { g.box(31, 23.2, 2.8, 2, 0, 1.8, COL.blue); g.roof(30.8, 23, 3.2, 2.4, 1.8, 1, COL.yellow, COL.blue, 'x', 6); });
  add(37.4, 22.2, 39.2, 24, 2, g => { g.box(37.6, 22.4, 1.4, 1.4, 0, 1.6, COL.pink); });

  // MAIN STAGE: platform, LED wall, truss, speaker stacks, crowd barrier
  add(30, 30, 41, 35, 8, g => {
    g.box(30, 30, 11, 5, 0, 1.3, COL.dark);
    g.box(30.6, 30.1, 9.8, 0.5, 1.3, 5.2, '#18151E', { south: '#100D16' });
    g.onFace('south', 30.9, 30.6, 1.7, c => {
      c.fillStyle = COL.yellow; c.font = 'bold 1.4px Bungee, Impact, sans-serif'; c.save(); c.scale(1, -1);
      c.fillText('GYANU', 1.1, -2.6); c.fillStyle = COL.pink; c.fillText('HUNT', 4.9, -1.0); c.restore();
    });
    for (const px of [30.1, 40.5]) g.box(px, 30.1, 0.4, 0.4, 1.3, 6.2, '#9AA0A8');
    g.box(30.1, 30.1, 10.8, 0.4, 7.5, 0.4, '#9AA0A8');
    g.box(30.3, 33.4, 1.3, 1.3, 1.3, 2.4, '#222'); g.box(39.4, 33.4, 1.3, 1.3, 1.3, 2.4, '#222');
  });
  add(30, 35.6, 41, 35.9, 1, g => {
    g.box(30, 35.6, 11, 0.25, 0, 0.95, COL.yellow);
    g.onFace('south', 30, 35.85, 0, c => { c.fillStyle = INK; for (let i = 0; i < 11; i++) { c.beginPath(); c.moveTo(i + 0.1, 0.05); c.lineTo(i + 0.5, 0.05); c.lineTo(i + 0.9, 0.9); c.lineTo(i + 0.5, 0.9); c.fill(); } });
  });

  // trees
  for (const [tx, ty, r] of [[2.5, 2.5, 1.6], [42, 2.5, 1.5], [2.5, 25, 1.7], [11, 22, 1.5], [30, 9.5, 1.4], [11, 41, 1.6], [42.2, 41.8, 1.3], [8, 18.5, 1.3]]) {
    add(tx - r, ty - r, tx + r, ty + r, r * 3.4, g => g.tree(tx, ty, r, r * 3.2));
  }
  return L;
}

// ---------------------------------------------------------------- people
function makeCrowd() {
  const people = [];
  const pick = a => a[Math.floor(rnd() * a.length)];
  for (const L of LOOPS) {
    const pts = L.loop ? [...L.pts, L.pts[0]] : L.pts;
    const segs = []; let len = 0;
    for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push([pts[i], pts[i + 1], len, d]); len += d; }
    for (let k = 0; k < L.n; k++) {
      people.push({ kind: 'walk', segs, len, loop: !!L.loop, s0: rnd() * len * (L.loop ? 1 : 2), v: 0.8 + rnd() * 0.6, off: (rnd() - 0.5) * 1.1, col: pick(OUTFITS), skin: pick(SKINS), sign: rnd() < 0.22, ph: rnd() * 6 });
    }
  }
  // audience in front of the stage, behind the barrier
  for (let i = 0; i < 40; i++) {
    const x = 30.8 + (i % 10) * 0.98 + (rnd() - 0.5) * 0.35, y = 36.6 + Math.floor(i / 10) * 1.05 + (rnd() - 0.5) * 0.3;
    people.push({ kind: 'stand', x, y, col: pick(OUTFITS), skin: pick(SKINS), sign: rnd() < 0.3, ph: rnd() * 6, dance: true });
  }
  // chai sippers + lawn sitters + art-wall crowd
  for (const [x, y] of [[6.3, 10.2], [8.3, 10.2], [10.3, 10.2], [10.8, 6.6]]) people.push({ kind: 'sit', x: x + 0.5, y: y + 0.9, col: pick(OUTFITS), skin: pick(SKINS), ph: rnd() * 6 });
  for (const [x, y] of [[18, 12], [19.2, 12.6], [26.5, 11.8], [27.3, 6], [26.6, 5], [18.4, 5.4], [24.5, 12.6]]) people.push({ kind: 'sit', x, y, col: pick(OUTFITS), skin: pick(SKINS), ph: rnd() * 6 });
  for (const [x, y] of [[36, 11], [37.4, 10.3], [38.8, 11.6], [34.8, 9.6]]) people.push({ kind: 'stand', x, y, col: pick(OUTFITS), skin: pick(SKINS), sign: rnd() < 0.5, ph: rnd() * 6 });
  for (const [x, y] of [[33, 20.4], [37.3, 25.2], [32, 25.6], [9, 31.6], [5, 35]]) people.push({ kind: 'stand', x, y, col: pick(OUTFITS), skin: pick(SKINS), sign: false, ph: rnd() * 6 });
  return people;
}

function walkPos(p, t) {
  let s = p.s0 + t * p.v;
  if (p.loop) s %= p.len; else { s %= p.len * 2; if (s > p.len) s = p.len * 2 - s; }
  for (const [a, b, l0, d] of p.segs) if (s <= l0 + d || d === 0) {
    const k = d ? (s - l0) / d : 0, nx = -(b[1] - a[1]) / (d || 1), ny = (b[0] - a[0]) / (d || 1);
    return [a[0] + (b[0] - a[0]) * k + nx * p.off, a[1] + (b[1] - a[1]) * k + ny * p.off];
  }
  const b = p.segs[p.segs.length - 1][1]; return [b[0], b[1]];
}

function drawPerson(ctx, P, S, x, y, p, t, show) {
  const bob = p.kind === 'walk' ? Math.abs(Math.sin(t * 7 + p.ph)) * 0.08 : p.dance && show ? Math.abs(Math.sin(t * 6 + p.ph)) * 0.22 : 0;
  const sit = p.kind === 'sit';
  const [gx, gy] = P(x, y, 0);
  const u = S;
  ctx.fillStyle = 'rgba(21,19,26,.28)';
  ctx.beginPath(); ctx.ellipse(gx, gy, 0.36 * u, 0.2 * u, 0, 0, 7); ctx.fill();
  const lw = Math.max(0.8, u * 0.09);
  const legs = sit ? 0.25 : 0.75, torso = 0.62, w = 0.48 * u;
  const by = gy - (legs + bob) * u;
  ctx.lineWidth = lw; ctx.strokeStyle = INK;
  if (!sit) { ctx.fillStyle = '#2A2633'; ctx.fillRect(gx - w * 0.35, by, w * 0.7, (legs + bob) * u); }
  ctx.fillStyle = p.col;
  ctx.beginPath(); ctx.roundRect(gx - w / 2, by - torso * u, w, torso * u, w * 0.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(gx, by - torso * u - 0.2 * u, 0.21 * u, 0, 7); ctx.fill(); ctx.stroke();
  if (p.sign) {
    const sx = gx + w * 0.55, top = by - torso * u - 0.95 * u - (show ? Math.abs(Math.sin(t * 3 + p.ph)) * 0.25 * u : 0);
    ctx.beginPath(); ctx.moveTo(sx, by - torso * u * 0.4); ctx.lineTo(sx, top + 0.3 * u); ctx.stroke();
    ctx.fillStyle = '#FFF8E8'; ctx.fillRect(sx - 0.42 * u, top - 0.1 * u, 0.84 * u, 0.5 * u); ctx.strokeRect(sx - 0.42 * u, top - 0.1 * u, 0.84 * u, 0.5 * u);
    ctx.fillStyle = COL.pink; ctx.fillRect(sx - 0.3 * u, top + 0.02 * u, 0.6 * u, 0.08 * u); ctx.fillRect(sx - 0.3 * u, top + 0.18 * u, 0.42 * u, 0.08 * u);
  }
}

// ---------------------------------------------------------------- the map
export class IsoMap {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.opts = opts;
    this.items = structures();
    this.people = makeCrowd();
    this.hunts = []; this.zones = {}; this.pops = []; this.scene = []; this.mood = 'evening'; this.selected = null;
    this.k = 1; this.cx = 22; this.cy = 21;
    this.gyanuImg = new Image(); this.gyanuImg.src = opts.gyanuSrc || 'img/gyanu.svg';
    this.gyanuImg.onload = () => this.draw(performance.now());
    this.roachImg = null;
    this.running = false; this.last = 0;
    this.resize(); this.bindInput();
    new ResizeObserver(() => this.resize()).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.running) this.loop(); });
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    if (!r.width) return;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.W = r.width; this.H = r.height;
    this.cv.width = Math.round(r.width * this.dpr); this.cv.height = Math.round(r.height * this.dpr);
    this.padB = this.opts.padBottom?.() || 0;      // room the bottom sheet covers
    const h = Math.max(160, this.H - this.padB);
    this.S0 = Math.min(this.W * 0.97 / ((MAP.w + MAP.h) * C), h * 0.92 / (MAP.h + 12));
    this.rebuild();
  }
  get S() { return this.S0 * this.k; }
  origin() { // screen position of plan (0,0,0) for the current view centre
    const S = this.S;
    return [this.W / 2 - (this.cx - this.cy) * C * S, (this.H - this.padB) / 2 + 4 * S - (this.cx + this.cy) * 0.5 * S];
  }
  P(x, y, z = 0) { const [ox, oy] = this.origin(), S = this.S; return [ox + (x - y) * C * S, oy + (x + y) * 0.5 * S - z * S]; }
  toPlan(sx, sy) { const [ox, oy] = this.origin(), S = this.S; const a = (sx - ox) / (C * S), b = (sy - oy) / (0.5 * S); return [(a + b) / 2, (b - a) / 2]; }

  // Pre-render ground + every structure as sprites at the current zoom.
  rebuild() {
    const S = this.S, d = this.dpr;
    // ground: capped at ~4 MP so budget phones never allocate a giant canvas
    const ext = { x0: -14, y0: -16, x1: MAP.w + 2, y1: MAP.h + 2 };
    const corners = [[ext.x0, ext.y0, 30], [ext.x1, ext.y0, 30], [ext.x0, ext.y1, 0], [ext.x1, ext.y1, 0], [ext.x0, ext.y0, 0], [ext.x1, ext.y1, 0]];
    const sp = (x, y, z) => [(x - y) * C, (x + y) * 0.5 - z];
    const xs = corners.map(c => sp(...c)[0]), ys = corners.map(c => sp(...c)[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    let gs = S * d; const area = (maxX - minX) * (maxY - minY) * gs * gs;
    if (area > 4e6) gs *= Math.sqrt(4e6 / area);
    const gc = document.createElement('canvas');
    gc.width = Math.ceil((maxX - minX) * gs); gc.height = Math.ceil((maxY - minY) * gs);
    this.paintGround(kit(gc.getContext('2d'), gs, -minX * gs, -minY * gs));
    this.ground = { c: gc, gs, minX, minY };
    for (const it of this.items) {
      const [x0, y0, x1, y1, zt] = it.bb, m = 1.2;
      const pts = [[x0 - m, y0 - m, 0], [x1 + m, y0 - m, 0], [x0 - m, y1 + m, 0], [x1 + m, y1 + m, 0], [x0 - m, y0 - m, zt + m], [x1 + m, y0 - m, zt + m], [x0 - m, y1 + m, zt + m], [x1 + m, y1 + m, zt + m]].map(p => sp(...p));
      const ax = Math.min(...pts.map(p => p[0])), bx = Math.max(...pts.map(p => p[0])), ay = Math.min(...pts.map(p => p[1])), by = Math.max(...pts.map(p => p[1]));
      const c = document.createElement('canvas');
      const s = S * d;
      c.width = Math.max(1, Math.ceil((bx - ax) * s)); c.height = Math.max(1, Math.ceil((by - ay) * s));
      it.draw(kit(c.getContext('2d'), s, -ax * s, -ay * s));
      it.sprite = { c, ax, ay, S };
    }
    this.draw(performance.now());
  }

  paintGround(g) {
    const { ctx } = g;
    // sea (west) with waves — Marine Drive energy
    g.flat(-14, -16, 13.5, MAP.h + 18, COL.sea);
    ctx.strokeStyle = COL.sea2; ctx.lineWidth = Math.max(1, g.S * 0.12);
    for (let i = 0; i < 22; i++) { const x = -12 + (i % 5) * 2.4, y = -12 + i * 2.6; const [a, b] = g.P(x, y), [c, d] = g.P(x + 1.2, y + 0.2); ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo((a + c) / 2, b - g.S * 0.4, c, d); ctx.stroke(); }
    // promenade + rail track north
    g.flat(-0.5, -16, MAP.w + 2.5, 15.6, '#B9A58A');
    g.flat(-0.5, -4, MAP.w + 2.5, 2, '#8E8170');
    ctx.strokeStyle = '#5B5146'; ctx.lineWidth = Math.max(1, g.S * 0.1);
    for (const ry of [-3.6, -2.4]) { const [a, b] = g.P(-0.5, ry), [c, d] = g.P(MAP.w + 2, ry); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
    // skyline (back, north): dusk towers with lit windows
    const r2 = (s => () => (s = (s * 48271) % 2147483647) / 2147483647)(7);
    for (let x = -1; x < MAP.w + 1; x += 3.4 + r2() * 1.6) {
      const w = 2.6 + r2() * 2.4, h = 2.4 + r2() * 2, ht = 7 + r2() * 20, y = -14 + r2() * 6;
      g.box(x, y, w, h, 0, ht, r2() < 0.5 ? COL.sky1 : COL.sky2);
      g.onFace('south', x, y + h, 0, c => { c.fillStyle = COL.win; for (let wy = 1; wy < ht - 1; wy += 1.6) for (let wx = 0.4; wx < w - 0.5; wx += 0.9) if (r2() < 0.45) c.fillRect(wx, wy, 0.45, 0.6); });
    }
    // event ground with a halftone dot texture
    g.flat(0, 0, MAP.w, MAP.h, COL.ground, 0, true);
    ctx.fillStyle = COL.ground2;
    for (let i = 0; i < 900; i++) { const [a, b] = g.P(rnd() * MAP.w, rnd() * MAP.h); ctx.fillRect(a, b, Math.max(1, g.S * 0.18), Math.max(1, g.S * 0.12)); }
    // zone plots
    for (const z of ZONES) {
      const tint = z.id === 'banyan' ? COL.lawn : z.id === 'stage' ? '#C2A276' : z.id === 'food' ? '#E4C79A' : '#E0C497';
      g.flat(z.x, z.y, z.w, z.h, tint);
      if (z.id === 'banyan') { ctx.fillStyle = COL.lawn2; for (let i = 0; i < 120; i++) { const [a, b] = g.P(z.x + rnd() * z.w, z.y + rnd() * z.h); ctx.fillRect(a, b, Math.max(1, g.S * 0.1), Math.max(1, g.S * 0.3)); } }
    }
    // durries on the lawn, carrom board in games alley
    g.flat(17.6, 11.4, 2.4, 1.8, COL.pink, 0.02, true); g.flat(25.6, 4.6, 2, 2.4, COL.teal, 0.02, true); g.flat(23.6, 12, 2, 1.4, COL.yellow, 0.02, true);
    g.flat(36.6, 18.4, 2.6, 2.6, '#E9C88A', 0.05, true); g.flat(36.9, 18.7, 2, 2, '#F4DDA8', 0.06, true);
    // paths
    for (const [x, y, w, h] of PATHS) g.flat(x, y, w, h, COL.path);
    // crowd status hatching
    for (const z of ZONES) {
      const st = this.zones[z.id]?.crowd;
      if (st !== 'busy' && st !== 'closed') continue;
      ctx.save(); g.path([g.P(z.x, z.y), g.P(z.x + z.w, z.y), g.P(z.x + z.w, z.y + z.h), g.P(z.x, z.y + z.h)]); ctx.clip();
      ctx.fillStyle = st === 'closed' ? 'rgba(232,38,43,.28)' : 'rgba(255,138,31,.25)'; ctx.fill();
      ctx.strokeStyle = st === 'closed' ? 'rgba(232,38,43,.85)' : 'rgba(255,138,31,.85)'; ctx.lineWidth = g.S * 0.25;
      const [a, b] = g.P(z.x, z.y);
      for (let i = -30; i < 30; i++) { ctx.beginPath(); ctx.moveTo(a + i * g.S * 1.2, b - 40 * g.S); ctx.lineTo(a + i * g.S * 1.2 + 40 * g.S, b + 40 * g.S); ctx.stroke(); }
      ctx.restore();
    }
  }

  setState({ hunts, zones, mood, selected, scene }) {
    if (hunts) this.hunts = hunts;
    if (scene) this.scene = scene;
    if (mood) this.mood = mood;
    if (selected !== undefined) this.selected = selected;
    if (zones && JSON.stringify(zones) !== JSON.stringify(this.zones)) { this.zones = zones; this.rebuild(); }
  }

  start() { if (this.running) return; this.running = true; this.loop(); }
  stop() { this.running = false; }
  loop() {
    if (!this.running || document.hidden) return;
    requestAnimationFrame(ts => {
      if (ts - this.last > 32) { this.last = ts; this.draw(ts); } // ~30 fps is plenty, and kind to batteries
      this.loop();
    });
  }

  draw(ts) {
    if (!this.ground || !this.W) return;
    const t = ts / 1000, ctx = this.ctx, d = this.dpr, S = this.S;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    const [ox, oy] = this.origin();
    // ground (scaled while a zoom gesture is in progress, crisp after rebuild)
    const G = this.ground;
    ctx.drawImage(G.c, ox + G.minX * S, oy + G.minY * S, G.c.width / G.gs * S, G.c.height / G.gs * S);
    const P = (x, y, z = 0) => [ox + (x - y) * C * S, oy + (x + y) * 0.5 * S - z * S];

    this.drawTrain(ctx, P, S, t);

    // depth-sorted: sprites + people + live parts
    const show = true;
    const list = [];
    for (const it of this.items) list.push([it.depth, 0, it]);
    for (const p of this.people) {
      const [x, y] = p.kind === 'walk' ? walkPos(p, t) : [p.x, p.y];
      list.push([x + y + 0.01, 1, p, x, y]);
    }
    list.push([35 + 21, 2, 'wheel']);
    list.sort((a, b) => a[0] - b[0]);
    for (const e of list) {
      if (e[1] === 0) { const sp = e[2].sprite; if (!sp) continue; const k = S / sp.S; ctx.drawImage(sp.c, ox + sp.ax * S, oy + sp.ay * S, sp.c.width / d * k, sp.c.height / d * k); }
      else if (e[1] === 1) drawPerson(ctx, P, S, e[3], e[4], e[2], t, show);
      else this.drawWheel(ctx, P, S, t);
    }

    if (this.mood === 'final') { ctx.fillStyle = 'rgba(30,6,24,.42)'; ctx.fillRect(0, 0, this.W, this.H); }
    this.drawStageFx(ctx, P, S, t);
    this.drawLabels(ctx, P, S);
    if (this.opts.showScene !== false) this.drawScene(ctx, P, S, t);
    if (this.opts.showHunts !== false) this.drawHunts(ctx, P, S, t);
    this.drawPops(ctx, P, S, t);
  }

  drawTrain(ctx, P, S, t) {
    const L = 5.2, cars = 5, span = MAP.w + 30, head = ((t * 6) % span) - 12;
    ctx.lineWidth = Math.max(1, S * 0.1); ctx.strokeStyle = INK;
    for (let i = 0; i < cars; i++) {
      const x0 = head - i * (L + 0.3); if (x0 < -0.5 || x0 + L > MAP.w + 2) continue;
      const y = -3.8, h = 1.6, z = 2.2;
      const q = (pts, f) => { ctx.beginPath(); pts.forEach((p, j) => { const [a, b] = P(...p); j ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.closePath(); ctx.fillStyle = f; ctx.fill(); ctx.stroke(); };
      q([[x0, y + h, 0.3], [x0 + L, y + h, 0.3], [x0 + L, y + h, z], [x0, y + h, z]], '#E9E2D2');
      q([[x0 + L, y, 0.3], [x0 + L, y + h, 0.3], [x0 + L, y + h, z], [x0 + L, y, z]], '#B9B0A0');
      q([[x0, y, z], [x0 + L, y, z], [x0 + L, y + h, z], [x0, y + h, z]], '#9C2F3B');
      ctx.fillStyle = '#7A1F2B';
      q([[x0, y + h, 0.9], [x0 + L, y + h, 0.9], [x0 + L, y + h, 1.25], [x0, y + h, 1.25]], '#7A1F2B');
    }
  }

  drawWheel(ctx, P, S, t) {
    const cx = 35, y = 21, cz = 4.1, r = 3.1, a0 = t * 0.5;
    ctx.lineWidth = Math.max(1, S * 0.12); ctx.strokeStyle = INK;
    const leg = (x0, x1) => { const [a, b] = P(x0, y, 0), [c, d] = P(x1, y, cz); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); };
    leg(33.2, cx); leg(36.8, cx);
    const pt = a => P(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
    ctx.beginPath(); for (let i = 0; i <= 40; i++) { const [a, b] = pt((i / 40) * Math.PI * 2); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); } ctx.strokeStyle = COL.pink; ctx.lineWidth = S * 0.22; ctx.stroke();
    ctx.lineWidth = Math.max(1, S * 0.08); ctx.strokeStyle = INK; const [hx, hy] = P(cx, y, cz);
    for (let i = 0; i < 8; i++) { const [a, b] = pt(a0 + (i / 8) * Math.PI * 2); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(a, b); ctx.stroke(); }
    const cols = [COL.yellow, COL.teal, COL.red, COL.blue];
    for (let i = 0; i < 8; i++) { const [a, b] = pt(a0 + (i / 8) * Math.PI * 2); ctx.fillStyle = cols[i % 4]; ctx.fillRect(a - S * 0.35, b, S * 0.7, S * 0.6); ctx.strokeRect(a - S * 0.35, b, S * 0.7, S * 0.6); }
  }

  drawStageFx(ctx, P, S, t) {
    const final = this.mood === 'final';
    const cols = final ? ['rgba(255,40,60,.22)', 'rgba(255,40,60,.16)'] : ['rgba(255,46,136,.18)', 'rgba(255,212,0,.16)', 'rgba(0,169,157,.16)'];
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const [sx, sy] = P(31.5 + i * 2.6, 30.4, 7.4);
      const sw = Math.sin(t * 1.3 + i * 1.7) * 3.2;
      const [a, b] = P(32 + i * 2.6 + sw - 1, 39.5), [c, d] = P(32 + i * 2.6 + sw + 1.2, 39.5);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(a, b); ctx.lineTo(c, d); ctx.closePath(); ctx.fillStyle = cols[i % cols.length]; ctx.fill();
    }
    // food gali string lights
    for (let i = 0; i < 16; i++) { const [a, b] = P(19.5 + (i % 2), 17 + i * 1.2, 3.2); const on = Math.sin(t * 4 + i) > -0.3; ctx.fillStyle = on ? 'rgba(255,212,94,.95)' : 'rgba(255,212,94,.25)'; ctx.beginPath(); ctx.arc(a, b, Math.max(1.2, S * 0.18), 0, 7); ctx.fill(); }
    ctx.restore();
  }

  // Bright type on a dark box: zone name plates.
  drawLabels(ctx, P, S) {
    const fs = Math.max(8.5, Math.min(13, S * 1.7));
    ctx.font = `${fs}px Bungee, Impact, sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    for (const z of ZONES) {
      const st = this.zones[z.id]?.crowd;
      const [x, y] = P(z.x + z.w / 2, z.y + z.h + 0.4, 0);
      const txt = (S < 6 ? z.short : z.name.toUpperCase()) + (st === 'closed' ? ' · CLOSED' : st === 'busy' ? ' · BUSY' : '');
      const w = ctx.measureText(txt).width + fs;
      ctx.fillStyle = st === 'closed' ? '#B3141A' : st === 'busy' ? '#C25E00' : 'rgba(21,19,26,.86)';
      ctx.beginPath(); ctx.roundRect(x - w / 2, y - fs * 0.75, w, fs * 1.5, 4); ctx.fill();
      ctx.fillStyle = st ? '#fff' : COL.yellow; ctx.fillText(txt, x, y + 1);
    }
  }


  // The Scene: live info chips per zone (emoji in a dark pill, crew pins outlined yellow).
  drawScene(ctx, P, S, t) {
    this.sceneHits = [];
    const by = {};
    for (const r of this.scene) (by[r.zone] ||= []).push(r);
    const fs = Math.max(13, Math.min(20, S * 2.4));
    ctx.font = `${fs * 0.78}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const z of ZONES) {
      const list = by[z.id]; if (!list) continue;
      const cats = [...new Map(list.map(r => [r.cat, r])).values()].slice(0, 4);
      const [x, y] = P(z.x + 1.2, z.y + 1.2, 0.5);
      cats.forEach((r, i) => {
        const cx = x + i * (fs + 3), cy = y - fs * 0.6;
        const urgent = r.cat === 'crowded' || r.cat === 'medic';
        ctx.fillStyle = r.cat === 'crowded' ? '#C25E00' : 'rgba(21,19,26,.9)';
        ctx.strokeStyle = r.official ? '#FFD400' : urgent ? '#fff' : 'rgba(255,255,255,.5)'; ctx.lineWidth = r.official ? 2.5 : 1.5;
        ctx.beginPath(); ctx.roundRect(cx - fs / 2, cy - fs / 2, fs, fs, 5); ctx.fill(); ctx.stroke();
        ctx.fillText(SCENE_CATS.find(c => c.id === r.cat)?.icon || '?', cx, cy + 1);
        this.sceneHits.push({ zone: z.id, x: cx, y: cy, r: fs * 0.7 });
      });
    }
  }

  zoneAnchor(id) { const z = ZONES.find(q => q.id === id); return z ? [z.x + z.w / 2, z.y + z.h / 2] : [22, 22]; }

  drawHunts(ctx, P, S, t) {
    this.huntHits = [];
    for (const h of this.hunts) {
      const [x, y] = this.zoneAnchor(h.zone);
      const col = h.type === 'golden' ? '#FFC21A' : h.type === 'final' ? '#FF2A3D' : COL.pink;
      const [gx, gy] = P(x, y, 0);
      if (!h.found) for (let i = 0; i < 3; i++) { // radar rings on the ground
        const k = ((t * 0.7 + i / 3) % 1), R = (1.2 + k * 6) * S;
        ctx.beginPath(); ctx.ellipse(gx, gy, R * C * 1.15, R * 0.58, 0, 0, 7);
        ctx.strokeStyle = col; ctx.globalAlpha = 1 - k; ctx.lineWidth = Math.max(1.5, S * 0.35); ctx.stroke(); ctx.globalAlpha = 1;
      }
      const lift = 7.5 + Math.sin(t * 2.4 + x) * 0.6;
      const [mx, my] = P(x, y, lift);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(mx, my + 10); ctx.stroke();
      const sz = Math.max(30, S * 5.4) * (this.selected === h.id ? 1.18 : 1);
      ctx.fillStyle = h.found ? '#3BB273' : col; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mx, my, sz * 0.62, 0, 7); ctx.fill(); ctx.stroke();
      if (this.gyanuImg.complete && this.gyanuImg.naturalWidth) ctx.drawImage(this.gyanuImg, mx - sz / 2, my - sz * 0.55, sz, sz * 1.03);
      if (h.found) { ctx.fillStyle = '#fff'; ctx.font = `${sz * 0.42}px Bungee, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('✓', mx + sz * 0.45, my - sz * 0.35); }
      this.huntHits.push({ id: h.id, x: mx, y: my, r: sz * 0.75 });
    }
  }

  // ---------- whack-a-Gyanu pops
  popSpots() { return POP_SPOTS; }
  setPops(p) { this.pops = p; }
  drawPops(ctx, P, S, t) {
    this.popHits = [];
    const now = performance.now();
    for (const p of this.pops) {
      const age = (now - p.born) / p.life; if (age < 0 || age > 1) continue;
      const pop = age < 0.15 ? age / 0.15 : age > 0.85 ? (1 - age) / 0.15 : 1;
      const [x, y] = P(p.x, p.y, p.z + 1.2);
      const sz = Math.max(40, S * 6.2) * (0.3 + 0.7 * Math.min(1, pop)) * (p.hit ? 1.25 : 1);
      ctx.globalAlpha = p.hit ? Math.max(0, 1 - (now - p.hitAt) / 300) : 1;
      ctx.fillStyle = p.kind === 'gold' ? '#FFC21A' : p.kind === 'roach' ? '#5B3A1E' : '#FFF4D6';
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y - sz * 0.05, sz * 0.6, 0, 7); ctx.fill(); ctx.stroke();
      if (p.kind === 'roach') drawRoach(ctx, x, y, sz * 0.9);
      else if (this.gyanuImg.naturalWidth) ctx.drawImage(this.gyanuImg, x - sz / 2, y - sz * 0.6, sz, sz * 1.03);
      ctx.globalAlpha = 1;
      if (!p.hit) this.popHits.push({ p, x, y, r: sz * 0.72 });
    }
  }

  // ---------- input: tap, drag-pan, pinch/wheel zoom
  bindInput() {
    const cv = this.cv, pts = new Map();
    let start = null, moved = false, pinch0 = null, rebuildT = 0;
    const scheduleRebuild = () => { clearTimeout(rebuildT); rebuildT = setTimeout(() => this.rebuild(), 160); };
    const clamp = () => { this.k = Math.max(1, Math.min(3.2, this.k)); this.cx = Math.max(4, Math.min(40, this.cx)); this.cy = Math.max(2, Math.min(42, this.cy)); };
    const zoomAt = (sx, sy, f) => {
      const [px, py] = this.toPlan(sx, sy);
      this.k *= f; clamp();
      const [qx, qy] = this.toPlan(sx, sy);
      this.cx += px - qx; this.cy += py - qy; clamp(); scheduleRebuild(); this.draw(performance.now());
    };
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.offsetX, e.offsetY]); start = [e.offsetX, e.offsetY, this.cx, this.cy]; moved = false; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = [Math.hypot(a[0] - b[0], a[1] - b[1]), this.k]; } });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (pts.size === 2 && pinch0) {
        const [a, b] = [...pts.values()]; const dd = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (pinch0[1] * dd / pinch0[0]) / this.k); moved = true; return;
      }
      if (this.k <= 1.01 || !start) return;
      const dx = e.offsetX - start[0], dy = e.offsetY - start[1];
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (!moved) return;
      const S = this.S, a = -dx / (C * S), b = -dy / (0.5 * S);
      this.cx = start[2] + (a + b) / 2; this.cy = start[3] + (b - a) / 2; clamp(); this.draw(performance.now());
    });
    const up = e => {
      const was = pts.has(e.pointerId); pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null;
      if (was && !moved && e.type === 'pointerup') this.tap(e.offsetX, e.offsetY);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    cv.addEventListener('dblclick', e => zoomAt(e.offsetX, e.offsetY, this.k > 2 ? 1 / this.k : 1.8));
  }
  tap(sx, sy) {
    for (const h of this.popHits || []) if (Math.hypot(sx - h.x, sy - h.y) < h.r) return this.opts.onPop?.(h.p);
    if (this.opts.onPopMiss && this.pops.length) this.opts.onPopMiss();
    for (const h of this.huntHits || []) if (Math.hypot(sx - h.x, sy - h.y) < h.r) return this.opts.onHunt?.(h.id);
    for (const h of this.sceneHits || []) if (Math.hypot(sx - h.x, sy - h.y) < h.r) return this.opts.onZone?.(h.zone, 'scene');
    const [x, y] = this.toPlan(sx, sy);
    const z = ZONES.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
    if (z) this.opts.onZone?.(z.id);
  }
  refit() { const p = this.opts.padBottom?.() || 0; if (Math.abs(p - (this.padB || 0)) > 40) this.resize(); } // skip tiny sheet changes: a rebuild costs ~30 ms on budget phones
  zoomBy(f) { this.k = Math.max(1, Math.min(3.2, this.k * f)); this.rebuild(); }
}

function drawRoach(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y - s * 0.05); ctx.rotate(-0.5);
  ctx.strokeStyle = '#2A1708'; ctx.lineWidth = Math.max(1.5, s * 0.04);
  for (const k of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(k * s * 0.08, -s * 0.05 + i * s * 0.1); ctx.lineTo(k * s * 0.3, -s * 0.12 + i * s * 0.16); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-s * 0.04, -s * 0.28); ctx.quadraticCurveTo(-s * 0.2, -s * 0.5, -s * 0.3, -s * 0.48); ctx.moveTo(s * 0.04, -s * 0.28); ctx.quadraticCurveTo(s * 0.2, -s * 0.5, s * 0.3, -s * 0.48); ctx.stroke();
  ctx.fillStyle = '#8B4A1C'; ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.15, s * 0.3, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5B2E10'; ctx.beginPath(); ctx.ellipse(0, -s * 0.24, s * 0.1, s * 0.08, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-s * 0.04, -s * 0.25, s * 0.03, 0, 7); ctx.arc(s * 0.04, -s * 0.25, s * 0.03, 0, 7); ctx.fill();
  ctx.restore();
}

// Where Gyanu can pop up in whack mode: behind stalls, on roofs, by the tree, on stage…
const POP_SPOTS = [
  [7, 6.4, 3.6], [11.6, 11.6, 0], [22.5, 8.5, 7.6], [18.6, 12.4, 0], [36.5, 6, 2.8], [33, 8, 3.2],
  [17.2, 20, 2.3], [22.8, 24, 2.3], [17.2, 30, 2.3], [22.8, 33.6, 2.3], [35, 21, 7.2], [32.4, 24.2, 2.8],
  [35.5, 32.5, 1.3], [33, 38.4, 0], [38.4, 38.4, 0], [2.5, 31.5, 6.2], [8.2, 31.5, 3.2], [8.2, 36.8, 2.6],
  [2.5, 25, 5.4], [30, 9.5, 4.6], [11, 41, 5]
];
