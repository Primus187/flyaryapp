

# Fix: BottomNav-Klicks gehen ins Leere

## Diagnose

Aus dem Session-Replay: Alle Klicks (auf verschiedene Tabs der Bottom-Nav) landen auf demselben DOM-Element. Das ist ein klassisches Symptom für ein **unsichtbares Vollbild-Overlay**, das Pointer-Events abfängt.

Verdächtige Stelle: `src/components/SplashScreen.tsx`
- Container: `fixed inset-0 z-[9999]`
- Beim Beenden wird `phase` auf `"exit"` gesetzt → nur `opacity-0`, **kein** `pointer-events-none`
- Während der 400ms-Exit-Animation und in Edge-Cases (z. B. wenn `onFinished` nicht zuverlässig feuert oder `ready`/`minElapsed` nie zusammenkommen) bleibt der Splash über allem liegen und schluckt alle Klicks. Die Bottom-Nav (`z-50`) ist weit darunter und reagiert nicht.

Zusätzlich: In `SplashGate` (`src/App.tsx`) hängt das Setzen von `dataReady` daran, dass `prefetchDashboard` zumindest in den `.finally()`-Block läuft. Falls die Prefetch-Promise aus irgendeinem Grund früh resolved, aber `setDataReady(true)` durch eine Race-Condition (z. B. AuthContext liefert `user` mehrfach) zurückgesetzt würde, bliebe der Splash hängen.

## Lösung

### 1. `SplashScreen.tsx` — Pointer-Events sauber abschalten
- In der Exit-Phase zusätzlich `pointer-events-none` setzen, damit Klicks sofort nach Animationsstart durchgereicht werden.
- Für noch mehr Sicherheit: Ist `phase === "exit"`, soll der Splash nichts mehr blocken.

### 2. `SplashGate` in `src/App.tsx` — Splash-State stabilisieren
- `dataReady` einmal auf `true` setzen und nicht mehr zurücksetzen (ist heute schon so, aber sicherstellen, dass der Effect bei mehrfachem Auth-Event nicht erneut `setDataReady(false)` ausführt — derzeit gibt es keinen Reset, gut).
- **Safety-Timeout**: Nach max. 4 Sekunden hart `dataReady = true` setzen, damit der Splash niemals dauerhaft blockieren kann, selbst wenn ein Netzwerk-Call hängt.

### 3. `BottomNav.tsx` — Defensive Verbesserung
- `type="button"` an die `<button>` setzen (Best Practice, verhindert Form-Submit-Edge-Cases).
- Sonst keine Logikänderung — das ursprüngliche Verhalten ist korrekt.

## Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/SplashScreen.tsx` | `pointer-events-none` in Exit-Phase |
| `src/App.tsx` | Safety-Timeout (4s) für `dataReady` in `SplashGate` |
| `src/components/BottomNav.tsx` | `type="button"` ergänzen |

Keine DB-Änderungen, rein Frontend.

