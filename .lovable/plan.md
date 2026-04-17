

# Nächste Schritte im Plan

Bisher umgesetzt: Onboarding (1), Daten-Export & Account-Löschen (2), Push-Triggers + Streak + Wing-Stats (5/7), Mobile-Native Pull-to-Refresh + Social-Discovery (4/6), Coach-Notes + Bulk-Export (8).

Offen aus dem ursprünglichen Plan: **3 (Performance), 4 Rest (Share-Sheet, Swipe-Delete), 6 Rest (Hashtags, Multi-Pilot-Tag), 9 (AGB), 10 (Crash-Reporting)**.

## Vorgeschlagenes nächstes Paket — "Polish & Trust"

Drei zusammengehörige Themen mit hoher Wirkung und überschaubarem Aufwand:

### A. Optimistic Updates + Share-Sheet (Punkt 3 + 4)
- **Optimistic Likes/Kommentare** im Feed: sofortiges UI-Feedback via React-Query `onMutate`/`setQueryData`, Rollback bei Fehler
- **navigator.share()** Integration für Flug-Detail (teilt Public-Share-URL nativ auf iOS/Android), Fallback auf Clipboard
- **Swipe-to-delete** in Flug-Liste (Touch-Gesten, mit Confirm)

### B. Hashtags für Flüge (Punkt 6)
- Neues Feld `tags text[]` auf `flights` (Migration)
- Tag-Input im FlightForm (Chips, Autocomplete aus eigenen bisherigen Tags)
- Anzeige als klickbare Chips im FeedCard und FlightDetail
- Klick auf Tag → gefilterte Feed-Ansicht (`/feed?tag=thermik`)

### C. AGB + Lizenzhinweise (Punkt 9)
- Neue Route `/legal/terms` mit Nutzungsbedingungen-Text (Tobias Bolliger, Haftungsausschluss für Flugdaten/Wetter)
- Neue Route `/legal/licenses` mit OSS-Lizenzliste (Leaflet, MapLibre, Lucide, etc.)
- Verlinkung in More + Auth-Footer + Settings

## Betroffene Dateien (grob)

| Bereich | Datei |
|---|---|
| Optimistic | `src/components/FeedCard.tsx`, `src/pages/Feed.tsx` |
| Share | `src/pages/FlightDetail.tsx`, `src/pages/PilotProfile.tsx` |
| Swipe | `src/pages/Flights.tsx` (neuer Hook `use-swipe-action.ts`) |
| Hashtags | Migration `flights.tags`, `FlightForm.tsx`, `FeedCard.tsx`, `Feed.tsx` |
| Legal | `src/pages/Legal.tsx` erweitern, Routen in `App.tsx`, Links in `More.tsx` + `Auth.tsx` |
| i18n | `de/en/fr.json` |

## Quick-Fix nebenbei

Im Runtime-Log: `Map container is already initialized` — ich behebe das im selben Zug (Leaflet-Cleanup in einem Map-Komponenten-`useEffect`).

## Was nicht in diesem Paket ist

- **Crash-Reporting (Sentry)** — braucht Account/DSN, separat wenn gewünscht
- **Bundle-Audit / WebP-Pipeline** — eigenes Performance-Paket
- **Multi-Pilot-Tagging** — fügt komplexe Verlinkungslogik hinzu, separat sinnvoll

Soll ich A+B+C umsetzen, oder nur eines davon?

