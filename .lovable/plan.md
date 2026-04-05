

# Fix: HUD zeigt immer 0 bei Geschwindigkeit und Vario

## Problem
Die Zeitstempel in `renderPoints` haben das Format `"HH:MM:SS"` (z.B. `"12:34:56"` aus dem IGC-Parser). Der Code auf Zeile 428-429 macht `new Date("12:34:56")`, was `Invalid Date` ergibt. Dadurch ist `dtSec` immer `NaN`, und der Fallback setzt Speed und Vario auf 0.

## Lösung

### Änderung in `src/components/Flight3DMap.tsx` (Zeilen 428-430)

Statt `new Date(pp0.time).getTime()` die `"HH:MM:SS"`-Strings direkt in Sekunden parsen:

```typescript
function timeToSeconds(t: string): number {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}
```

Dann:
```typescript
const t0 = pp0.time ? timeToSeconds(pp0.time) : NaN;
const t1 = pp1.time ? timeToSeconds(pp1.time) : NaN;
const dtSec = t1 - t0;
```

Eine Datei, eine kleine Hilfsfunktion, drei Zeilen Änderung.

