

# PWA-Optimierung: Offline-Support, Install-Prompt & Icons

## Aktueller Stand
- Einfaches `manifest.json` mit nur 2 Icons (192, 512)
- Kein Service Worker / kein Offline-Support
- Kein Install-Prompt
- `vite-plugin-pwa` nicht installiert

## Änderungen

### 1. `vite-plugin-pwa` einrichten
- Dependency: `vite-plugin-pwa`
- In `vite.config.ts`: Plugin mit Workbox-Config hinzufügen
  - Runtime-Caching für API-Calls, Bilder, Fonts
  - `navigateFallbackDenylist: [/^\/~oauth/]` (OAuth nicht cachen)
  - Precaching der App-Shell
  - Manifest direkt im Plugin generieren (ersetzt `manifest.json`)

### 2. Manifest erweitern
- Mehr Icon-Grössen: 72, 96, 128, 144, 152, 192, 384, 512 (SVG-basiert generiert)
- `maskable` Icon für Android Adaptive Icons
- `shortcuts` für Schnellzugriff (Neuer Flug, Termine)
- `categories`, `orientation`, `scope`

### 3. Install-Prompt Komponente
- Neuer Hook `src/hooks/useInstallPrompt.ts`: `beforeinstallprompt` Event abfangen
- Banner/Button auf dem Dashboard: "Flyary installieren" — nur anzeigen wenn noch nicht installiert
- Dismissible, Zustand in `localStorage` merken

### 4. Offline-Fallback
- Offline-Seite (`/offline.html`) als Fallback wenn kein Netz
- Workbox: NavigationRoute mit Offline-Fallback

### 5. Icons generieren
- Da wir keine Build-Tools für Icon-Generierung haben: SVG-Icon als Basis in verschiedenen Grössen im `public/` Ordner bereitstellen
- Bestehende `icon-192.png` und `icon-512.png` bleiben, zusätzliche Grössen ergänzen

## Dateien
- **Edit**: `vite.config.ts` — `VitePWA` Plugin
- **Delete**: `public/manifest.json` — wird vom Plugin generiert
- **Neu**: `src/hooks/useInstallPrompt.ts` — Install-Prompt Hook
- **Neu**: `public/offline.html` — Offline-Fallback-Seite
- **Edit**: `src/pages/Dashboard.tsx` — Install-Banner einbauen
- **Edit**: `index.html` — `<link rel="manifest">` entfernen (Plugin macht das)
- **Edit**: `src/i18n/locales/{de,fr,en}.json` — Übersetzungen für Install-Prompt

