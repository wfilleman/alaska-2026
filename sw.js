// alaska-2026 service worker
//
// Strategy:
//   - HTML (navigation): network-first. Always try the network so deploys
//     show up immediately when online. Fall back to cached copy when offline.
//   - Manifest, icon, static assets: cache-first. They rarely change.
//   - On every deploy the CACHE name changes (deploy.sh substitutes the token
//     below), so the new SW installs, old caches get deleted, and clients
//     pick up the fresh content on next launch.

const CACHE = 'alaska-2026-1779471691';
const STATIC_ASSETS = [
  './', 'index.html', 'manifest.json', 'icon.png',
  // Remotion-rendered Inside Passage / Denali route animations
  'maps/Title.mp4',
  'maps/Overview.mp4',
  'maps/Mini-YVR.mp4',
  'maps/Mini-KTN.mp4',
  'maps/Mini-JNU.mp4',
  'maps/Mini-SKG.mp4',
  'maps/Mini-GLB.mp4',
  'maps/Mini-CLF.mp4',
  'maps/Mini-WHT.mp4',
  'maps/Mini-TLK.mp4',
  'maps/Mini-MCK.mp4',
  'maps/Mini-DEN-PARK.mp4',
  'maps/Mini-FAI.mp4',
];

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

  // Cache-first for everything else
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
