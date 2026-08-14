const SHARE_CACHE = "mda-share";
const SHARE_CACHE_KEY = new URL("./__shared", self.registration.scope).href;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "POST") return;
  if (url.origin !== self.location.origin) return;

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

        // Уведомляем уже открытые окна
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