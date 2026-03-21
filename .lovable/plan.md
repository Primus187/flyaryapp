

# Native App mit Barometer-Zugriff

## Zwei Optionen

**Option 1: Installierbare Web-App (PWA)** — bereits fast fertig
- Direkt vom Browser auf den Homescreen installierbar
- Funktioniert offline, fühlt sich wie eine echte App an
- Kein App Store nötig
- **Einschränkung**: Kein Zugriff auf das Barometer (Web-APIs unterstützen das nicht)

**Option 2: Echte Native App mit Capacitor**
- Wird als richtige Android-App gebaut, kann in den Play Store
- **Voller Zugriff auf alle Sensoren**, inklusive Barometer
- Deutlich genaueres Variometer (barometrische Höhe statt GPS-Höhe)
- **Voraussetzung**: Du brauchst Android Studio auf deinem Computer

## Empfehlung

Für dein Ziel (Barometer auf dem Pixel nutzen) brauchst du **Option 2: Capacitor**. Die bestehende App bleibt identisch — Capacitor verpackt sie als native Android-App und gibt dir Zugriff auf die Sensoren.

## Was ich umsetzen würde

### 1. Capacitor einrichten
- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` installieren
- Capacitor-Konfiguration mit App-ID und Live-Reload vom Lovable-Preview

### 2. Barometer-Plugin integrieren
- Capacitor-Plugin für den Barometer-Sensor (z.B. `capacitor-barometer` oder ein generisches Sensor-Plugin)
- Alternativ: Eigenes kleines Capacitor-Plugin, das den Android `SensorManager` für `TYPE_PRESSURE` nutzt

### 3. Variometer verbessern
- `vario-audio.ts` erweitern: Barometer-Druck statt GPS-Höhe verwenden, wenn verfügbar
- Barometrische Höhe berechnen (Internationale Höhenformel aus Luftdruck)
- Fallback auf GPS-Höhe, wenn kein Barometer vorhanden (z.B. im Browser)

### 4. Schritte für dich auf dem Computer
1. Projekt über "Export to GitHub" auf dein GitHub übertragen
2. Repository klonen, `npm install`
3. `npx cap add android`
4. `npm run build && npx cap sync`
5. `npx cap run android` — App startet auf deinem Pixel (per USB verbunden)

## Technische Details

```text
Architektur:
┌─────────────────────────┐
│   React App (Vite)      │  ← bleibt unverändert
├─────────────────────────┤
│   Capacitor Bridge      │  ← neu
├─────────────────────────┤
│   Android Native Layer  │  ← Barometer-Sensor
└─────────────────────────┘
```

- **Barometer-Daten**: ~25 Hz Abtastrate, Auflösung ~0.01 hPa → ca. 10 cm Höhenauflösung (vs. ±10-30m bei GPS)
- **Vario-Berechnung**: Exponentieller Glättungsfilter auf barometrische Höhe, deutlich präziser als GPS-basiert
- Plattform-Erkennung via `Capacitor.isNativePlatform()` für automatischen Fallback

