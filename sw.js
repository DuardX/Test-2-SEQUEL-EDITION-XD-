const SHARE_CACHE = "mda-share";
const SHARE_CACHE_KEY = new URL("./__shared", self.registration.scope).href;

const SHELL_VERSION = "v1";
const SHELL_CACHE = "mda-shell-" + SHELL_VERSION;
const SHELL_URLS = [
  "./",
  "./index.html",
  "./scripts.js",
  "./styles.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-maskable.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./fonts/SpaceGrotesk-Light.ttf",
  "./fonts/SpaceGrotesk-Regular.ttf",
  "./fonts/SpaceGrotesk-Medium.ttf",
  "./fonts/SpaceGrotesk-SemiBold.ttf",
  "./fonts/SpaceGrotesk-Bold.ttf",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.all(
          SHELL_URLS.map((path) =>
            cache
              .add(new URL(path, self.registration.scope))
              .catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("mda-shell-") && k !== SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
);

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // App-shell: serve from cache first (offline-capable), fall back to the
  // network, and fall back to the cached "./" as a last resort for
  // navigations so the shell still loads even for an uncached path.
  if (event.request.method === "GET") {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).catch(
            () => caches.match(new URL("./", self.registration.scope))
          )
      )
    );
    return;
  }

  if (event.request.method !== "POST") return;

  const targetPath = new URL("./share-target", self.registration.scope).pathname;
  if (url.pathname !== targetPath) return;

  event.respondWith(
    (async () => {
      const contentType = event.request.headers.get("Content-Type") || "";
      if (!contentType.includes("multipart/form-data")) {
        return Response.redirect("./", 303);
      }

      try {
        const form = await event.request.formData();
        const file = form.get("file") || form.get("md");
        const text =
          file && typeof file.text === "function"
            ? await file.text()
            : form.get("text") || "";

        const name = file && file.name ? file.name : "shared.md";

        const cache = await caches.open(SHARE_CACHE);
        await cache.put(
          SHARE_CACHE_KEY,
          new Response(JSON.stringify({ name, text }), {
            headers: { "Content-Type": "application/json" },
          })
        );

        // Notify already-open windows
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });

        clients.forEach((client) => {
          client.postMessage({ type: "md-share", name, text });
        });
      } catch (_) {}

      return Response.redirect("./", 303);
    })()
  );
});
