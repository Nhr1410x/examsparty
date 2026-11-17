// Examsparty Service Worker
const CACHE_NAME = "examsparty-v1";
const PRECACHE_URLS = [
  "/",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((k) => {
            if (k !== CACHE_NAME) return caches.delete(k);
          })
        )
      )
    ])
  );
});

self.addEventListener("fetch", (event) => {
  // Let API requests and mutations pass straight to the network
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) {
    return;
  }

  // Network-first strategy for dynamic pages, falling back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (
          response.ok &&
          (event.request.url.endsWith(".svg") ||
            event.request.url.endsWith(".png") ||
            event.request.url.endsWith(".css") ||
            event.request.url.endsWith(".js") ||
            event.request.url.endsWith(".woff2"))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((res) => res || caches.match("/")))
  );
});
