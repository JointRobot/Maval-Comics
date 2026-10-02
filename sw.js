// GYANU HUNT · service worker. Cache the shell so a second visit opens instantly,
// even when the event network is jammed. API calls always go to the network.
const V = 'gh-v39';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/config.js', 'js/copy.js', 'js/rules.js', 'js/backend.js',
  'js/roaches.js', 'js/sfx.js', 'js/tour.js', 'js/feedback.js', 'js/verify.js', 'js/iso.js', 'js/sensors.js', 'js/share.js', 'img/gyanu.svg', 'img/icon-v2-192.png', 'manifest.json'];

self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.includes('/rest/v1/') || u.pathname.includes('/auth/v1/')) return;
  if (u.origin === location.origin || u.host.endsWith('gstatic.com') || u.host.endsWith('googleapis.com')) {
    // network-first: always the newest version when online, cache only when the network is slow or gone
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request, { cache: 'no-store' }).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; });
      if (!hit) return net;
      return Promise.race([net, new Promise((_, rej) => setTimeout(rej, 4000))]).catch(() => hit);
    }));
  }
});
