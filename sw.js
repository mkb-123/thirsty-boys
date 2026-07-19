/* Thirsty Boys service worker — makes the app open and run with no signal.
   The whole app shell (HTML/CSS/JS/config/trip + icons) is cached so a cold
   start offline still works; state lives in localStorage and syncs via the
   app's own outbox when a connection returns.

   Cache is keyed to the build hash (stamped at deploy), so every new deploy
   gets a fresh cache and the old one is binned on activate. */
const BUILD = "__BUILD__";
const CACHE = "thirstyboys-" + BUILD;
const SHELL = [
  "./",
  "./index.html",
  "./assets/style.css?v=" + BUILD,
  "./assets/app.js?v=" + BUILD,
  "./assets/config.js?v=" + BUILD,
  "./assets/trips.json?v=" + BUILD,
  "./assets/trip.json?v=" + BUILD,
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Other origins (Firebase, gstatic, Nominatim, Open-Meteo, BBC) — let them
  // hit the network as normal; offline they just fail gracefully.
  if (url.origin !== location.origin) return;

  // version.json drives the update checker — must always be live, never cached.
  if (url.pathname.endsWith("version.json")) return;

  // Navigations: network-first so a fresh deploy loads immediately, with the
  // cached shell as the offline fallback.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); return res; })
        .catch(() => caches.match("./index.html").then((m) => m || caches.match("./")))
    );
    return;
  }

  // Everything else (assets): stale-while-revalidate — instant from cache,
  // refreshed in the background.
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req);
    const network = fetch(req)
      .then((res) => { if (res && res.status === 200) cache.put(req, res.clone()); return res; })
      .catch(() => null);
    return cached || network || fetch(req);
  }));
});
