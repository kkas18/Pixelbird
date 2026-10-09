/* Pixelfugl service worker – cache-first for appens egne filer (inkludert den
   selvhostede fonten). Bump VERSION ved hver utgivelse. */
const VERSION = 'pixelfugl-v3.2.0';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './fonts/fredoka-latin.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        // klon før svaret leveres – ellers kan kroppen allerede være lest når cachen skrives
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
