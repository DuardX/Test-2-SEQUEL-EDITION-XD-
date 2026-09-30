const SHELL_VERSION = "v11";
const SHELL_CACHE = `mda-shell-${SHELL_VERSION}`;
const SHARE_CACHE = "mda-share";
const SHARE_CACHE_KEY = new URL("./__shared", self.registration.scope).href;
const SHELL_ROOT_URL = new URL("./", self.registration.scope).href;

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
  "./fonts/SpaceGrotesk-Light.woff2",
  "./fonts/SpaceGrotesk-Regular.woff2",
  "./fonts/SpaceGrotesk-Medium.woff2",
  "./fonts/SpaceGrotesk-SemiBold.woff2",
  "./fonts/SpaceGrotesk-Bold.woff2",
];

const isNavigation = (request) => request.mode === "navigate";
const isStaticAsset = (request) =>
  ["style", "script", "font", "image", "manifest"].includes(request.destination);

const isSameOriginGet = (request) =>
  request.method === "GET" && new URL(request.url).origin === self.location.origin;

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(event) {
  const preload = await event.preloadResponse;
  if (preload) {
    const cache = await caches.open(SHELL_CACHE);
    if (preload.ok && preload.type === "basic") {
      await cache.put(SHELL_ROOT_URL, preload.clone());
    }
    return preload;
  }

  try {
    const response = await fetch(event.request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(SHELL_ROOT_URL, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(SHELL_ROOT_URL);
    return cached || Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(
      SHELL_URLS.map((path) => new URL(path, self.registration.scope))
    );
    // Activate the new worker without forcing the current editor to reload.
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("mda-shell-") && key !== SHELL_CACHE)
        .map((key) => caches.delete(key))
    );

    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.method === "POST") {
    const targetPath = new URL("./share-target", self.registration.scope).pathname;
    if (url.pathname !== targetPath) return;

    event.respondWith((async () => {
      const contentType = event.request.headers.get("Content-Type") || "";
      if (!contentType.includes("multipart/form-data")) {
        return Response.redirect("./", 303);
      }

      try {
        const form = await event.request.formData();
        const file = form.get("file");
        const text =
          file && typeof file.text === "function"
            ? await file.text()
            : form.get("text") || "";
        const name = file && file.name ? file.name : form.get("title") || "shared.md";
        const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const cache = await caches.open(SHARE_CACHE);
        await cache.put(
          SHARE_CACHE_KEY,
          new Response(JSON.stringify({ id, name, text, createdAt: Date.now() }), {
            headers: { "Content-Type": "application/json" },
          })
        );

        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const target = clients.find((client) => client.focused) || clients[0];
        target?.postMessage({ type: "md-share", id, name, text });
      } catch (_) {
        // The share request still needs a valid navigation response.
      }

      return Response.redirect("./", 303);
    })());
    return;
  }

  if (!isSameOriginGet(event.request)) return;

  if (isNavigation(event.request)) {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  if (isStaticAsset(event.request)) {
    event.respondWith(cacheFirst(event.request));
  }
});
