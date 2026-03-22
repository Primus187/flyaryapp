

# Orte: Liste vereinfachen, Detailseite erweitern

## Änderungen

### 1. `src/pages/Locations.tsx` — Liste vereinfachen
- **Entfernen**: Bearbeiten- und Löschen-Buttons aus `renderLocationCard`
- **Hinzufügen**: Flug-Statistiken pro Ort anzeigen
  - Beim Laden der Locations auch Flüge laden (`flights` Tabelle), gruppiert nach `takeoff_location_id` und `landing_location_id`
  - Pro Ort: Anzahl Flüge und Datum des letzten Fluges anzeigen
  - Z.B. "3 Flüge · letzter: 12. Mär 2026"
- `handleEdit` und `handleDelete` können entfernt werden (nur noch auf Detailseite)

### 2. `src/pages/LocationDetail.tsx` — Duplizieren + Bearbeiten verbessern
- **Duplizieren-Button** hinzufügen (Copy-Icon) neben Bearbeiten und Löschen
- Duplizieren: Neuen Ort mit gleichen Daten erstellen (Name + " (Kopie)"), dann zur neuen Location navigieren
- **Bearbeiten-Button**: Statt nach `/locations` zu navigieren (aktuell falsch!), den Edit-Dialog aus Locations öffnen — besser: direkt zur Locations-Seite mit Edit-State navigieren, oder einen inline Edit-Dialog auf der Detailseite einbauen
  - Einfachste Lösung: Navigate zu `/locations?edit={id}` und in Locations.tsx den Dialog automatisch öffnen

### 3. i18n
- Neue Keys: `locations.duplicate`, `locations.duplicated`, `locations.lastFlight`, `locations.flightCount`

## Dateien
- **Edit**: `src/pages/Locations.tsx` — Buttons entfernen, Flug-Stats laden und anzeigen
- **Edit**: `src/pages/LocationDetail.tsx` — Duplizieren-Funktion, Bearbeiten-Navigation fixen
- **Edit**: `src/i18n/locales/{de,en,fr}.json` — Übersetzungen

