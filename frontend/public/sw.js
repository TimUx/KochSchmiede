const CACHE_NAME = "kochschmiede-v2";
const OFFLINE_URL = "/offline";
const STATIC_ASSETS = [
  "/",
  "/recipes",
  "/import",
  "/settings",
  "/offline",
  "/manifest.json",
  "/assets/kochschmiede_favicon_dark.png",
  "/assets/kochschmiede_logo_dark.png",
  "/assets/kochschmiede_logo_light.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/api/") ||
    (url.pathname.startsWith("/_next/") && !url.pathname.startsWith("/_next/static/"))
  ) return;
  if (
    event.request.headers.has("RSC") ||
    event.request.headers.has("Next-Router-Prefetch") ||
    event.request.headers.has("Next-Router-State-Tree")
  ) return;

  const networkResponse = fetch(event.request);
  event.waitUntil(
    networkResponse
      .then((response) => {
        if (!response.ok) return;
        return caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      })
      .catch(() => {})
  );
  event.respondWith(
    networkResponse.catch(async () => {
      const cached = event.request.mode === "navigate"
        ? (await caches.match(event.request)) ?? (await caches.match(OFFLINE_URL))
        : await caches.match(event.request);
      return cached ?? new Response("", { status: 503, statusText: "Offline" });
    })
  );
});
