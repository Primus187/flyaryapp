
# Geschwindigkeits- & Variometer-HUD in der 3D-Animation

## Übersicht
Während der Animation werden oben rechts über der Karte Geschwindigkeit (km/h) und Steig-/Sinkrate (m/s) als kompaktes HUD angezeigt, berechnet aus den Track-Punkten.

## Änderungen

### 1. `src/components/Flight3DMap.tsx`

**Neuer State:**
- `animSpeed` (number | null) — aktuelle Geschwindigkeit in km/h
- `animVario` (number | null) — aktuelle Steig-/Sinkrate in m/s

**Im `animate()` Loop** (alle ~10 Frames, zusammen mit dem bestehenden Progress-Update):
- Aus den Zeitstempeln und Positionen der renderPoints `speed` berechnen: Haversine-Distanz zwischen aktuellem und vorherigem Punkt ÷ Zeitdifferenz → km/h
- `vario` berechnen: Höhendifferenz ÷ Zeitdifferenz → m/s
- Beide Werte über einen gleitenden Durchschnitt (3-5 Punkte) glätten, um Rauschen zu vermeiden

**Im JSX:**
- Neues HUD-Overlay oben rechts auf der Karte (nur sichtbar wenn `playing` und Werte vorhanden)
- Zwei Werte: Geschwindigkeit (km/h) mit Gauge-Icon, Vario (m/s) mit Pfeil hoch/runter
- Vario-Farbe: grün bei Steigen, rot bei Sinken
- Kompaktes Design: halbtransparenter Hintergrund, passend zum bestehenden Controls-Stil

**Bei Reset/Stop:**
- `animSpeed` und `animVario` auf `null` setzen

### 2. Hilfsfunktion
- `haversineDistance(p1, p2)` → Meter (einfache Formel, reicht für kurze Abstände)
- Inline in der Datei, keine externe Abhängigkeit

## Nicht betroffen
- Keine Änderungen an `FlightDetail.tsx` oder `FlightAltitudeProfile.tsx`
- Nur eine Datei: `Flight3DMap.tsx`
