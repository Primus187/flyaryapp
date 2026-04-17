

# UI/UX-Verbesserungen — Pilot-fokussiert & professionell

Basierend auf Analyse von Dashboard, Flüge, More, BottomNav und im Vergleich zu erfolgreichen Apps (Strava, Instagram, Apple Fitness, Komoot).

## Diagnose — was heute schwächer ist

1. **Dashboard wirkt überladen**: 7 Sektionen untereinander (Header, Stats, Jahresvergleich, Wartung, Events, Challenges, Ziele, Flüge). Keine visuelle Hierarchie — alles gleich wichtig.
2. **Stats-Kacheln sind klein und stumm**: 4 winzige Boxen mit „87 / 142h / 12 / 9" — keine emotionale Wirkung, kein Highlight (z. B. „dieses Jahr").
3. **Bottom-Nav ohne Labels**: Nur Icons + Active-Dot. Erfolgreiche Apps (Instagram, Strava, Komoot) zeigen entweder Labels ODER haben einen prominenten zentralen Action-Button.
4. **Kein zentraler "Quick Add" FAB**: Flug erfassen ist die Kern-Aktion — versteckt als kleiner `+`-Button im Header.
5. **More-Seite = 11 gleichförmige Tiles**: Keine Gruppierung (Tools / Verwaltung / Rechtliches), Sign-Out wirkt deplatziert.
6. **Flüge-Liste = Textwüste**: Keine visuelle Differenzierung (Karten ohne Bild/Map-Thumb), keine Gruppierung nach Monat/Jahr, keine schnellen Filter (z. B. „Diese Saison", „Top 10 km").
7. **Kein „Heute"-Kontext**: Wetter, nächster Termin, aktuelle Saison-Progress-Ring fehlen auf Dashboard-Höhe.
8. **Tab-Bar-Reihenfolge nicht konsistent**: Bottom-Nav-Reihenfolge ≠ Wichtigkeit (Locations vor More — aber Locations selten genutzt).

## Verbesserungsvorschläge (priorisiert)

### Priorität 1 — Sofortwirkung, geringes Risiko

**A. Hero-Stat-Karte statt 4 Mini-Tiles**
Eine grosse Karte oben („Saison 2026") mit:
- Zentral: aktuelles Jahr Flüge + Stunden gross (`text-3xl`, tabular-nums)
- Daneben: Trend-Pfeil + % vs. Vorjahr (heute schon berechnet, nur visualisiert)
- Sekundärzeile klein: Distanz · Höhenmeter · Startplätze
→ Inspiration: Strava-Wochenübersicht, Apple Fitness-Ringe

**B. Bottom-Nav mit Labels + zentralem FAB**
- 5 Tabs (statt 6): Home · Feed · **[+ Flug]** · Flüge · More
- Zentraler runder Action-Button (primär gefärbt) → öffnet `/flights/new`
- Mini-Labels unter den Icons (`text-[10px]`) — Standard in iOS/Android
- Events & Locations wandern in Dashboard-Quick-Links bzw. More

**C. More-Seite gruppieren**
- Sektion „Pilot": Profil, Suche, Leaderboard
- Sektion „Tools": Wetter, Karte, Training, Gruppen
- Sektion „Verwaltung": Import Flüge / Standorte, Einstellungen
- Sektion „Rechtliches": Legal · Sign-Out
→ Reduziert kognitive Last, wirkt wie native iOS-Settings

### Priorität 2 — Mehr Politur

**D. Dashboard Information-Density reduzieren**
- Stats-Karte (A) + Hero-Bild des letzten Flugs prominent
- Events/Challenges/Ziele in **horizontalen Carousels** statt Stacks (Embla, schon im Stack vorhanden)
- „Letzte Flüge" auf 3 begrenzen + „Alle ansehen" → /flights

**E. Flüge-Liste aufwerten**
- Gruppierung nach Monat (Sticky-Header, wie iOS Fotos)
- Optional: Map-Thumbnail links (kleiner Marker auf Mini-Map) wenn Track vorhanden
- Quick-Filter-Chips über Suchleiste: „Diese Saison" · „Mit Track" · „Wettkampf"

**F. Mikro-Interaktionen**
- Haptic-Feedback bei Tab-Wechsel (`navigator.vibrate(10)`) — fühlt sich nativ an
- Skeleton-Karten matchen exakt das finale Layout (kein Layout-Shift)
- Pull-to-refresh-Spinner durch animierten Paraglider-Icon ersetzen (Detail-Liebe)

### Priorität 3 — Wow-Faktor

**G. „Heute"-Bar oben am Dashboard**
Schmale glasige Bar zwischen Header und Stats: Wetter aktueller Standort + nächster bestätigter Termin („Morgen 09:00 Niederbauen"). Tap → Wetter / Event-Detail.

**H. Onboarding-Empty-States humanisieren**
Statt nur „Keine Flüge" — ein freundlicher Coach-Tipp („Erfasse deinen ersten Flug — IGC genügt, Rest erledigen wir.") mit illustrativem Icon statt generischem Plane-Icon.

## Vorgeschlagener Umfang für 1. Iteration

Empfehlung: **A + B + C** in einem Schritt umsetzen — das verändert den Gesamteindruck am stärksten und bleibt überschaubar.

| Datei | Änderung |
|-------|----------|
| `src/pages/Dashboard.tsx` | Hero-Stat-Karte ersetzt 4-Tile-Grid |
| `src/components/BottomNav.tsx` | 5 Tabs + Labels + zentraler FAB |
| `src/pages/More.tsx` | Tiles in 4 Sektionen gruppieren |
| `src/i18n/locales/*.json` | Neue Labels für Bottom-Nav + More-Sektionen |

Keine DB-Änderungen, keine neuen Abhängigkeiten.

## Offene Frage

Bevor ich loslege: Soll ich **A+B+C** (mein Vorschlag) machen, oder willst du eine andere Kombination? Wenn du nur eines wählen müsstest, würde ich **B (BottomNav mit FAB)** empfehlen — höchste tägliche Sichtbarkeit.

