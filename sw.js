// alaska-2026 service worker
//
// Strategy:
//   - HTML (navigation) + MP4 maps: network-first. Always try the network so
//     deploys + fresh videos load when online. Fall back to cached copy when
//     offline (e.g. mid-flight, on a cruise without WiFi).
//   - Manifest, icon, static assets: cache-first. They rarely change.
//   - On install, pre-cache the HTML, manifest, icon, and all 13 map MP4s.
//     Each asset is cached individually so one network failure can't abort
//     install — anything missed is re-fetched on first use.
//   - On every deploy the CACHE name changes (deploy.sh substitutes the token
//     below), so the new SW installs, old caches get deleted, and clients
//     pick up the fresh content on next launch.

const CACHE = 'alaska-2026-1780446352';
const STATIC_ASSETS = [
  './', 'index.html', 'manifest.json', 'icon.png',
  'emergency-card.pdf',
  // Remotion-rendered route animations (pre-cached for offline use on the cruise)
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

function isMediaRequest(url) {
  return /\.(mp4|m4v|webm|mov)(\?|$)/i.test(url);
}

// Network-first with cache fallback. Used for HTML and MP4s — online users
// always get fresh content, and the cache is only consulted when network
// fails (airplane mode on the plane / cruise ship without WiFi).
function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() =>
      caches.match(request).then((cached) => {
        if (cached) return cached;
        // Only fall back to index.html for HTML navigation, never for media.
        if (isHtmlRequest(request)) return caches.match('index.html');
        return undefined;
      })
    );
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url || '';

  if (isHtmlRequest(event.request) || isMediaRequest(url)) {
    event.respondWith(networkFirst(event.request));
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
