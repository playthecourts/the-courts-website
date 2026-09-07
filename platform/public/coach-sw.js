// The Courts Coach — service worker.
//
// Scope: /coach/ only. The Parent App is deliberately untouched.
//
// Strategy is intentionally conservative, because the failure mode we care
// about most is a coach acting on stale roster data:
//   - Navigations + app data: network-first, falling back to cache only when
//     the network actually fails. A coach online always sees live data.
//   - Static build assets: cache-first (immutable, content-hashed).
//   - POSTs (server actions) are never cached or replayed here — attendance
//     retry is handled in the UI, where it can be shown to the coach.
const CACHE = "courts-coach-v1";
const SHELL = ["/coach", "/brand/logo-horizontal-full-white.png", "/brand/icon-mark-color.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isCoachRoute = url.pathname === "/coach" || url.pathname.startsWith("/coach/");
  const isBuildAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/");
  if (!isCoachRoute && !isBuildAsset) return;

  if (isBuildAsset) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("/coach")))
  );
});
