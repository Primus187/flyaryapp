import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import i18n, { i18nReady } from "./i18n";
import { toast } from "sonner";

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
  onNeedRefresh() {
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

const recoverFromStaleChunk = () => {
  if (sessionStorage.getItem("stale-chunk-reload") === "1") return;

  sessionStorage.setItem("stale-chunk-reload", "1");
  updateSW(true);
  window.location.reload();
};

window.addEventListener("error", (event) => {
  const message = event.message || (event.error instanceof Error ? event.error.message : "");
  if (message.includes("Failed to fetch dynamically imported module")) {
    recoverFromStaleChunk();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason || "");
  if (message.includes("Failed to fetch dynamically imported module")) {
    recoverFromStaleChunk();
  }
});

void i18nReady.then(() => createRoot(document.getElementById("root")!).render(<App />));
