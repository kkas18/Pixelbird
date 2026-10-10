/* Pixelfugl service worker – cache-first for appens egne filer. Alt (skrift, figurer og lyd) lages i koden,
   så skriptene og ikonene er alt som trengs uten nett. Bump VERSION ved hver utgivelse. */
const VERSION = 'pixelfugl-v11.0.0';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/config.js',
  './js/pixel.js',
  './js/sound.js',
  './js/game.js',
  './js/render.js',
  './js/ui.js',
  './js/main.js',
  './icons/arkade-192.png',
  './icons/arkade-512.png',
  './icons/arkade-maskable-512.png',
  './icons/arkade-apple-touch.png',
  './icons/arkade-favicon-48.png'
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
