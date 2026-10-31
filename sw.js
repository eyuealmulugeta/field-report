// Keeps Field Report working without signal: every file the app loads is kept, the network is tried first
// (so a new upload is picked up at once) and the kept copy is used when there is no connection.
// The PDF library from cdnjs is kept too. Google sign-in, the script and OneSignal always go to the network.

const CACHE = 'fr2-v15';   // 2.0.0: at the main address (Field Report 1 lives on at /v1/ with its own afr- cache)
const SHELL = ['./', 'index.html', 'css/app.css', 'js/main.js', 'manifest.webmanifest', 'icon-192.png'];
const KEEP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('fr2-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.href.startsWith(KEEP_CDN)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
    return;
  }
  // the old app at /v1/ has its own worker and cache
  if (url.origin !== location.origin || url.pathname.includes('/push/') || url.pathname.includes('/v1/')) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});

// the 17:00 reminder opens the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => (list[0] ? list[0].focus() : self.clients.openWindow('./'))));
});
