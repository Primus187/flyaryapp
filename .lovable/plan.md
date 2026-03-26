

# Events prominenter platzieren

## Aktueller Stand
Die BottomNav hat 5 Tabs: **Home, Feed, Logbuch, Orte, Mehr**. Events/Termine sind aktuell nur über die Events-Seite erreichbar (via Mehr-Hub oder direkte URL), aber **nicht in der BottomNav**.

## Lösung: Events in die BottomNav aufnehmen

Die BottomNav wird von 5 auf 6 Tabs erweitert — das Calendar-Icon ist bereits importiert aber nicht verwendet:

```
Home | Feed | Logbuch | Events | Orte | Mehr
 🏠    🧭     📖       📅      📍     ⊞
```

### Änderung in `src/components/BottomNav.tsx`
- Events-Tab `{ path: "/events", icon: Calendar }` zwischen Logbuch und Orte einfügen
- Icon-Grösse und Padding leicht reduzieren (`h-5 w-5`, `px-3`), damit 6 Tabs auf 395px passen

### Zusätzlich: FAB auf Events-Seite
- Floating Action Button (runder Plus-Button) unten rechts in `src/pages/Events.tsx`
- Nur sichtbar wenn User Event-Erstellrechte hat
- Positioniert über der BottomNav (`bottom-20 right-4`)

