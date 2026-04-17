

# Splash-Screen als Lade-Brücke nutzen

## Problem
Aktuell läuft der Splash-Screen unabhängig vom Daten-Fetch ab (1.2s fix). Danach wird das Dashboard mit Skeleton angezeigt, während die Daten erst danach geladen werden. Der User sieht: Splash → Skeleton → Inhalt.

Besser: Splash → (Daten werden im Hintergrund geladen, Splash bleibt sichtbar mit Fortschrittsbalken) → fertig geladenes Dashboard erscheint sofort.

## Lösung

### A. Daten-Prefetch parallel zum Splash starten
**`src/App.tsx`**
- Auth-Session und Dashboard-Daten **schon während des Splash** mit React Query `prefetchQuery` vorladen.
- Der Splash bleibt sichtbar bis **beide Bedingungen** erfüllt sind:
  1. Mindest-Anzeigezeit (für Animation, ~800ms)
  2. Dashboard-Daten sind geladen (oder Fehler / kein User)

### B. Splash mit Fortschrittsbalken
**`src/components/SplashScreen.tsx`**
- Neue Props: `progress: number` (0-100), `ready: boolean`
- Zeigt unter den drei Punkten einen schmalen Fortschrittsbalken (Tailwind, weiss/transparent über Splash-Hintergrund).
- Schritt-Tracking:
  - 20%: Auth-Session geladen
  - 60%: Dashboard Batch 1 (Stats, Profil, Flüge) geladen
  - 100%: Batch 2 (Avatar, Fotos, Events, Challenges) geladen
- Splash blendet erst aus, wenn `ready=true` UND Mindestzeit erreicht.

### C. Fetch-Funktion für Fortschritts-Callbacks erweitern
**`src/hooks/use-dashboard-data.ts`**
- `fetchDashboardData` bekommt optionalen Parameter `onProgress?: (pct: number) => void`.
- Nach Batch 1 → `onProgress(60)`, nach Batch 2 → `onProgress(100)`.
- Neuer exportierter Helper `prefetchDashboard(userId, queryClient, onProgress)` für den Splash-Flow.

### D. Auth-Loading mit Splash koppeln
**`src/contexts/AuthContext.tsx`**
- Bereits okay – `loading` wird nach `getSession()` auf false gesetzt. Dieser Übergang triggert den Daten-Prefetch im App-Wrapper.

## Ablauf neu

```text
t=0     Splash erscheint, Auth-Check startet                   [  0% ]
t=200ms Auth-Session da → Dashboard-Prefetch startet            [ 20% ]
t=600ms Batch 1 fertig (Stats, Profil, Flüge)                   [ 60% ]
t=900ms Batch 2 fertig (Fotos, Events, Challenges)              [100% ]
t=900ms Splash blendet aus → Dashboard sofort gefüllt sichtbar
```

Falls Daten schneller fertig sind als 800ms-Mindestanzeige: Splash bleibt bis 800ms.
Falls Daten langsamer sind: Splash bleibt sichtbar mit Balken bis 100%.

## Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/SplashScreen.tsx` | Fortschrittsbalken + `progress`/`ready` Props |
| `src/App.tsx` | Auth-Wartung + Dashboard-Prefetch im Splash-Block koordinieren |
| `src/hooks/use-dashboard-data.ts` | `onProgress`-Callback + `prefetchDashboard` Helper |

Keine DB-Änderungen, keine API-Calls hinzugefügt – nur Reihenfolge und UX.

