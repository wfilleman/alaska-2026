// alaska-2026 service worker
const CACHE = 'alaska-2026-v1778468227886';
const ASSETS = ['./', 'index.html', 'manifest.json', 'icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(ASSETS).catch(() => Promise.resolve())
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Cache the HTML response so subsequent offline visits work
          if (response && response.ok && event.request.url.endsWith('.html')) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          // Network failed; fall back to root cached HTML if request was for HTML
          if (event.request.mode === 'navigate' || event.request.destination === 'document') {
            return caches.match('index.html');
          }
          throw new Error('Network failed and no cached response');
        });
    })
  );
});
