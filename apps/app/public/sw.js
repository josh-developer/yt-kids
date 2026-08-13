const CACHE_NAME = "kidtube-pwa-v7";
const LOCALES = ["en", "uz"];
const DEFAULT_LOCALE = "en";
// Every page lives under a locale prefix, so `/` is a redirect and cannot be
// precached (Cache.addAll rejects redirected responses).
const APP_SHELL = [
  ...LOCALES.flatMap((locale) => [`/${locale}`, `/${locale}/settings`]),
  "/favicon.svg",
  "/brand-mascot-header.png",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Dev-server URLs must never be cached: Vite serves modules with a version
 * query that changes whenever dependencies are re-optimized, and replaying a
 * stale one loads a second copy of React.
 */
function isDevAsset(url) {
  return (
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/node_modules/") ||
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/app/") ||
    url.searchParams.has("v") ||
    /\.(tsx?|jsx)$/.test(url.pathname)
  );
}

function offlineShellFor(url) {
  const [maybeLocale] = url.pathname.split("/").filter(Boolean);
  return LOCALES.includes(maybeLocale)
    ? `/${maybeLocale}`
    : `/${DEFAULT_LOCALE}`;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    isDevAsset(url)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response.redirected) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((match) => match ?? caches.match(offlineShellFor(url))),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }

        return response;
      });
    }),
  );
});
