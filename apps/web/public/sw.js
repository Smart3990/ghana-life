// Service worker (master plan: "Cache the map and game files on the phone with a service worker,
// so the second visit is fast and costs no data").
//
// - Map tiles, fonts, icons, street and traffic data, and the built game code: served from the
//   phone's cache when present, otherwise downloaded once and kept.
// - Pages (the HTML): always asked from the network first, so new versions arrive; the cached
//   copy is only used when offline.
// - The tile cache is trimmed so it never fills a cheap phone's storage.

const VERSION = 'v1';
const ASSETS = `gl-assets-${VERSION}`; // built game code (file names change with every build)
const MAP = `gl-map-${VERSION}`; // tiles, fonts, icons, street and traffic data
const PAGES = `gl-pages-${VERSION}`;
const MAX_MAP_ITEMS = 4000;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([ASSETS, MAP, PAGES]);
    for (const name of await caches.keys()) if (!keep.has(name)) await caches.delete(name);
    await self.clients.claim();
  })());
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
    if (cacheName === MAP && Math.random() < 0.02) trim(cache); // now and then, not on every request
  }
  return response;
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_MAP_ITEMS))) await cache.delete(key);
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // the live server and anything else: untouched
  const path = url.pathname;
  if (path.startsWith('/assets/')) event.respondWith(cacheFirst(request, ASSETS));
  else if (/^\/(tiles|map|data)\//.test(path)) event.respondWith(cacheFirst(request, MAP));
  else if (request.mode === 'navigate') event.respondWith(networkFirst(request));
});
