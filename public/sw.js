// Caches the app itself so it opens with no signal. Data caching is handled
// separately in src/offline.js — this only deals with files.
//
// Bump CACHE_NAME when you want every client to discard its old copy.
const CACHE_NAME = "planting-tracker-v1";
const CORE = ["/", "/index.html", "/manifest.json", "/farm-map.jpg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Individually, so one missing file doesn't fail the whole install.
      .then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Anything cross-origin (Supabase, Google Fonts) goes straight to the
  // network. Caching API responses here would fight with offline.js.
  if (url.origin !== self.location.origin) return;

  // Page loads: try the network first so a new deploy is picked up promptly,
  // fall back to the cached shell when there's no connection.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Build assets have hashed filenames, so cache-first is safe — a new build
  // requests new names rather than stale ones.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
