// formfit service worker: precache everything once, serve cache-first, work offline.
// Bump VERSION whenever any file in site/ changes so old caches are dropped.
const VERSION = 'formfit-v7';

// Every file in site/ (the node test checks this list against the folder).
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'presets.js',
  'manifest.webmanifest',
  'js/editor.js',
  'js/enhance.js',
  'js/geometry.js',
  'js/i18n.js',
  'js/icons.js',
  'js/jpeg.js',
  'js/png.js',
  'js/render.js',
  'js/search.js',
  'js/units.js',
  'js/validate.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

const scopeURL = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(ASSETS.map((a) => new Request(scopeURL(a), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('formfit-') && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') {
        const fallback = await cache.match(scopeURL('index.html'));
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
