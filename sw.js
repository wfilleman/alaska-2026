// alaska-2026 service worker
//
// Strategy:
//   - HTML (navigation): network-first. Always try the network so deploys
//     show up immediately when online. Fall back to cached copy when offline.
//   - Manifest, icon, static assets: cache-first. They rarely change.
//   - On every deploy the CACHE name changes (deploy.sh substitutes the token
//     below), so the new SW installs, old caches get deleted, and clients
//     pick up the fresh content on next launch.

const CACHE = 'alaska-2026-1779472966';
// MP4s are intentionally excluded — the SW fetch handler skips video requests
// (see below) so the browser handles them natively. iOS standalone PWA mode
// has reliability issues with SW-served videos.
const STATIC_ASSETS = ['./', 'index.html', 'manifest.json', 'icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Add each asset individually so one missing file doesn't abort install.
      Promise.all(STATIC_ASSETS.map((url) =>
        cache.add(url).catch(() => undefined)
      ))
    )
  );
  // Take over immediately rather than waiting for old SW to release clients
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document') return true;
  const url = request.url || '';
  return url.endsWith('.html') || url.endsWith('/') || url === self.registration.scope;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url || '';

  // Skip SW interception for MP4 / media files. iOS WKWebView (standalone
  // PWA mode) is finicky about videos served through a SW — we've observed
  // empty/broken responses in standalone mode while Safari proper worked
  // fine with the same SW. Letting the browser fetch directly via the HTTP
  // stack avoids this. Trade-off: maps need an online connection on first
  // view, but the browser's HTTP cache covers same-session reloads.
  if (/\.(mp4|m4v|webm|mov)(\?|$)/i.test(url)) return;

  if (isHtmlRequest(event.request)) {
    // Network-first for HTML: always try fresh, fall back to cache offline.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('index.html'))
        )
    );
    return;
  }

  // Cache-first for non-media static assets (manifest, icon, etc.)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
