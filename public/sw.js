const CACHE_NAME = 'ecotransport-shell-v4-disabled';
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
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  return;
});
