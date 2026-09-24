/** Build identifier ("abc1234 · 24.09. 16:40"), set in vite.config.ts from the Vercel commit. */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || "dev";

/** A build file of the app (hashed under /assets/): missing ones mean the device has a stale version. */
export const isAppAsset = (url: string) => /\/assets\/[^/]+\.(js|css)(\?|$)/.test(url);

/** At most one automatic repair per minute – a broken server must not end in a reload loop. */
export const RECOVERY_INTERVAL_MS = 60_000;
export const mayRecover = (lastAttempt: number, now: number) => now - lastAttempt >= RECOVERY_INTERVAL_MS;

/**
 * Loads the newest version right now: drops the service worker and its caches, then reloads.
 * The automatic update only switches on the next start; this is the manual way when a device
 * keeps showing an old version. Offline this would leave the app without its cache, so it refuses.
 */
export async function forceAppUpdate(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } finally {
    window.location.reload();
  }
  return true;
}
