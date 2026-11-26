/* Wort service worker — cache-first shell so the app opens with no network.
   Bump CACHE on every release; old caches are dropped on activate. */
const CACHE = "wort-v3.2.1";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts: serve from cache when present, refresh in the background.
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // The page itself is fetched from the network first, so a new build is picked up on
  // the next load instead of being shadowed by the cache until the version changes.
  const isPage = req.mode === "navigate" || url.pathname.endsWith("/") ||
                 url.pathname.endsWith("index.html") || url.pathname.endsWith("sw.js");
  if (isPage) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // Everything else: cache first, fall back to the network.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
