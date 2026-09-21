# Flugschul-Erweiterungen mit Vertical – Phase 1 (SHV-Grundlagen)

Die Spezifikation umfasst fünf Phasen. Ich setze sie in dieser Reihenfolge um und beginne mit Phase 1, weil dort das regulatorische Risiko liegt und alles andere darauf aufbaut. Alles landet im bestehenden Flugschul-Bereich (keine Parallelstruktur), dreisprachig, mobil zuerst.

## Was in Phase 1 entsteht

**1. Vorfall melden (Unfall/Vorfall)**
Neue Kachel „Sicherheit" im Flugschul-Bereich plus Schnellzugriff „Vorfall melden" im Termin. Formular: Datum/Zeit, beteiligte Personen, Hergang, Massnahmen, optional verknüpfter Termin/Flug. Liste zeigt „noch X von 10 Tagen" bis zur SHV-Frist, Status offen/eingereicht, Druck-/PDF-Ausgabe im Behördenlayout. Nur Schulleitung und Fluglehrer sehen und erfassen das.

**2. Zertifikate im Team**
Pro Teammitglied Zertifikate (Fluglehrer, Startleiter, Biplace 1–3, Nothelfer) mit Ablaufdatum. Unterrichtstage werden automatisch aus den Termin-Einteilungen gezählt. Warnung im Team, wenn ein Zertifikat in 90 Tagen abläuft oder 15 Unterrichtstage in 3 Jahren nicht erreicht sind; Warnung bei der Einteilung, wenn niemand mit gültigem Fluglehrer-Zertifikat eingeteilt ist.

**3. Material: Wartungsfristen und SHV-Kennzeichnung**
Pro Gerät mehrere Fälligkeiten mit Typ (Rettung neu packen, Gurtzeug-Check, Schirm-Check). Warnindikator am Gerät, Warnung bei der Ausgabe eines überfälligen Geräts, Übersicht „fällig in 30 Tagen". Zusätzlich Merkmal „SHV-typengeprüft" mit Filter in der Materialliste.

**4. Ausrüstungscheck beim Schüler**
Reiter „Ausrüstung" im Ausbildungsplatz: Helm, Schuhwerk, Gurtzeug mit Protektor, Rettungsgerät – je vom Fluglehrer als vorhanden/fehlt markierbar. Ist etwas offen, erscheint bei der Anmeldung zu einem Höhenflug ein Hinweis (kein Blockieren, Leihmaterial ist möglich).

**5. Materialquote pro Termin**
In der Tagesorganisation eines Termins Hinweis, wenn für die Anmeldungen weniger als 2 typengeprüfte Systeme pro 3 Schüler verfügbar sind (Hinweis, kein Blocker).

**6. Jahresbericht**
Neuer Abschnitt in den Statistiken: Kennzahlen pro Kalenderjahr (Schüler nach Kursart, Brevetierungen, Betriebstage pro Monat, Team mit Zertifikatsstatus) als PDF und CSV, Markierung „eingereicht", ab Januar eine Erinnerung solange der Vorjahresbericht offen ist.

## Reihenfolge und weitere Phasen

Phase 1 wie oben (4 → 5 → 3 in der technischen Abhängigkeit). Danach nach Absprache: Phase 2 (Schüler-/Team-Prozesse: Pausierung, Meilenstein-Freigaben, Verfügbarkeit, Übergabenotizen, Geh/Nogo, Ersatztermin, Team-Kanal), Phase 3 (Minderjährige, Einwilligungen, Notfall-Schnellzugriff, Lesebestätigung, Team-Umfrage), Phase 4 (Zahlung, Gutscheine, Rechnungsexport), Phase 5 (Auslastung/Erfolgsquote, Wetter-Matching).

Zwei Punkte kläre ich vor Phase 4 mit dir ab: Zahlungsanbieter (Stripe oder TWINT-fähig) und die Aufbewahrungsdauer bei Kontolöschung.

## Technische Umsetzung

- Migrationen, je Feature einzeln, mit GRANT + RLS nach bestehendem Muster (`is_group_staff` / `is_group_admin`): neue Tabellen `incident_reports`, `instructor_certifications`, `equipment_maintenance`, `equipment_checks`, `annual_report_submissions`; Spalte `school_equipment.shv_type_approved`.
- Neue Komponenten unter `src/components/school/`: `SchoolSafety.tsx` (+ `IncidentReportForm.tsx`), `TeamCertifications.tsx`, `EquipmentMaintenance.tsx`, `StudentEquipmentCheck.tsx`, `AnnualReport.tsx`; Einbindung über `SECTION_GROUPS` in `SchoolDashboard.tsx` (neue Section `safety`).
- Zertifikats-/Quoten-Warnungen in `SchoolPeople.tsx`, `EventStaff.tsx` und `EventDetail.tsx`; Ausrüstungs-Hinweis in `Events.tsx` / `use-dashboard-data.ts` beim Anmelden.
- PDF-Ausgaben über das bestehende Druckfenster-Muster aus `SchoolBilling.tsx`; CSV über `src/lib/csv-export.ts`.
- Unterrichtstage-Zählung und Jahresbericht-Kennzahlen als Security-Definer-RPCs, damit keine Rohdaten an den Client gehen.
- Offline: Vorfallmeldung nutzt die bestehende Warteschlange (`src/lib/offline-queue.ts`).
- i18n-Schlüssel in `de.json`, `fr.json`, `en.json` bei jedem Schritt mitziehen; danach Doku-Kapitel ergänzen.
