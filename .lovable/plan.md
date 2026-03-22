

# Globale Meilensteine & Hexagonale Badges im Profil

## Übersicht
Implementierung des Achievement-Systems mit automatisch vergebenen Badges basierend auf Flugstatistiken. Die Badges werden als **Hexagone** im Stil des Referenzbildes dargestellt — mit Farbkodierung, Icons und prominenten Zahlen.

---

## 1. Datenbank-Migration

### Neue Tabelle `pilot_badges`
```sql
CREATE TABLE public.pilot_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_key text NOT NULL,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_key)
);
ALTER TABLE public.pilot_badges ENABLE ROW LEVEL SECURITY;
```

### Trigger-Funktion `check_and_award_badges`
- Wird nach INSERT/UPDATE auf `flights` ausgelöst
- Prüft kumulative Stats (Fluganzahl, Gesamtzeit, Höhenmeter, Distanz, Startplätze)
- Insertet neue Badges bei Erreichen der Schwellenwerte

### Badge-Kategorien & Schwellenwerte
- **Flüge**: 1, 10, 50, 100, 250
- **Flugzeit (h)**: 1, 10, 50, 100, 500
- **Höhenmeter**: 1k, 10k, 50k, 100k
- **Distanz (km)**: 50, 200, 500, 1000
- **Startplätze**: 5, 15, 30
- **Rekorde**: Einzelflug >2h, >50km, >2000hm

---

## 2. Badge-Definitionen (`src/lib/badges.ts`)

Zentrale Konfiguration mit:
- `key`, `category`, `threshold`, `icon`, `color` (amber/green/gold je Kategorie)
- Tier-System: Bronze → Silber → Gold (bestimmt Hexagon-Rahmenfarbe)
- Keine DB-Einträge für Definitionen — nur Code

---

## 3. Hexagonale Badge-Komponente (`src/components/HexBadge.tsx`)

Visuelles Design inspiriert vom Referenzbild:
- **SVG-basiertes Hexagon** mit abgerundeten Ecken
- **Farbige Fläche** im Hexagon (grün, amber, gold je nach Kategorie/Tier)
- **Prominente Zahl** in der Mitte (z.B. "10", "800", "5")
- **Kleines Icon** unterhalb der Zahl (Stern, Uhr, Blatt etc.)
- **Weisser Sticker-Rand** um das Hexagon
- **Banner-Element** oben für höhere Tiers (wie im Bild)
- Gesperrte Badges: grau/transparent mit Lock-Overlay
- Fortschrittsanzeige bei gesperrten Badges (z.B. "37/50")

---

## 4. Badge-Grid im Profil (`src/components/BadgeGrid.tsx`)

- 3-Spalten-Grid mit allen Badges
- Freigeschaltete farbig, gesperrte grau/dimmed
- Klick öffnet Detail-Sheet mit Beschreibung, Freischalt-Datum, Fortschritt
- Gruppiert nach Kategorie (Flüge, Zeit, Höhe, Distanz, etc.)

---

## 5. Profil-Integration (`src/pages/Profile.tsx`)

- Neuer Abschnitt "Errungenschaften" nach XP-Card
- Kompakte Badge-Vorschau (letzte 6 freigeschaltete) + "Alle anzeigen"-Button
- Badges aus `pilot_badges` laden bei Page-Load

---

## 6. Badge-Benachrichtigung

In `FlightForm.tsx` nach Speichern: neue Badges aus Response prüfen und Toast mit Badge-Icon anzeigen.

---

## 7. i18n
Badge-Namen und -Beschreibungen in de/en/fr. Kategorienamen, "Errungenschaften", "freigeschaltet am", etc.

## Dateien
- **Migration**: `pilot_badges` + Trigger `check_and_award_badges`
- **Neu**: `src/lib/badges.ts` — Badge-Definitionen
- **Neu**: `src/components/HexBadge.tsx` — Hexagonale SVG-Badge-Komponente
- **Neu**: `src/components/BadgeGrid.tsx` — Grid + Detail-Sheet
- **Edit**: `src/pages/Profile.tsx` — Errungenschaften-Abschnitt
- **Edit**: `src/pages/FlightForm.tsx` — Badge-Toast nach Speichern
- **Edit**: `src/i18n/locales/{de,en,fr}.json`

