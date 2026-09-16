# Betrieb der Flugschule: Vergleich mit Markus' App und Konzept

Ziel dieser Runde: kein Bauen, sondern eine klare Übersicht, was Flyary heute
schon abdeckt, was aus Markus' Ansatz fehlt und in welcher Reihenfolge es
ergänzt würde. Zugriff später: Schulleitung und Fluglehrer.

## Was Flyary heute schon hat

- Fluggebiete und Startplätze: Orte mit Karte, Höhe, Land, Detailseiten
- Schüler*innen: Personen-Übersicht der Flugschule mit Ausbildungsstand,
  Flugzahl, Prüfungsfortschritt, CSV-Export
- Staff: Funktionen pro Person (Schüler, Brevetiert, Starthelfer, Fluglehrer,
  Schulleitung) und Einteilung pro Termin (mit Position)
- Schulungstage: Termine mit Art (Höhenflug, Grundkurs, Experienced, Camp'Air,
  Vortrag), Anmeldung, Warteliste, Programm, Briefing, Gruppenchat, Push
- Fahrgemeinschaften pro Termin (Fahrer, Plätze, Abfahrtsort/-zeit)
- Material nur privat pro Pilot: eigene Schirme mit Check- und
  Reservepack-Daten – kein Schulmaterial

## Was aus Markus' App fehlt

1. **Schulmaterial**: Bestand der Schule (Schirme, Gurtzeuge, Helme, Funk),
   Ausgabe pro Person und Schulungstag, Rückgabe, Zustand/Checkdaten
2. **Abrechnung**: Fahrtkosten und Materialmiete/-kauf pro Person und Termin,
   offene Posten, Export für die Buchhaltung
3. **Startleiter-Guthaben**: Einsätze der Starthelfer als Guthaben, Auf- und
   Abbau des Kontos, Saldo pro Person
4. **Statistiken**: Fluglehrer (Einsatztage, betreute Schüler) und Fluggebiete
   (Nutzung durch die Schule, Termine pro Gebiet)

## Vorgeschlagene Reihenfolge

Deine Priorität war: Material → Statistiken → Startleiter-Guthaben →
Abrechnung. Sinnvoll ist eine leichte Anpassung, weil Abrechnung auf Material
und Termindaten aufbaut:

1. **Schulmaterial** – Inventar der Schule und Ausgabe/Rückgabe pro Termin
2. **Statistiken** – aus vorhandenen Termin-, Einteilungs- und Ortsdaten
   sofort möglich, ohne neue Erfassung
3. **Startleiter-Guthaben** – aus der Termin-Einteilung automatisch gutschreiben
4. **Abrechnung** – Fahrtkosten und Materialposten zusammenführen, Export

Jeder Schritt wird einzeln geplant und freigegeben.

## Nächster Schritt

Damit ich Schritt 1 sauber planen kann, brauche ich von Markus bzw. der Schule:

- Welche Materialarten und wie viele Stück gibt es?
- Wird Material pro Tag oder pro Kurs abgegeben?
- Welche Ansätze gelten für Fahrtkosten und Materialmiete?
- Wie entsteht ein Startleiter-Guthaben (pro Einsatz, pro Stunde, in Franken)?

## Technische Notizen

Neue Tabellen wären nötig für: `school_equipment` (Inventar pro Gruppe),
`equipment_assignments` (Ausgabe/Rückgabe je Person und Termin),
`launch_leader_credits` (Buchungen mit Saldo), `billing_items` (Posten pro
Person, Termin, Typ, Betrag). Zugriff über die bestehenden RLS-Helfer
`is_group_staff` / `is_group_admin`; Statistiken über RPCs auf
`flight_events`, `event_staff`, `locations`. Betriebsdaten bleiben damit auf
Schulleitung und Fluglehrer beschränkt.
