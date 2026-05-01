/* Minimal service worker for installable PWA support; network-only (no offline cache). */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-only strategy, but fail gracefully so intermittent network errors
  // don't surface as uncaught promise rejections in the SW console.
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).catch(() => {
      if (event.request.mode === "navigate") {
        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      return Response.error();
    })
  );
});
