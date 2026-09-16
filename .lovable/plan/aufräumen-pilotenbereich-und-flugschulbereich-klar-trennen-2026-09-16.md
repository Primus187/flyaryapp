# Aufräumen: Pilotenbereich und Flugschulbereich klar trennen

Ziel: Auf der ersten Ebene sieht ein Schüler oder Brevetierter nur, was er selbst braucht. Alles, was nur das Flugschul-Team betrifft, liegt gebündelt in einem eigenen Bereich.

## 1. Untere Navigation bleibt schlank

Vier Tabs plus Plus-Knopf, wie heute: Start, Feed, Flugbuch, Mehr.
Neu: Wer zum Flugschul-Team gehört (Schulleitung oder Fluglehrer), bekommt im "Mehr"-Bereich ganz oben eine deutlich sichtbare Karte "Flugschule" als Eingang. Für alle anderen erscheint sie nicht.

## 2. "Mehr" wird nach Pilotensicht neu gruppiert

```text
Flugschule (nur Team)   -> ein breiter Eingang, ganz oben

Fliegen                 Termine · Fluggebiete · Wetter · Karte
Ich                     Mein Profil · Ausbildung · Statistiken · Ziele/Auszeichnungen
Community               Feed-Suche · Rangliste · Gruppen
Einstellungen           Einstellungen · Flüge importieren
Rechtliches             Impressum · Nutzungsbedingungen · Lizenzen · Abmelden
```

Änderungen gegenüber heute:
- "Orte importieren" und "Flüge importieren" wandern in die Einstellungen (dort als Unterpunkt "Daten importieren"), damit die Kacheln weniger werden.
- "Statistiken" wird von der Startseite aus auch hier erreichbar und nicht mehr doppelt an mehreren Stellen betont.
- Rechtliches wird zu einer einzigen Zeile "Rechtliches" zusammengefasst, die auf eine Seite mit den drei Unterseiten führt.

## 3. Flugschulbereich: alles zusammen, in drei Gruppen statt neun Reitern

Heute stehen neun Reiter nebeneinander (Übersicht, Personen, Schüler, Flugtage, Material, Statistiken, Guthaben, Abrechnung, Chat) — auf dem Handy nicht lesbar.
Neu: eine Startseite "Flugschule" mit drei Blöcken aus Kacheln:

```text
Betrieb      Termine/Flugtage · Einteilung · Chat
Personen     Personen & Funktionen · Ausbildungsstand
Verwaltung   Material · Guthaben · Abrechnung · Statistiken
```

Jede Kachel öffnet ihre eigene Unterseite mit Titel und Zurück-Knopf. Die Übersicht mit den Kennzahlen bleibt oben auf der Startseite des Flugschulbereichs.

## 4. Startseite entlasten

Die Startseite zeigt in dieser Reihenfolge: nächster Termin, eigene Kennzahlen, Saisonziel, letzte Flüge. Schul-Verwaltungsinhalte erscheinen dort nicht; für Team-Mitglieder gibt es stattdessen einen einzelnen Hinweisstreifen "Flugschule öffnen".

## 5. Sichtbarkeit

Der Flugschul-Eingang und alle Unterseiten erscheinen nur für Schulleitung und Fluglehrer. Schüler und Brevetierte sehen ihre Termine, Anmeldungen, Ausbildung und ihr eigenes ausgeliehenes Material wie bisher an den gewohnten Stellen.

## Technische Umsetzung

- `src/pages/More.tsx`: Abschnitte neu gruppieren, Flugschul-Eingang als breite Karte oben, Import-Kacheln entfernen, Rechtliches auf eine Zeile reduzieren.
- `src/pages/SchoolDashboard.tsx`: Tabs durch eine Kachel-Startseite ersetzen; Unterseiten als eigene Routen `/school/:section` (`days`, `people`, `students`, `equipment`, `credits`, `billing`, `stats`, `chat`), die die bestehenden Komponenten unverändert einbinden. Registrierung in `src/App.tsx`.
- Rollenprüfung: bestehende Abfrage in `More.tsx` erweitern, so dass neben Gruppen-Admin auch die Funktionen `instructor` und `school_lead` (`group_member_functions`) den Zugang öffnen; als kleiner Hook `use-school-access`, damit Startseite und More dieselbe Logik nutzen.
- `src/pages/Settings.tsx`: Abschnitt "Daten importieren" mit Links auf `/import` und `/import-locations`.
- `src/pages/Dashboard.tsx`: Schul-Hinweisstreifen statt Verwaltungsinhalte.
- i18n de/en/fr: neue Schlüssel für Abschnittstitel und Kachelbeschriftungen; keine Datenbank- oder Rechteänderungen nötig.
