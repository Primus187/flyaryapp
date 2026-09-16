# Neue, typabhängige Termin-Erfassung

## Ziel
Über **Termine → Neuer Termin** und **Flugschule → Neuer Termin** wird dieselbe neue Erfassung geöffnet. Zuerst wird die Terminart gewählt; danach zeigt die Seite nur die dafür wichtigen Angaben.

## Ablauf
1. **Terminart zuerst wählen**
   - Direkt unter dem Seitentitel erscheint eine gut erkennbare Auswahl mit fünf Arten:
     - Höhenflug
     - Grundkurs
     - Experienced Anlass
     - Camp’Air
     - Vortrag
   - Die gewählte Art steuert sofort den restlichen Inhalt der Maske.
   - Keine Wiederholungen oder Terminserien.

2. **Beide Einstiege vereinheitlichen**
   - Der Einstieg über die allgemeine Terminliste und jener über die Flugschule öffnen garantiert dieselbe Erfassungsseite.
   - Beim Einstieg über die Flugschule wird die ausgewählte Flugschule automatisch übernommen.
   - Beim allgemeinen Einstieg bleibt die Gruppenauswahl sichtbar und erforderlich.
   - Zurück-Navigation und Ziel nach dem Speichern richten sich nach dem Einstieg.

3. **Passende Felder je Terminart**
   - **Höhenflug:** Datum/Zeit, Status, Treffpunkte, Rückreise, Fluggebiet, Tagesthema, Fluglehrer und Starthelfer aus Mitgliederlisten, Anmeldung/Platzlimit, Briefing-Zuteilung, Manöver, Flugvorbereitung und Mitteilung.
   - **Grundkurs:** Datum/Zeit, Kursort, Leitung aus Mitgliederliste, Anmeldung/Platzlimit, Materialhinweise, Tagesinhalte und Beschreibung.
   - **Experienced Anlass:** Datum/Zeit, Ort oder Fluggebiet, erforderliches Niveau, Leitung aus Mitgliederliste, Anmeldung/Platzlimit, Programm und Beschreibung.
   - **Camp’Air:** Start- und Enddatum, Ziel/Unterkunft, Reiseinformationen, Leitung aus Mitgliederliste, Anmeldung/Platzlimit, Programm und Beschreibung.
   - **Vortrag:** Datum/Zeit, Veranstaltungsort, Referent aus Mitgliederliste oder als freier Name, Thema, Anmeldung/Platzlimit und Beschreibung.
   - Gemeinsame Pflichtfelder werden kompakt zusammengefasst; nicht relevante Höhenflug-Felder bleiben bei anderen Arten verborgen.

4. **Speichern und Bearbeiten konsistent machen**
   - Die fünf Arten werden eindeutig gespeichert und in Terminliste sowie Detailansicht passend benannt.
   - Bestehende Termine bleiben bearbeitbar; alte Kategorien werden beim Laden sinnvoll auf die neuen fünf Arten abgebildet.
   - Beim Wechsel der Art werden bereits eingegebene gemeinsame Angaben behalten, während ungeeignete Felder nicht versehentlich in Mitteilungen erscheinen.

5. **Darstellung und Sprachen**
   - Klare, mobile Abschnitte statt einer langen alten Gesamtmaske.
   - Deutsche, französische und englische Texte für Arten, Abschnitte, Felder und Fehlermeldungen ergänzen.
   - Die Auswahl und die jeweils angepasste Maske auf Mobilformat prüfen, jeweils über beide Einstiege.

## Technische Details
- Die bestehende Terminseite wird zur einzigen gemeinsamen Erfassung ausgebaut; der `group`-Parameter des Flugschul-Einstiegs wird tatsächlich ausgewertet.
- Die Kategorien werden auf `height_flight`, `basic_course`, `experienced`, `camp_air` und `lecture` vereinheitlicht. Bestehende Werte `multi_day` und `school_event` erhalten eine kompatible Zuordnung.
- Bereits vorhandene Termin- und Programmfelder werden wiederverwendet. Nur Angaben, die damit nicht eindeutig abbildbar sind, werden als zusätzliche strukturierte Felder ergänzt.
- Die Wiederholungs-/Serienlogik bleibt vollständig aus der Oberfläche und aus der Neuanlage entfernt.
