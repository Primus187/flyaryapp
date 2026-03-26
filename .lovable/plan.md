

# Training-Tracker nach SHV-Ausbildungsreglement umbauen

## Problemstellung

Die aktuellen Seed-Daten im Training-Tracker sind generisch und entsprechen nicht dem offiziellen SHV-Ausbildungsreglement (Schweizerischer Hängegleiter-Verband). Die Kategorien und Übungen sollen sich an den tatsächlichen SHV-Prüfungsanforderungen orientieren.

---

## SHV-Quellen (recherchiert)

Aus den offiziellen SHV-Weisungen "Fähigkeitsprüfung Gleitschirm Pilot" (Juli 2025) stammen diese konkreten Prüfungsinhalte:

**Theorie** (5 Sachgebiete): Fluglehre, Wetterkunde, Gesetzgebung, Materialkunde, Flugpraxis

**Praktische Prüfung - Flugfiguren** (Ziffer 5.7.2):
- a) Doppelkreis (2 Kreise rechtsdrehend, max. 20s)
- b) Acht (1× links + 1× rechts, max. 25s)
- c) Ohren beschleunigt geradeaus (25% Spannweite, 10s halten)
- d) Ohren mit Richtungswechsel (90° links/rechts per Gewicht)
- e) Seitenklapper stabilisiert (40% einklappen, 3s halten)
- f) Nicken (max. 5 Impulse, innerhalb 5s stabilisieren)
- g) Rollen (max. 5 Impulse, innerhalb 8s stabilisieren)

**Weitere Prüfungselemente**: 5-Punkte-Check, Vorwärts-/Rückwärtsstart, Landeeinteilung (Gegenanflug → Queranflug → Endanflug), Landeflächen (Kreis 34m / Rechteck 20×45m / 15×60m)

---

## Umsetzung

### 1. DB-Migration: Seed-Daten komplett ersetzen

Bestehende Kategorien und Items löschen (CASCADE löscht auch `flight_training_items` und `training_progress` — Fortschritt geht verloren, muss dem User kommuniziert werden). Neue Struktur:

**Kategorien** (neu, SHV-konform):
1. **Theorie (SHV)** — 5 Sachgebiete gemäss Prüfung
2. **Starttechnik** — Vorwärts-/Rückwärtsstart, 5-Punkte-Check
3. **SHV-Prüfungsmanöver** — Die 7 offiziellen Flugfiguren a–g
4. **Landeeinteilung** — Volten, Landeanflug, Landeflächen
5. **Groundhandling** — Bodenübungen
6. **Flugpraxis** — Thermik, Soaring, Streckenflug, aktives Fliegen, Flugentscheid
7. **Sicherheitstraining / SIV** — Klapper, Fullstall, Spirale, Rettung
8. **Übungshang** — Basisübungen für Anfänger

**Items pro Kategorie**: Jedes Item bekommt `goal`, `content`, `mistakes`, `danger` Texte die direkt aus dem SHV-Reglement abgeleitet sind (z.B. exakte Zeitvorgaben, Winkel, Spannweiten-Prozente).

### 2. Kennzeichnung der Prüfungsmanöver

Neues Feld `is_exam_maneuver boolean DEFAULT false` auf `training_items` — damit können die 7 SHV-Hauptmanöver (a–g) visuell hervorgehoben werden (z.B. mit einem Prüfungs-Badge).

### 3. UI-Anpassung in Training.tsx

- Prüfungsmanöver mit einem kleinen "SHV" Badge markieren
- Kategorie "SHV-Prüfungsmanöver" visuell hervorheben (z.B. andere Farbe)

### 4. TrainingItemDetail.tsx

- Bei `is_exam_maneuver = true`: SHV-Referenz anzeigen (z.B. "SHV Flugfigur c — Ziffer 5.7.2")

---

## Dateien

- **Migration**: Neue SQL-Migration — DELETE alte Seeds, INSERT neue SHV-konforme Daten, ALTER TABLE für `is_exam_maneuver`
- **Edit**: `src/pages/Training.tsx` — SHV-Badge bei Prüfungsmanövern
- **Edit**: `src/pages/TrainingItemDetail.tsx` — SHV-Referenz anzeigen
- **Edit**: `src/i18n/locales/{de,en,fr}.json` — Label für "SHV-Prüfungsmanöver" etc.

---

## Hinweis

Der bestehende Fortschritt (Sterne/Notizen) aller User geht durch das Löschen der alten Items verloren, da `training_progress` über `item_id` referenziert und die alten UUIDs gelöscht werden. Bei einer produktiven App mit vielen Usern wäre ein Mapping sinnvoll — bei aktuellem Stand ist ein Reset vertretbar.

