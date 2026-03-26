

# Flyary — Optimierungsplan

## Analyse der aktuellen Schwachstellen

Nach Durchsicht des Codes identifiziere ich diese Hauptbereiche:

---

## 1. Performance: Lazy Loading für Routen

**Problem**: Alle 25+ Seiten werden beim App-Start geladen (kein Code-Splitting). `App.tsx` importiert jede Seite direkt.

**Lösung**: `React.lazy()` + `Suspense` für alle Routen ausser Dashboard und Auth. Reduziert initiales Bundle um ~60%.

---

## 2. Performance: Dashboard Wasserfall-Queries

**Problem**: `Dashboard.tsx` führt 8+ sequentielle Supabase-Abfragen in einem einzigen `useEffect` aus (Profil → Flüge → Fotos → Mitgliedschaften → Events → Challenges → Gliders). Jede wartet auf die vorherige.

**Lösung**: `Promise.all` für unabhängige Queries (Profil, Flüge, Mitgliedschaften, Gliders parallel). Signed URLs batch-generieren statt in Schleifen.

---

## 3. Performance: Signed URLs cachen

**Problem**: Jeder Seitenaufruf generiert neue Signed URLs für Avatare und Fotos (3600s Gültigkeit, aber nie gecacht).

**Lösung**: Einfacher In-Memory-Cache (Map) für Signed URLs mit TTL, als shared Utility. Vermeidet redundante Storage-Calls beim Navigieren.

---

## 4. Code-Qualität: Dashboard & Feed aufräumen

**Problem**: `Dashboard.tsx` (351 Zeilen) hat die gesamte Datenlogik in einem monolithischen `useEffect`. `Feed.tsx` (741 Zeilen) ist ähnlich gross.

**Lösung**: Custom Hooks extrahieren:
- `useDashboardData()` — Profil, Stats, Events, Challenges, Glider-Warnings
- `useFeedData()` — Feed-Items, Bookmarks, Pull-to-Refresh

---

## 5. UX: Error States & Retry

**Problem**: Fast keine Seite zeigt Fehlermeldungen bei fehlgeschlagenen API-Calls. Daten verschwinden einfach stillschweigend.

**Lösung**: Error-State mit Retry-Button auf Dashboard, Feed, Flights, Stats. Einfaches Pattern: `{ loading, error, data }` statt nur `{ loading, data }`.

---

## 6. UX: Pull-to-Refresh auf Dashboard

**Problem**: Feed hat Pull-to-Refresh, Dashboard aber nicht. Bei Rückkehr zum Dashboard sieht man veraltete Daten.

**Lösung**: Pull-to-Refresh analog zum Feed implementieren, oder alternativ Daten bei `visibilitychange` neu laden.

---

## 7. Accessibility: Semantik & ARIA

**Problem**: Viele interaktive Elemente nutzen `<div>` oder `<button>` ohne Labels. Event-Karten haben verschachtelte `onClick` ohne `role`.

**Lösung**: Semantische Tags (`<article>`, `<nav>`, `<section>`), `aria-label` auf Icon-Buttons, `sr-only` Beschriftungen.

---

## 8. Security: `as any` Type-Casts entfernen

**Problem**: Dashboard und andere Seiten nutzen `as any` für Supabase-Queries auf `challenges`, `challenge_goals`, `pilot_gliders`. Dies umgeht TypeScript-Sicherheit.

**Lösung**: Supabase-Types aktualisieren (Regeneration der Types nach letzten Migrationen), dann Casts entfernen.

---

## Umsetzungsreihenfolge

1. **Lazy Loading** für Routen in `App.tsx`
2. **Dashboard-Queries parallelisieren** mit `Promise.all`
3. **Signed-URL-Cache** als Utility
4. **Custom Hooks** extrahieren (`useDashboardData`, `useFeedData`)
5. **Error States** mit Retry auf Hauptseiten
6. **Pull-to-Refresh** auf Dashboard
7. **Accessibility** Verbesserungen
8. **Type-Cast Cleanup**

---

## Dateien

- **Edit**: `src/App.tsx` — React.lazy + Suspense
- **Edit**: `src/pages/Dashboard.tsx` — Query-Parallelisierung, Custom Hook, Error/Retry, Pull-to-Refresh
- **Edit**: `src/pages/Feed.tsx` — Custom Hook Extraktion
- **Neu**: `src/hooks/use-dashboard-data.ts`
- **Neu**: `src/hooks/use-feed-data.ts`
- **Neu**: `src/lib/signed-url-cache.ts`
- **Edit**: Diverse Seiten — Error States, Accessibility

