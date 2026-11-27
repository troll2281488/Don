/* DonorGram service worker: GitHub Pages-safe offline shell and static asset cache. */
const CACHE_NAME = "donorgram-v20";
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


/*
 * Push display bridge for incoming calls.
 * A trusted sender must deliver a payload containing { type:"incoming_call",
 * title, body, callId }. The app still validates the call against Firebase
 * after the user opens it; notification payloads are never treated as auth.
 */
self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try { payload = { body: event.data ? event.data.text() : "" }; } catch (_) {}
  }
  if (payload.type !== "incoming_call") return;
  const title = payload.title || "Входящий звонок";
  const options = {
    body: payload.body || "Вам звонят в DonorGram",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: payload.callId ? "donorgram-call-" + payload.callId : "donorgram-call",
    renotify: true,
    requireInteraction: true,
    data: { callId: payload.callId || null, url: "./" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "./", self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
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
