# Flyary: Standortbestimmung und Umbau-Fahrplan

Flyary ist vom persönlichen Flugbuch zur Plattform mit zwei gleichwertigen Säulen gewachsen: **Pilot** (Flüge, Fortschritt, Community) und **Flugschule** (Termine, Team, Verwaltung). Die Struktur hat das Wachstum mitgemacht, aber nicht mitgestaltet. Ergebnis: viele Einstiege, viele Muster, viel gleichzeitig sichtbar.

Fokus dieses Fahrplans: weniger sichtbare Optionen, ein einheitlicher Look, unveränderter Funktionsumfang.

## Standortbestimmung

Was heute gut trägt:
- Flugbuch mit IGC, Karten, 3D, Fotos/Videos, Statistiken, Auszeichnungen
- Termine mit Anmeldung, Warteliste, Briefing, Chat, Push
- Schulbereich mit Team, Material, Guthaben, Abrechnung, Statistiken
- Drei Sprachen, Offline-Warteschlange, Installierbarkeit

Wo es überladen wirkt:
- Rund 35 Seiten, davon 20 nur über die Liste in "Mehr" erreichbar — alles gleich gewichtet, nichts hervorgehoben
- Zwei parallele Termin-Welten: allgemeine Termine und Flugschul-Termine
- Zwei parallele Gruppen-Welten: Gruppen mit Chat und Flugschule mit Chat
- Die Startseite und "Mehr" zeigen teils dieselben Inhalte
- Optik: Karten, Listen, Reiter und Kacheln in mehreren Varianten; Abstände, Ecken, Kopfzeilen und Leerzustände pro Seite unterschiedlich

## Fahrplan

### Etappe 1 — Ein sichtbares Grundmuster (Optik & Konsistenz)
Ein einziger Satz Bausteine, den alle Seiten benutzen: Seitenkopf mit Titel, Rückweg und optionaler Aktion; einheitliche Karte; einheitliche Listenzeile; einheitlicher Leerzustand; einheitlicher Ladezustand; einheitliche Abschnittsüberschrift. Danach alle Seiten darauf umstellen. Keine neuen Funktionen, nur ein durchgehender Look. Farben, Rundungen und Glas-Optik bleiben wie bisher.

### Etappe 2 — Rollenumschalter statt Doppelwelt
Wer zum Schulteam gehört, wechselt oben bewusst zwischen "Pilot" und "Flugschule". Im Pilotmodus verschwinden alle Verwaltungsinhalte, im Schulmodus alle privaten Flugbuchinhalte. Für alle anderen ändert sich nichts — sie sehen nur den Pilotmodus, ohne Umschalter.

### Etappe 3 — "Mehr" von der Liste zum Zuhause
"Mehr" wird zur ruhigen Übersicht mit wenigen, klar benannten Gruppen und höchstens sechs sichtbaren Zielen pro Gruppe; Selteneres liegt eine Ebene tiefer bei seinem Thema (Importe in den Einstellungen, Lizenzen im Rechtlichen). Ziel: keine Wand aus gleich aussehenden Kacheln mehr.

### Etappe 4 — Termine zusammenlegen
Eine Terminliste für alles, mit Filter nach Gruppe/Schule und Art. Schul-Termine sind dieselben Termine, nur mit den zusätzlichen Team-Angaben. Damit fällt eine komplette Parallelwelt weg.

### Etappe 5 — Erfassen verkürzen
Flug erfassen in klaren Schritten mit Zwischenspeichern: erst Datum, Orte, Dauer — Fotos, Videos und Details danach. Gleiches Prinzip beim Termin. Nichts geht verloren, wenn zwischendurch abgebrochen wird.

### Etappe 6 — Startseite und Einstieg
Startseite zeigt genau vier Dinge in fester Reihenfolge: nächster Termin, eigene Kennzahlen, Saisonziel, letzte Flüge. Neue Nutzer bekommen einen kurzen geführten Einstieg mit einer einzigen empfohlenen nächsten Handlung statt leerer Karten.

### Etappe 7 — Feinschliff
Durchgang über Kontrast, Schriftgrössen, Tippziele, Bedienung mit dem Daumen, Vorlesehilfen und die drei Sprachen. Prüfung auf Handy, Tablet und Desktop.

## Reihenfolge und Wirkung

| Etappe | Aufwand | Sichtbarer Nutzen |
| --- | --- | --- |
| 1 Grundmuster | mittel | sofort: einheitlicher Look überall |
| 2 Rollenumschalter | mittel | hoch: halbiert das Sichtbare pro Rolle |
| 3 "Mehr" | klein | hoch: Ende der Kachelwand |
| 4 Termine | mittel | hoch: eine Welt statt zwei |
| 5 Erfassen | mittel | hoch im Alltag |
| 6 Startseite/Einstieg | klein | gut für Neue |
| 7 Feinschliff | klein | Qualitätseindruck |

Empfehlung: 1 → 3 → 2 → 6 → 4 → 5 → 7. So ist die Optik früh einheitlich und die Überladung schnell weg, bevor wir an die grösseren Zusammenlegungen gehen.

## Was ausdrücklich bleibt
Kein Feature wird gestrichen. Keine Datenbank- oder Rechteänderung nötig. Live-Tracking und Vario bleiben ausgeschlossen. XContest-Sync bleibt blockiert (Anti-Bot auf deren Seite), IGC-Import bleibt der Weg.

## Technische Hinweise
- Neue gemeinsame Bausteine unter `src/components/ui/` bzw. `src/components/layout/` (PageHeader, SectionHeading, EmptyState, ListRow, LoadingState); alle Werte über bestehende Tokens in `index.css`, keine festen Farben in Komponenten.
- Rollenmodus als Kontext plus Speicherung in `localStorage`, aufbauend auf dem vorhandenen `useSchoolAccess`; die bestehenden Routen `/school` und `/school/:section` bleiben.
- Termin-Zusammenlegung nutzt `flight_events.event_category` und `group_id` als Filter; `Events.tsx` und `SchoolDays.tsx` teilen künftig eine Listenkomponente.
- Mehrstufiges Erfassen speichert Flug-/Termindatensatz vor Medien (bestehende Regel) und legt Zwischenstände in die vorhandene IndexedDB-Warteschlange.
- i18n-Schlüssel für de/en/fr in jeder Etappe mitziehen; nach jeder Etappe Typprüfung und Sichtprüfung im mobilen Format.
