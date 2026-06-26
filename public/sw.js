// Service worker for Meditations for Mortals.
// Strategy:
//   - App shell + static content: cache-first (works fully offline).
//   - Netlify function calls (progress sync): never cached (always network).
// Bump CACHE_VERSION whenever the cached asset list or their contents change.

const CACHE_VERSION = 'mfm-v1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './lib.js',
  './data.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET; let POST/PUT (progress sync) hit the network untouched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache serverless function responses (user data must be fresh).
  if (url.pathname.startsWith('/.netlify/functions/')) {
    return; // default: browser handles via network
  }

  // Only manage same-origin requests.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Cache successful, basic (same-origin) responses for next time.
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: serve the app shell for navigations.
          if (request.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});
