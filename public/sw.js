const CACHE_NAME = 'ecotransport-shell-v3';
const APP_SHELL = [
  './',
  './manifest.webmanifest',
  './icons/eco-transport-logo.jpeg',
  './icons/eco-transport-icon-192.png',
  './icons/eco-transport-icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' || url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/index.html')) {
    event.respondWith(fetch(request).catch(() => caches.match('./')));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        const cacheable = url.origin === self.location.origin && !url.pathname.includes('/models/');
        if (cacheable) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./')))
  );
});
