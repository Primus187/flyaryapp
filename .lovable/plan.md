

# Aktuelle Animationsposition im Höhenprofil anzeigen

## Änderungen

### 1. `Flight3DMap.tsx` — Animations-Index nach aussen geben
- Neuen optionalen Callback `onAnimIndex?: (index: number | null) => void` zur Props-Interface hinzufügen
- Im `animate()` Loop: bei jedem ~10. Frame den aktuellen Index (`idx`) über `onAnimIndex` nach aussen melden
- Bei Stop/Reset: `onAnimIndex(null)` aufrufen

### 2. `FlightAltitudeProfile.tsx` — Weisse Linie für aktuelle Position
- Neuen optionalen Prop `animIndex?: number | null` hinzufügen
- Den Index auf den downgesampelten Daten-Index mappen
- Eine Recharts `ReferenceLine` (bereits importiert) an der entsprechenden X-Position rendern: dünne weisse vertikale Linie (`stroke="#ffffff"`, `strokeWidth={1.5}`)

### 3. `FlightDetail.tsx` — State verbinden
- Neuen State `animIdx` (number | null) anlegen
- `onAnimIndex={setAnimIdx}` an `Flight3DMap` übergeben
- `animIndex={animIdx}` an `FlightAltitudeProfile` übergeben

Drei Dateien, minimale Änderungen.

