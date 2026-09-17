# Offene Punkte und nächste Verbesserungen

Der Umbau-Fahrplan und das Testlauf-Paket für Vertical sind vollständig umgesetzt. Offen sind nur noch Dinge, die die Flugschule selbst eintragen muss — plus eine Handvoll echter Verbesserungen.

## Offen (keine Programmierarbeit, sondern Eintragen)

Stand heute in den Daten: Funktionen sind verteilt (7 Einträge für Schulleitung/Fluglehrer/Starthelfer). Aber:

- Es sind **keine Ansätze** gesetzt (Fahrtkosten, Miete, Startleiter-Guthaben) — die Vorschlagswerte müssen in „Material → Ansätze" einmal bestätigt werden.
- Es ist **kein Material** im Lager erfasst.
- Es hat **niemand Mitteilungen aktiviert** (keine einzige Push-Anmeldung im ganzen System) — die Höhenflug-Ankündigung erreicht damit noch niemanden.
- Bei den Terminen sind **keine Einteilungen und kein Tagesprogramm** hinterlegt.

## Vorgeschlagene Verbesserungen (nach Nutzen sortiert)

1. **Push wirklich zum Laufen bringen.** Eigene Seite „Mitteilungen" mit klarer Anleitung pro Gerät (iPhone braucht die installierte App), Testnachricht, und für die Schulleitung eine Liste „wer hat Mitteilungen aktiv" — damit vor einem Höhenflug sichtbar ist, wen die Nachricht erreicht.

2. **Termin duplizieren.** Höhenflüge unterscheiden sich meist nur im Datum. Ein Knopf „als Vorlage nehmen" spart bei jedem Termin die halbe Erfassung.

3. **Anwesenheit am Flugtag.** Beim Termin abhaken, wer da war; daraus entstehen automatisch Startleiter-Guthaben und Abrechnungsposten (Fahrtkosten, Miete) statt Handeingabe.

4. **Ausbildungsstand direkt im Team sichtbar und änderbar.** Heute geht das nur über die Schülerliste; Fluglehrer wollen es dort ändern, wo sie die Person sehen.

5. **Startseite im Flugschul-Modus.** Statt Kacheln zuoberst: nächster Termin mit Anmeldezahl, offene Notizen, offene Beträge — die drei Zahlen, die die Schulleitung täglich braucht.

6. **Abrechnung pro Person als Übersicht/PDF.** Heute nur CSV für die Buchhaltung; für den Schüler fehlt eine verständliche Aufstellung.

7. **Kleinerer Feinschliff.** Leerzustände mit einer klaren Handlung (Material, Ansätze, Guthaben, Abrechnung), Ladezustände einheitlich, Tippziele in den Listen vergrössern.

## Vorschlag zur Reihenfolge

Erst 1 und 2 (beides bremst den Testlauf direkt), dann 3, danach 4 und 5, zuletzt 6 und 7.

## Technische Hinweise

- Mitteilungen: neue Seite `src/pages/Notifications.tsx` plus Route; Empfängerliste über Count-Join `group_members` × `push_subscriptions` (eigene Security-Definer-Funktion, damit keine Endpoints sichtbar werden).
- Duplizieren: in `EventForm.tsx` Query-Parameter `?from=<eventId>` — lädt den Termin inkl. `event_briefing_tasks`, `event_maneuvers`, `event_staff`, `event_program_items` und legt sie als Kopie an.
- Anwesenheit: `event_signups.confirmed_by_school` als Anwesenheit nutzen oder neue Spalte `attended`; daraus Inserts in `launch_leader_credits` und `billing_items` mit Ansatz aus `school_rates`.
- Ausbildungsstand im Team: bestehende RPC `set_member_training_level` in `SchoolPeople.tsx` einbinden.
- i18n-Schlüssel für de/en/fr in jedem Schritt mitziehen.
