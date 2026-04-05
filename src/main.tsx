import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
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

createRoot(document.getElementById("root")!).render(<App />);
