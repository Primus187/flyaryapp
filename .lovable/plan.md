

# Dashboard-Karten an Flugbuch & Termine angleichen

## Unterschiede

**Letzte Flüge (Dashboard):** Einfaches 2-Spalten-Layout (Name+Datum links, Dauer+Höhe rechts). Zeigt keine Landing-Location, keine Distanz, kein Glider-Emoji-Row.

**Flugbuch (Flights.tsx):** Name oben links, Landing darunter ("→ Landeplatz"), Datum oben rechts, dann eine Zeile mit ⏱/↑/↔/🪂 Details.

**Termine (Dashboard):** Calendar-Icon links, Titel+Datum+Treffpunkt, Status-Badge rechts. Kein Signup-Button, keine Teilnehmerzahl.

**Termine (Events.tsx):** Titel+Badge in einer Zeile, Datum+Typ+Gruppe darunter, Treffpunkt mit MapPin, Teilnehmerzahl mit Users-Icon, Signup-Button rechts.

## Änderungen

### `src/pages/Dashboard.tsx`

**Letzte Flüge** — Format wie Flights.tsx:
- Oben: Takeoff-Name links, Datum rechts
- Landing-Location als "→ name" darunter (wenn vorhanden)
- Detail-Zeile mit ⏱ Dauer, ↑ Höhe, 🪂 Glider (braucht `distance_km` nicht, da nicht geladen — optional nachladen)

**Nächste Termine** — Format wie Events.tsx EventCard:
- Titel + Status-Badge in einer Zeile
- Datum + Gruppenname darunter
- Treffpunkt mit MapPin-Icon
- Teilnehmerzahl (braucht zusätzliche Daten — Signup-Count laden)
- Signup-Button rechts (wenn nicht cancelled)

Dafür müssen auch die geladenen Daten erweitert werden:
- Flüge: `distance_km` und `landing_location` mit laden
- Events: Signup-Counts laden, Toggle-Funktion hinzufügen

### Dateien
- **Edit**: `src/pages/Dashboard.tsx` — Karten-Layout + Daten anpassen

