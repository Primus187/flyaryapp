

# Feed erweitern: Events & Challenges im Instagram-Style

## Übersicht
Der Feed zeigt aktuell nur Flüge. Er soll zusätzlich Events/Termine und aktive Challenges aus den Gruppen des Users anzeigen — alles chronologisch gemischt und im Instagram-Card-Style.

## 1. Unified Feed-Item Typ

Neues Konzept: `FeedItem` als Union-Type mit `type: "flight" | "event" | "challenge"`. Alle Items haben ein gemeinsames `date`-Feld für chronologische Sortierung.

## 2. Feed-Daten laden (Edit: `src/pages/Feed.tsx`)

Zusätzlich zu Flügen:
- **Events**: `flight_events` laden wo `group_id IN groupIds`, sortiert nach `event_date`
- **Challenges**: `challenges` laden wo `group_id IN groupIds` und aktiv (`end_date IS NULL OR end_date >= today`)
- Challenge-Progress und Goals mitzählen für Fortschrittsanzeige
- Alle Items in ein Array mergen, nach Datum sortieren

## 3. Neue Feed-Karten-Komponenten

### `FeedEventCard` (Neu: `src/components/FeedEventCard.tsx`)
Instagram-Style Event-Karte:
- Gradient-Header mit Event-Typ-Icon (Kalender, Schulung, etc.)
- Avatar + Gruppenname im Header (wie Instagram-Post)
- Event-Titel gross, Datum/Uhrzeit, Ort, Beschreibung
- Anmeldestand (X/Y Teilnehmer) als visuelles Element
- "Anmelden"-Button direkt in der Karte
- Like + Comment Actions wie bei Flügen (optional, oder nur Info)

### `FeedChallengeCard` (Neu: `src/components/FeedChallengeCard.tsx`)
Instagram-Style Challenge-Karte:
- Gradient-Background (Gold/Amber für Trophies)
- Trophy/Target-Icon prominent
- Titel, Beschreibung, Fortschrittsbalken
- Teilnehmer-Avatare als kleine Kreise
- "Details ansehen"-Button
- Badge "Aktiv" / "Neu"

## 4. Feed-Rendering (Edit: `src/pages/Feed.tsx`)
- `FeedItem[]` statt `FeedFlight[]` als State
- Switch/Map über `item.type` um die richtige Karte zu rendern
- Bestehende `FeedCard` für Flüge beibehalten

## 5. i18n (Edit: `de/en/fr.json`)
Neue Keys:
- `feed.newEvent`, `feed.newChallenge`, `feed.participants`, `feed.signUp`, `feed.viewDetails`
- `feed.eventIn` (Gruppenname), `feed.challengeProgress`

## Dateien
- **Neu**: `src/components/FeedEventCard.tsx`
- **Neu**: `src/components/FeedChallengeCard.tsx`
- **Edit**: `src/pages/Feed.tsx` — Events + Challenges laden, unified sorting
- **Edit**: `src/i18n/locales/{de,en,fr}.json` — Neue Feed-Keys

