// Bump CACHE_VERSION whenever you change any cached asset's name or the strategy below.
const CACHE_VERSION = "v3";
const CACHE = `games-library-${CACHE_VERSION}`;
const FONT_CACHE = "games-library-fonts-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./games.json",
  "./add-game.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // add() each asset separately: one missing file must not break the whole install
      .then((cache) =>
        Promise.allSettled(ASSETS.map((url) => cache.add(new Request(url, { cache: "reload" }))))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k !== FONT_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Network-first (always revalidate with the server), fall back to cache offline.
// Keeps games.json and the app shell fresh without version mismatches.
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: "no-cache" });
    if (res && res.ok && res.type === "basic") {
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    return new Response("Offline", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

// Stale-while-revalidate for Google Fonts, so the UI keeps its font offline.
async function fontStrategy(req) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) return cached;
  const res = await network;
  return res || new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(fontStrategy(req));
    return;
  }

  // Leave everything else cross-origin (e.g. link previews) to the browser
  if (url.origin !== self.location.origin) return;

  // Live-save endpoint and its folders must always hit the network
  if (/\/(save|hash-password)\.php$/.test(url.pathname)) return;

  event.respondWith(networkFirst(req));
});
