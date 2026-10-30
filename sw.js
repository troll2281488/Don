/* DonorGram service worker: GitHub Pages-safe offline shell and static asset cache. */
const CACHE_NAME = "donorgram-v3";
const APP_SHELL = ["./", "./index.html"];
const STATIC_DESTINATIONS = new Set(["script", "style", "image", "font", "worker"]);

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith("donorgram-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation stays network-first so GitHub Pages deployments are not hidden
  // behind a stale HTML document. The last successful shell remains offline-ready.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy)));
        }
        return response;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Cache only actual static assets. Do not persist arbitrary same-origin
  // endpoints, user data, or responses explicitly marked no-store.
  if (!STATIC_DESTINATIONS.has(request.destination)) return;
  event.respondWith(
    fetch(request).then(response => {
      const cacheControl = response.headers.get("Cache-Control") || "";
      if (response && response.ok && !/no-store/i.test(cacheControl)) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
      }
      return response;
    }).catch(() => caches.match(request))
  );
});
