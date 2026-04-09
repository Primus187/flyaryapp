

# Dashboard-Ladezeit optimieren

## Analyse: Wo geht die Zeit verloren?

### 1. Splash Screen blockiert 2.6 Sekunden fix
Der Splash Screen wartet immer 2.6s — unabhängig davon, ob Daten schon bereit sind. Das ist die grösste wahrgenommene Verzögerung.

### 2. Wasserfall-Kette in `fetchDashboardData`
Die Daten werden nicht maximal parallelisiert:

```text
Batch 1:  stats, currentYear, profile, flights, memberships, gliders  (~300ms)
    ↓ sequentiell
Batch 2:  prevYear stats RPC                                          (~150ms)
    ↓ sequentiell  
Batch 3:  avatar signed URL                                           (~100ms)
    ↓ sequentiell
Batch 4:  flight photos + signed URLs                                 (~200ms)
    ↓ sequentiell (wenn memberships vorhanden)
Batch 5:  events + challenges                                         (~150ms)
    ↓ sequentiell (wenn challenges vorhanden)
Batch 6:  goals + progress                                            (~150ms)

Total: ~1000ms+ sequentiell statt ~300ms parallel
```

### 3. Auth-Check wartet separat
`getSession()` + `onAuthStateChange` laufen, dann erst beginnt der Dashboard-Fetch.

---

## Lösung

### A. Splash Screen verkürzen (1 Datei)
**`src/components/SplashScreen.tsx`**
- Mindestdauer von 2.6s auf 1.2s reduzieren (genug für die Animation)
- Splash wird also schneller ausgeblendet

### B. Alle DB-Calls maximal parallelisieren (1 Datei)
**`src/hooks/use-dashboard-data.ts`**
- `prevYear` Stats-RPC in den ersten `Promise.all`-Block verschieben (aktuell sequentiell auf Zeile 112)
- Avatar-Signed-URL parallel zu Flight-Photos holen (aktuell sequentiell)
- Events, Challenges, Signups und Challenge-Progress in einen einzigen `Promise.all` zusammenfassen statt 3 sequentielle Batches

Ergebnis: Statt 4-6 sequentielle Netzwerk-Runden nur noch 2 (erste Runde: alles ohne Gruppen-Abhängigkeit, zweite Runde: alles was `groupIds` braucht).

### C. Auth-Session schneller bereitstellen (1 Datei)
**`src/contexts/AuthContext.tsx`**
- `getSession()` zuerst aufrufen, `onAuthStateChange` nur als Listener registrieren — aktuell kann es passieren, dass beide konkurrieren und `setLoading(false)` doppelt feuert

---

## Zusammenfassung

| Datei | Änderung |
|-------|----------|
| `SplashScreen.tsx` | Mindestdauer 2.6s → 1.2s |
| `use-dashboard-data.ts` | Wasserfall eliminieren, alles in max. 2 parallele Batches |
| `AuthContext.tsx` | Session-Init straffen |

Keine DB-Migrationen nötig. Rein Frontend-Optimierungen. Erwartete Verbesserung: Dashboard erscheint ~1.5–2s schneller.

