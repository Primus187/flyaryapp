import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

// Shown on the "Mehr" page and in feedback mails: commit (on Vercel) and build time.
const buildTime = new Date().toLocaleString("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(", ", " ");
const appVersion = `${(process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7)} · ${buildTime}`;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon-192.png", "icon-512.png"],
      manifest: {
        id: "/?source=pwa",
        name: "Flyary",
        short_name: "Flyary",
        description: "Dein Gleitschirm Flugtagebuch",
        start_url: "/?source=pwa",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        lang: "de",
        background_color: "#0a0a0a",
        theme_color: "#0a0a0a",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        importScripts: ["/push-sw.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Heavy, rarely used chunks (3D map ~1 MB, XLSX import ~340 KB) are not precached on
        // install; they are cached at runtime on first use instead (see runtimeCaching).
        globIgnores: ["**/stats.html", "**/push-sw.js", "**/assets/Flight3DMap-*.js", "**/assets/ImportFlights-*.js"],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(Flight3DMap|ImportFlights)-.*\.js$/,
            handler: "CacheFirst",
            options: { cacheName: "lazy-heavy-chunks", expiration: { maxEntries: 10 } },
          },
          {
            // Database reads only: photos/videos (large, signed URLs change) and auth calls
            // gained nothing from this cache. On a weak mountain connection fall back to the
            // last cached answer after 3 s instead of waiting for the browser timeout.
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "supabase-api", networkTimeoutSeconds: 3, expiration: { maxEntries: 100, maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
    // Bundle-Audit: `npm run build:analyze` erzeugt dist/stats.html.
    mode === "analyze" && visualizer({
      filename: "dist/stats.html",
      template: "treemap",
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        // Automatic splitting keeps shared helpers out of eager map/chart chunks.
      },
    },
  },
}));
