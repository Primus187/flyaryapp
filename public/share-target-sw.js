/* Web Share Target, imported into the Workbox-generated service worker (see vite.config.ts).
 * Android's share sheet sends an .igc file as a multipart POST to /share-target (manifest
 * "share_target"). The file is parked in Cache Storage and the new-flight form picks it up from
 * there (src/lib/shared-igc.ts). Keep the cache name and key in sync with that file. */
const SHARE_CACHE = "flyary-share-target";
const SHARED_IGC_KEY = "/shared-file/igc";
const MAX_SHARED_BYTES = 20 * 1024 * 1024;

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.origin !== self.location.origin || url.pathname !== "/share-target") return;
  event.respondWith((async () => {
    let status = "none";
    try {
      const form = await event.request.formData();
      const file = form.getAll("igc").find((f) => typeof f === "object" && f && f.size > 0 && f.size <= MAX_SHARED_BYTES);
      const cache = await caches.open(SHARE_CACHE);
      await cache.delete(SHARED_IGC_KEY);
      if (file) {
        await cache.put(SHARED_IGC_KEY, new Response(file, {
          headers: { "Content-Type": "text/plain", "X-File-Name": encodeURIComponent(file.name || "flight.igc") },
        }));
        status = "igc";
      }
    } catch { /* fall through: the form reports that nothing arrived */ }
    return Response.redirect(`/flights/new?shared=${status}`, 303);
  })());
});
