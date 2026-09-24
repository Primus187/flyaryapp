import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import i18n, { i18nReady } from "./i18n";
import { toast } from "sonner";
import { captureAuthRedirectError } from "./lib/auth-redirect-error";
import { forceAppUpdate, isAppAsset, mayRecover } from "./lib/app-update";

// Never let an older installed build cache the editable preview.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(async (registrations) => {
    const hadRegistrations = registrations.length > 0;
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
    if (hadRegistrations && sessionStorage.getItem("preview-cache-cleared") !== "1") {
      sessionStorage.setItem("preview-cache-cleared", "1");
      window.location.reload();
    }
  }).catch(() => {});
}

const updateSW = registerSW({
  immediate: true,
  // autoUpdate mode: the new service worker is already active; only the page reload is ours.
  // Never reload under the user's fingers (half-filled flight form, coach notes): reload while
  // the app is in the background, otherwise offer a button. Lazy chunks that vanished with the
  // old precache are covered by recoverFromStaleChunk below.
  onNeedReload() {
    const reload = () => window.location.reload();
    if (document.visibilityState === "hidden") { reload(); return; }
    const reloadWhenHidden = () => {
      if (document.visibilityState !== "hidden") return;
      document.removeEventListener("visibilitychange", reloadWhenHidden);
      reload();
    };
    document.addEventListener("visibilitychange", reloadWhenHidden);
    toast(i18n.t("common.updateAvailable"), {
      duration: Infinity,
      action: { label: i18n.t("common.reloadNow"), onClick: reload },
    });
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    const checkForUpdate = () => {
      if (navigator.onLine) registration.update().catch(() => {});
    };

    checkForUpdate();
    window.setInterval(checkForUpdate, 60 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });
  },
  onOfflineReady() {},
});

// A device can end up with an old start page from the service worker whose CSS/JS files are gone on the
// server (many deploys in a row): no styles, white page on lazy routes. A plain reload comes from the same
// cache, so the repair drops service worker and caches (forceAppUpdate). At most once a minute.
const recoverFromStaleChunk = () => {
  let last = 0;
  try { last = Number(sessionStorage.getItem("stale-asset-recovery") || 0); } catch { /* private mode */ }
  if (!mayRecover(last, Date.now())) return;
  try { sessionStorage.setItem("stale-asset-recovery", String(Date.now())); } catch { /* private mode */ }
  void forceAppUpdate().then((started) => { if (!started) updateSW(true); });
};

window.addEventListener("error", (event) => {
  // failed <link>/<script> loads do not bubble: listened to in the capture phase
  const target = event.target;
  if (target instanceof HTMLLinkElement || target instanceof HTMLScriptElement) {
    const url = target instanceof HTMLLinkElement ? target.href : target.src;
    if (isAppAsset(url)) recoverFromStaleChunk();
    return;
  }
  const message = event.message || (event.error instanceof Error ? event.error.message : "");
  if (message.includes("Failed to fetch dynamically imported module")) {
    recoverFromStaleChunk();
  }
}, true);

// Vite reports failed preloads of lazy routes here.
window.addEventListener("vite:preloadError", () => recoverFromStaleChunk());

// The stylesheet in index.html may have failed before this script ran: check once the page has loaded.
window.addEventListener("load", () => {
  const missing = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
    .some((link) => isAppAsset(link.href) && !link.sheet);
  if (missing) recoverFromStaleChunk();
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason || "");
  if (message.includes("Failed to fetch dynamically imported module")) {
    recoverFromStaleChunk();
  }
});

// Keep a failed Google sign-in visible: the redirect to /auth would otherwise drop the error.
captureAuthRedirectError();

void i18nReady.then(() => createRoot(document.getElementById("root")!).render(<App />));
