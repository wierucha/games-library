const CACHE = "games-library-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./games.json",
  "./favicon.svg",
  "./add-game.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok && (req.url.includes("games.json") || req.mode === "navigate" || req.destination === "script" || req.destination === "style" || req.destination === "document")) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);

      // Prefer network for games.json when online; fall back to cache
      if (req.url.includes("games.json")) {
        return network.then((res) => res || cached).catch(() => cached);
      }
      return cached || network;
    })
  );
});
