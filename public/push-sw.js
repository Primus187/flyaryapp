/* Web Push handlers, imported into the Workbox-generated service worker (see vite.config.ts).
 * Without a "push" listener browsers show a generic notice (Chrome) or revoke the
 * subscription after a few silent pushes (iOS Safari). */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "Flyary", {
    body: data.body || "",
    icon: "/icons/flyary-192.png",
    badge: "/icons/flyary-192.png",
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only ever open in-app paths, never an arbitrary origin from the payload.
  let target = new URL("/", self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url || "/", self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  } catch { /* keep default */ }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === target.origin && "focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target.href).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(target.href);
  })());
});
