# Flyary

## Schülerdossier

Die Schülerliste öffnet ein schulbezogenes Dossier unter
`/school/students/:groupId/:studentId` statt des öffentlichen Pilotenprofils.
Die bestehende Schülerauswahl samt Aktiv-/Alle-Filter bleibt erhalten.

- Übersicht: Schülerstatus mit Grund/Datum, Ausbildungsstand (bearbeitbar),
  SHV-Nummer, Prüfungsdaten, Prüfungsmanöver-Fortschritt, letzter Schulflug,
  nächster Lernschritt und nächste Anmeldungen inklusive Warteliste.
- Ausbildung: Kontrollblatt mit Bewertungen und Notizen, nach Ausbildungsstufe filterbar.
  Die Bewertungen sind keine formelle Prüfungsfreigabe.
- Flüge: alle mit dieser Schule geteilten Flüge, Kommentare und Coaching-Notizen,
  in Seiten zu 30 Einträgen nachladbar. Private Flüge und Flüge anderer Schulen
  werden nicht in das Dossier übernommen.
- Tagesnotizen: eigene chronologische Liste mit Verfasser, Sichtbarkeit,
  Flugslot, Tageszusammenfassung und nächsten Schritten; ebenfalls nachladbar.
  Die Slots F1–F6 werden nicht künstlich einzelnen Flugbucheinträgen zugeordnet.
- Material: Ausrüstungscheck, laufende und zurückgegebene Schulausleihen mit
  Rückgabe-/Prüfterminen sowie hinterlegte eigene Schirme und Materialangaben.
- Abrechnung: bestehende offene/bezahlte Abrechnungsposten der Person in dieser
  Schule, CHF-Summen und Zahlungsdatum. Formelle Rechnungen und Online-Zahlungen
  bleiben Teil der späteren Phase 4.

**Auslieferung:** Migration `drizzle/migrations/0017_student_dossier.sql` muss vor
diesem Frontend angewendet werden. Sie wurde am 23.09.2026 live in einer Transaktion
ausgerollt; Migrationseintrag, Funktionsrechte und beide SELECT-Policies wurden
verifiziert. Alle sechs Dossierbereiche wurden anschliessend mit einem bestehenden
Schulpersonal-/Schülerkontext unter der Rolle `authenticated` lesend geprüft.
Der PostgREST-Schema-Cache wurde zum Neuladen benachrichtigt.
Der Dossier-RPC prüft Schule, Mitgliedschaft und Schulpersonal serverseitig und
verwendet RLS. Neue SELECT-Policies erlauben Schulpersonal das Lesen des
Ausbildungsfortschritts und der Flug-Coaching-Notizen. Ein separat geschützter
Profil-RPC gibt ausschliesslich die benötigten Ausbildungs-/Identifikationsfelder
zurück; Gesundheitsdaten, Notfallkontakte und Zugangsdaten gehören nicht zur Antwort.
Die internen Dossier-Abfragen laufen per POST, ohne PWA-GET-Cache, und mit
konten-, schul- und schülerspezifischen Query-Keys.

**Prüfung:** 181 Tests, Produktionsbuild, TypeScript-Prüfung und ESLint der
neuen Dateien erfolgreich. Datenbanktests prüfen alle sechs Dossierbereiche,
die Paginierung sowie Ablehnung fremder Schulen, Schüler und Starthelfer.
UI-Tests prüfen den Einstieg aus der Schülerliste, Kontextbindung, Nachladen und
Fehler-/Wiederholungszustände. Ein manueller Durchlauf mit echten Schulkonten
steht vor der Veröffentlichung noch aus.

## UX-Fortsetzung: Rollen und Tagesabläufe

Die unterbrochene UX-Arbeit wurde am 22.09.2026 ergänzt: kontobezogener Rollen- und
Schulwechsel, eigene Schulnavigation, Team-Einstieg für Starthelfer, passende
Ausbildungsfilter und Coaching-Notizen mit geordnetem Autosave und Fehleranzeige.
Neue Texte sind in DE/FR/EN vorhanden. Vergangene Coaching-Tage zeigen weiterhin
auch inzwischen pausierte Schüler; bei aktuellen Teilnehmerlisten lassen sie sich
einblenden. Ausbildungsbewertungen haben getrennte, beschriftete Bedienelemente.

**Auslieferung:** Vor dem Frontend muss `drizzle/migrations/0016_role_journeys.sql`
nach Migration 0015 angewendet werden. Sie erlaubt dem Schulpersonal das Speichern
der Tagesnotizen, unterstützt die Tagespause und liefert inaktive Schüler-IDs.
Die Migration wurde lokal mit PostgreSQL/PGlite getestet und am 22.09.2026 auf der
Live-Datenbank nach Migration 0015 in einer Transaktion angewendet. Migrationseintrag,
Notiz-Policies, Tagespause-Prüfregel und Funktionsrechte wurden anschliessend geprüft;
der PostgREST-Schema-Cache wurde zum Neuladen benachrichtigt.

**Prüfung:** 172 Tests erfolgreich, einschliesslich Autosave bei Folgeänderungen und
Fehlern, Ausbildungsfiltern, Übersetzungsschlüsseln und SQL-Zugriffsregeln.
TypeScript-Prüfung und Produktionsbuild erfolgreich. Der globale ESLint-Lauf ist
wegen zahlreicher Meldungen im Repository (überwiegend `no-explicit-any`) nicht grün.
Ein manueller Durchlauf mit echten Pilot-, Fluglehrer- und Starthelferkonten steht aus.
Fehlgeschlagene Notizentwürfe bleiben während der Sitzung im Arbeitsspeicher;
sie überstehen keinen Browser-Neustart. Bei offenen Änderungen warnt der Browser
beim Verlassen, soweit die Plattform dies unterstützt.

## Performance-Optimierungen

Messwerte, Prüfungen und Auslieferungsreihenfolge stehen in [docs/performance.md](docs/performance.md).
Vor dem aktualisierten Frontend muss die Migration `drizzle/migrations/0015_performance_read_models.sql` angewendet werden.

## App-weiter Audit nach Phase 5: i18n-Lücken und ein echter Berechtigungsfehler

Auf Wunsch des Nutzers, sicherzustellen dass „keine Bugs/Mismatches mehr“ in der App vorhanden
sind. Echtes Rollen-Testing im Browser war in dieser Umgebung nicht möglich (kein lauffähiges
Playwright-Setup, keine Testaccounts, `.env` zeigt auf eine echte Live-Supabase-Instanz – Schreiben
von Testdaten dorthin ohne Rückfrage wäre riskant gewesen). Stattdessen: Production-Build,
vollständiger Testlauf, i18n-Vollständigkeitsabgleich und ein gezielter Abgleich aller
`is_group_admin`-geschützten Tabellen gegen ihre UI-Gates (dieselbe Fehlerklasse, die bereits in
den Phasen-Audits mehrfach echte Bugs gefunden hat).

**i18n:** 8 Übersetzungslücken über drei Locales gefunden und geschlossen, keine davon durch diese
Session verursacht (teils seit der ursprünglichen Baseline vorhanden). Am gravierendsten: `de.json`
fehlten fast alle Texte des globalen [NotificationBell.tsx](src/components/NotificationBell.tsx)
(Titel, Leerzustand, Aktivitätstexte) – sichtbar für **jeden** Nutzer, nicht nur Flugschul-Rollen.
Ausserdem fehlten `goals.*`/`follows.*` komplett in `en`/`fr` und `training.grundkurs`/
`brevetkurs`/`siku`/`pilot` in `en`/`fr`. Alle drei Locale-Dateien sind jetzt exakt deckungsgleich
(1449 Schlüssel je Datei, per Skript verifiziert).

**Echter Berechtigungsfehler:** [SchoolPeople.tsx](src/components/school/SchoolPeople.tsx) zeigte
den „Funktionen zuweisen“-Button und die Funktions-Checkboxen im Bearbeiten-Dialog für jeden
Betrachter der Seite, weil [SchoolDashboard.tsx](src/pages/SchoolDashboard.tsx) `canManage` hart
auf `true` setzte – aber `group_member_functions` ist per RLS **admin-only**
(`is_group_admin`), nicht `is_group_staff` wie der Rest der Seite. Ein Fluglehrer oder Schulleiter
ohne Admin-Rolle sah damit Bedienelemente für eine Aktion, die serverseitig abgelehnt wird.
Schlimmer: `saveEdit()` prüfte den `error` der `insert`/`delete`-Aufrufe auf
`group_member_functions` gar nicht, sodass trotz abgelehnter Schreibung ein „Gespeichert“-Toast
erschien – ein „false success“, nicht nur eine überflüssig sichtbare Bedienoberfläche. Behoben
durch einen neuen, aus `group_members.role` abgeleiteten `isAdmin`-Prop für die Funktions-UI
(statt Hardcode) sowie explizite Fehlerprüfung in `saveEdit()` als zusätzliche Absicherung.
Ausbildungsstufen-Bearbeitung (RLS: `is_group_staff`) bleibt für alle Team-Rollen unverändert
verfügbar – nur die admin-only Funktionszuweisung wurde eingeschränkt.

Übrige stichprobenartig geprüfte `is_group_admin`-Policies (Event-Bearbeitung/-Löschung,
`flight_coach_notes`, `incident_reports`-Löschung, `challenge_goals`) waren bereits korrekt
gegen den jeweiligen UI-Zugriffspunkt abgeglichen – keine weiteren Funde.

## Fluggebiets-Wetter-Matching (Planung 7.3)

**Abweichung vom Plan (mit Nutzer abgeklärt):** Die im Akzeptanzkriterium referenzierte
"bestehende Windy-Einbindung" ist tatsächlich nur ein reines Bild-Iframe
(`embed.windy.com/embed2.html`, siehe [LocationDetail.tsx](src/pages/LocationDetail.tsx)) ohne
jeden JS-lesbaren Datenzugriff – dagegen lässt sich nichts programmatisch "abgleichen". Eine
echte Windy-API bräuchte einen kostenpflichtigen API-Key, den es nicht gibt. Auf Rückfrage hat
der Nutzer entschieden, stattdessen [Open-Meteo](https://api.open-meteo.com) zu verwenden
(kostenlos, kein API-Key, CORS-fähig, direkt vom Client aufrufbar). Das erfüllt den Grundsatz
"keine Speicherung von Wetterdaten" sogar wörtlicher als eine echte Windy-Anbindung: Der
abgerufene Wert lebt nur ephemer im Komponentenstand von `LocationDetail.tsx`, nirgends in der
Datenbank.

Neue Spalte `locations.optimal_wind_directions text[]` (8-Punkte-Kompass N/NE/E/SE/S/SW/W/NW),
editierbar in [Locations.tsx](src/pages/Locations.tsx) als Toggle-Buttons im Bearbeiten-Dialog.
Ampel-Anzeige (passend/grenzwertig/ungeeignet) nur auf der Ortsdetailseite, nicht auf der
separaten allgemeinen Wetterkarte ([Weather.tsx](src/pages/Weather.tsx)) – letztere zeigt keinen
einzelnen Ort mit hinterlegten optimalen Windrichtungen, ein Abgleich ohne Ortsbezug wäre nicht
sinnvoll möglich. `shv_approved`/`wind_sock`/`usage_permission_ref` aus der ursprünglichen
§3-Datenmodell-Zeile gehören zu anderen, noch nicht beauftragten Akzeptanzkriterien und wurden
nicht mitgebaut.

Kompass-Rundung, Match/Grenzwertig/Ungeeignet-Logik und das Parsen der Open-Meteo-Antwort in
[wind-match.ts](src/lib/wind-match.ts) extrahiert und getestet.

## Flugschule: Auslastung, Erfolgsquote, SHV-Mindestleistungs-Ampel (Planung 11.1, 11.2)

Phase 4 (Administration und Zahlung) ist bewusst zurückgestellt bis nach dem Workshop mit
Vertical; Phase 5 (Reporting und Wetter-Integration) wurde vorgezogen. Dies ist der erste Teil
davon (11.1, 11.2); 7.3 (Fluggebiets-Wetter-Matching) folgt separat.

**11.1 Auslastung und Erfolgsquote:** Erweitert die bestehende Statistiken-Kachel
[SchoolStats.tsx](src/components/school/SchoolStats.tsx) um zwei neue Ranglisten (Auslastung pro
Kursart, betreute Schüler pro Fluglehrer – beide jahresfilterbar wie die bestehenden Kennzahlen)
und eine separat beschriftete Kachelgruppe „Ausbildungserfolg (gesamt)“.

**Abweichung vom Plan:** Erfolgsquote und Ausbildungsdauer sind bewusst *nicht* durch die
Jahresauswahl gefiltert – eine Ausbildung dauert typischerweise mehrere Jahre, eine
„Erfolgsquote 2025“ allein wäre nicht aussagekräftig. Stattdessen ein Gesamt-Kennwert über alle
Schüler der Schule, im UI klar so beschriftet (Hinweistext unter der Kachel). Datenquelle ist
`training_level_history` statt der im Plan vorgeschlagenen `training_progress` (Letzteres ist
eine reine Manöver-Bewertungstabelle pro Übungspunkt aus dem Kontrollblatt, keine
Stufenhistorie – dieselbe Begründung wie bereits beim SHV-Jahresbericht, Planung 4.4).
„Grundkurs → Brevet“ wird vokabular-agnostisch berechnet (frühester Historieneintrag bis
`licensed`), da `training_level`-Vokabulare zwischen Gruppen differieren (siehe Umsetzungsplan
Abschnitt 14). Abgebrochene Ausbildungen (`student_status_history`, Status „cancelled“) werden
aus dem Nenner der Erfolgsquote entfernt statt als Misserfolg gezählt, wie im
Akzeptanzkriterium gefordert. Der im Akzeptanzkriterium erwähnte „Vorjahresvergleich wie bei den
bestehenden Schulstatistiken“ wurde nicht umgesetzt: Die referenzierte bestehende Kachel bietet
selbst nur einen Jahres-Select ohne Delta-Anzeige zum Vorjahr – es existiert kein wiederverwendbares
Muster dafür.

**11.2 SHV-Mindestleistungs-Ampel:** Neue Ampel-Karte in
[SchoolOverview.tsx](src/components/school/SchoolOverview.tsx) (Flugschul-Übersicht), ebenfalls
über `training_level_history` berechnet. Schwellen: ≥3 Brevetierte in den letzten 3 Jahren =
grün, 1–2 = gelb, 0 = rot.

Aggregationslogik (Auslastung pro Kategorie, Schüler pro Fluglehrer, Erfolgsquote,
Ausbildungsdauer) in [school-performance.ts](src/lib/school-performance.ts), Ampel-Logik in
[annual-report.ts](src/lib/annual-report.ts) (dort bereits die verwandte
`licensedCompletionsInYear`-Funktion aus 4.4), beide getestet.

## Empfänger-Übersicht Lesebestätigung: zu enge UI-Sichtbarkeit behoben (Nachtrag zu Planung 8.4)

Bei der Akzeptanzkriterien-Prüfung von Phase 3 aufgefallen: Die „X von Y bestätigt“-Übersicht in
[GroupChat.tsx](src/components/GroupChat.tsx) war hinter dem `canAnnounce`-Prop versteckt. Dieser
Prop wird von aufrufenden Seiten uneinheitlich gesetzt – `SchoolDashboard.tsx` übergibt immer
`true`, der reguläre Gruppenchat in `GroupDetail.tsx` dagegen nur `isAdmin`. Normale Mitglieder
im regulären Gruppenchat sahen die Übersicht dadurch nie, obwohl weder die RLS-Policy auf
`announcement_read_receipts` noch das Akzeptanzkriterium das verlangen – dokumentiert war sogar
explizit das Gegenteil. Behoben durch Entfernen der `canAnnounce`-Bedingung für die Übersicht;
der „Kenntnis bestätigen“-Button war davon nicht betroffen (war nie hinter `canAnnounce`
versteckt).

## Flugschule: Team-Verfügbarkeitsumfrage (Planung 8.5)

Neue Tabellen `team_polls`/`team_poll_responses`, sichtbar im Team-Kanal (Planung 6.3), umgesetzt
in [TeamPolls.tsx](src/components/school/TeamPolls.tsx), gerendert oberhalb des Team-Kanal-Chats
im „teamChat“-Bereich von [SchoolDashboard.tsx](src/pages/SchoolDashboard.tsx).

**Abweichung vom Plan:** Antwortoptionen sind ein freies, kommagetrenntes `text[]`-Feld (Default
„Ja, Nein“) statt eines fixen Ja/Nein-Enums – das Akzeptanzkriterium spricht im Plural von
„Antwortoptionen“, Ja/Nein im Ziel ist nur das Beispiel, nicht die einzige zulässige Form.
Erstellen/Löschen einer Umfrage bleibt Team-Personal im engeren Sinn vorbehalten
(`is_group_staff`, wie bei Ankündigungen in 8.4), Abstimmen ist allen Team-Kanal-Mitgliedern
möglich (`is_group_team_member`, schliesst Startleiter mit ein). Der Empfänger-Kreis für die
Antwort-Übersicht wird – wie in [GroupChat.tsx](src/components/GroupChat.tsx) für 8.4 – client-
seitig aus Admins plus Team-Funktionen (`school_lead`/`instructor`/`launch_helper`) bestimmt.

Zähl-/Abgleichslogik (Stimmen pro Option, eigene Antwort, Ablaufprüfung, Options-Parsing) in
[team-polls.ts](src/lib/team-polls.ts) extrahiert und getestet.

## Flugschule: Lesebestätigung sicherheitsrelevanter Ankündigungen (Planung 8.4)

Erweitert die bestehende Ankündigungsfunktion in [GroupChat.tsx](src/components/GroupChat.tsx)
(`group_messages.is_announcement`, siehe Planung 6.3) statt eine neue Mitteilungs-Struktur zu
bauen: eine neue Spalte `requires_confirmation` und eine neue Tabelle
`announcement_read_receipts` (`message_id`, `user_id`, `confirmed_at`, `UNIQUE(message_id,
user_id)`). Gilt sowohl für den normalen Gruppenkanal als auch den Team-Kanal
(`is_team_only`).

**Abweichung vom Plan:** Die Empfänger-Übersicht ("gelesen/bestätigt vs. ausstehend") ist als
einzelne, aktive Bestätigungs-Aktion umgesetzt ("Kenntnis bestätigen"-Button), nicht als
automatisches Lese-Tracking beim blossen Anzeigen der Nachricht – ein Tap beweist tatsächliche
Kenntnisnahme, ein reines Rendern der Nachricht im DOM nicht (Zweck des Features laut Ziel:
"Nachweis, dass … tatsächlich angekommen ist"). Der Empfänger-Kreis für die Zähler ("X von Y
bestätigt") wird analog zu `is_group_team_member` clientseitig bestimmt: alle Gruppenmitglieder
im normalen Kanal, nur Admins + Team-Funktionen (`school_lead`/`instructor`/`launch_helper`) im
Team-Kanal. Anders als beim Notfall-Zugriffsprotokoll (Planung 12.3) ist die Empfänger-Übersicht
für **alle** Gruppenmitglieder sichtbar, nicht nur die Schulleitung – "wer hat gelesen" ist hier
der Zweck des Features selbst, keine schützenswerte Information.

Zähl-/Abgleichslogik (bestätigt vs. ausstehend, Duplikat-Erkennung) in
[announcement-receipts.ts](src/lib/announcement-receipts.ts) extrahiert und getestet.

## Flugschule: Notfall-Schnellzugriff & Zugriffsprotokollierung (Planung 8.3, 12.3)

Naiver Ansatz (Client liest Notfallfelder aus `profiles`, Log wird separat geschrieben) scheitert:
Migration `20260417064846` sperrt `blood_type`, `medical_notes`, `allergies`,
`emergency_contact_name`, `emergency_contact_phone` per `REVOKE SELECT` auf Spaltenebene für
`authenticated`/`anon` – die breite zeilenbasierte Policy "Group members can view profiles"
greift dafür nicht mehr. Stattdessen eine neue SECURITY-DEFINER-Funktion
`get_emergency_contact_info(_event_id, _target_user_id)`, die Berechtigung prüft (Team-Personal
der Termin-Gruppe via `is_group_staff`, Zielperson muss für den Termin angemeldet sein), die
Felder liest und den Zugriff protokolliert – alles in einem serverseitigen Schritt, damit keine
Lücke zwischen Lesen und Protokollieren entstehen kann (8.3 und 12.3 wurden deshalb als ein
Feature umgesetzt, wie im Plan selbst als "verknüpft" vermerkt).

`blood_type`/`allergies`/`medical_notes` werden nur zurückgegeben, wenn die betroffene Person die
bestehende Gesundheitsdaten-Einwilligung (`health_data_consent_at`, siehe
[Profile.tsx](src/pages/Profile.tsx)) erteilt hat. Notfallkontakt (Name/Telefon) ist davon
unabhängig, da er im Ernstfall unverzichtbar ist und keine Gesundheitsdaten im engeren Sinn sind.

Das Zugriffsprotokoll (`emergency_data_access_log`) trägt eine eigene `group_id`-Spalte statt sich
nur auf `context_event_id` abzustützen, damit die Sichtbarkeits-Policy ("nur für Schulleitung",
Akzeptanzkriterium aus 12.3) auch dann stabil bleibt, wenn ein Termin später gelöscht wird
(`context_event_id` ist deshalb `ON DELETE SET NULL`, nicht `CASCADE`). "Schulleitung" ist
`is_group_admin` oder die Funktion `school_lead`, ohne `instructor`/`launch_helper` – enger als
`is_group_staff`, das für den Zugriff selbst genügt.

UI: neuer Notfall-Button (Siren-Icon) direkt in der Teilnehmerliste
([EventDetail.tsx](src/pages/EventDetail.tsx)), sichtbar für alle Team-Rollen (nicht nur bei
Flugschul-Gruppen, da `isStaff` gruppenunabhängig berechnet wird), öffnet einen Dialog statt
mehrerer Menüs. Auswertungslogik (Konsens-/Datenverfügbarkeits-Prüfung, Fehler-Mapping der
RPC-Exceptions) in [emergency-access.ts](src/lib/emergency-access.ts) extrahiert und getestet.

## Flugschule: CSV-Export mit Pausierungs-Status (Nachtrag zu Planung 5.2)

Der CSV-Export der Personenübersicht enthielt Status, Grund und Datum der letzten Statusänderung
nicht (nur Name, Stufe, Flüge, Prüfungsfortschritt, letzte Zusammenfassung) – bei der
Akzeptanzkriterien-Prüfung von Phase 2 als Lücke fürs Reporting aufgefallen. Drei Spalten
ergänzt (Status, Grund, Status seit); der Status wird übersetzt ausgegeben, Grund/Datum bleiben
bei aktiven Schülern ohne erfasste Änderung leer statt "aktiv" ohne weitere Angaben vorzutäuschen.
Der Export bleibt bewusst ungefiltert (exportiert immer alle Schüler unabhängig vom
Bildschirmfilter, siehe Abschnitt 5.2 oben). CSV-Aufbau und -Escaping nach
[student-csv.ts](src/lib/student-csv.ts) extrahiert und getestet.

## Flugschule: Strukturierter Geh/Nogo-Entscheid (Planung 7.1)

Neue, eigenständige Tabelle `event_weather_decisions` statt Erweiterung von
`flight_events.status`: dessen Enum `event_status` (`announced`/`confirmed`/`cancelled`) wird
app-weit für alle Gruppentypen verwendet, nicht nur Flugschulen, an vielen Stellen ausserhalb
dieses Features. Einen vierten Wert ("wetterabhängig") dort einzuführen, hätte jede bestehende
`status === 'confirmed'`/`'cancelled'`-Prüfung im ganzen Code auf Vollständigkeit prüfen müssen.
Bei den beiden Statuswerten, die eine Entsprechung in `event_status` haben (bestätigt/abgesagt),
wird `flight_events.status` beim Speichern synchron mitgesetzt, damit bestehende Logik – allen
voran [Abschnitt 7.2](src/components/school/AlternativeDateSuggestion.tsx), das exakt auf
`status === 'cancelled'` reagiert – unverändert weiterfunktioniert. "Wetterabhängig" hat keine
Entsprechung und bleibt ohne Sync.

Der Statuswechsel löst automatisch eine Push-Benachrichtigung an alle angemeldeten Teilnehmenden
aus – Wiederverwendung der bestehenden `notify-event-participants`-Edge-Function (Kapitel 10, bereits genutzt von
[EventAnnounceDialog.tsx](src/components/EventAnnounceDialog.tsx)), nicht neu gebaut. Die
Benachrichtigung feuert nur bei einer tatsächlichen Statusänderung, nicht bei jeder Bearbeitung
von Frist oder Notiz (sonst hätte jede kleine Korrektur unnötig erneut alle Teilnehmenden per
Push gestört).

Die "Erinnerung an die Deadline" ist als In-App-Hinweis umgesetzt (rot markiert, sobald die
Frist verstrichen ist und noch kein Entscheid erfasst wurde), nicht als automatischer
Erinnerungs-Push zu einem festen Zeitpunkt vor der Frist – dafür bräuchte es eine
serverseitige Zeitplanung (z. B. `pg_cron`), die in diesem Projekt noch nicht existiert und den
Rahmen dieses Einzelfeatures sprengen würde.

## Flugschule: Interner Team-Kanal (Planung 6.3)

Der Plan schlägt eine dedizierte "Team"-Gruppe pro Schule vor (Wiederverwendung von
`group_messages`, keine neue Tabelle). Eine echte zusätzliche `groups`-Zeile hätte aber
laufend synchronisierte Mitgliedschaft gebraucht und wäre in mehreren anderen Gruppenlisten der
App aufgetaucht (Gruppenübersicht, Termin-Erstellung, Schulauswahl im Flugschul-Bereich), die
alle nicht wissen, dass es sich um einen internen Hilfs-Datensatz handelt und ihn fälschlich als
normale, auswählbare Gruppe anzeigen würden. Stattdessen: `group_messages.is_team_only`, dessen
Sichtbarkeit live über `group_member_functions` geprüft wird (wie bei `is_group_staff`), ohne
Mitgliedschaft zu duplizieren. `group_messages` selbst bleibt wie im Plan gefordert unverändert
wiederverwendet – nur die Zugriffsregel kommt hinzu.

Zugriff hat, wer Schulleitung, Fluglehrer oder Starthelfer ist (`is_group_team_member`, bewusst
weiter gefasst als `is_group_staff`, das Starthelfer ausschliesst – der Plan nennt "Fluglehrern/
Startleitern" ausdrücklich als Zielgruppe). Der bestehende Ankündigungs-Push
([push_on_group_announcement](drizzle/migrations/0009_team_channel.sql)) wurde angepasst, damit
er bei `is_team_only` nur an Teamfunktionen zustellt statt – wie es die unveränderte
Originalfunktion getan hätte – den Nachrichtentext eines internen Team-Announcements per Push an
alle Schüler zu senden. Anhänge sind im Team-Kanal deaktiviert: Der Storage-Bucket für
Chat-Anhänge kennt nur Gruppenmitgliedschaft, nicht `is_team_only`, ein Schüler könnte bei
bekanntem Objektpfad sonst direkt auf Team-Anhänge zugreifen, auch ohne die zugehörige Nachricht
lesen zu können.

## Flugschule: Übergabenotizen zwischen Fluglehrern (Planung 6.2)

Der Plan nennt `flight_coach_notes.is_next_step` als Datenmodell – diese Tabelle ist aber die
allgemeine, gruppenunabhängige Flug-Coaching-Notiz (ein Eintrag pro geloggtem Flug, RLS über
Gruppen-Admin), nicht die Flugschul-spezifische Tagesnotiz. Diese existiert bereits als
`student_day_notes` (pro Termin und Schüler, inkl. Sichtbarkeits-Toggle für den Schüler und
Carry-over der Zusammenfassung vom letzten Flugtag in [CoachDayView.tsx](src/components/CoachDayView.tsx))
und ist schon Quelle der bisherigen "letzten Zusammenfassung" in der Schüler-Übersicht – die
naheliegendere Erweiterungsstelle, ausdrücklich im Sinne von Abschnitt 14 des Plans ("fachliches
Zielbild, keine verbindliche DDL"). `is_next_step` wurde daher dort ergänzt (Migration 0008).

Die Zusammenfassungs-Notiz eines Termins lässt sich als „Nächster Schritt" markieren (Icon-Toggle
neben dem bestehenden Sichtbarkeits-Toggle). In der kompakten Terminansicht von CoachDayView
erscheint dafür ein Indikator-Icon je Schüler, ohne die Karte öffnen zu müssen. In der
Personenübersicht ([SchoolStudents.tsx](src/components/school/SchoolStudents.tsx)) wird die
zuletzt markierte Notiz hervorgehoben angezeigt – ermittelt über das tatsächliche Datum des
zugehörigen Termins (nicht die Abfragereihenfolge, die bei Supabase ohne `ORDER BY` nicht
garantiert ist), damit bei mehreren markierten Notizen über die Zeit zuverlässig die aktuellste
erscheint. Frühere Notizen bleiben unverändert in `student_day_notes` erhalten (ein Eintrag pro
Termin), es wird nichts überschrieben.

## Kontrollblatt: Meilenstein-Freigaben (Planung 5.3)

Ausbildungskategorien können eine Voraussetzungs-Kategorie referenzieren
(`training_categories.unlocks_after_category_id`); ist diese nicht zu 100 % abgeschlossen,
zeigt das Kontrollblatt ([Training.tsx](src/pages/Training.tsx)) eine Kategorie mit einem
dezenten Schloss-Badge samt Name der Voraussetzung. Wie im Plan explizit gefordert ("kein
hartes Blockieren") verhindert das nichts: Sterne-Bewertung und Navigation in die
Übungsdetails bleiben für gesperrte Kategorien uneingeschränkt möglich – der Fluglehrer
behält die fachliche Entscheidungshoheit, es gibt daher auch keinen separaten
"Freigabe aufheben"-Mechanismus, weil nichts aufzuheben ist.

`training_categories` ist ein globales, schulübergreifendes Curriculum ohne `group_id` und
wird wie bisher direkt per Migration gepflegt, nicht über eine App-UI. Migration
`0007_training_category_prerequisites.sql` setzt dafür das im Plan genannte Beispiel:
Höhenflüge erst nach abgeschlossenem Übungshang.

## Flugschule: Ersatztermin-Vorschlag bei Absage (Planung 7.2)

Termine einer Flugschulgruppe mit Status "abgesagt" zeigen dem Team einen Vorschlag für bis zu
drei Ersatztage, basierend auf der Team-Verfügbarkeit aus Abschnitt 6.1: gesucht wird ab dem Tag
nach dem ursprünglichen Termin (nicht ab heute, damit auch rückwirkend abgesagte Termine sinnvolle
Vorschläge liefern) über bis zu drei Wochen vorwärts nach den nächsten Tagen, an denen mindestens
ein aktuelles Teammitglied (Schulleitung/Fluglehrer/Starthelfer) sich als verfügbar eingetragen
hat – nicht zwingend die nächsten drei Kalendertage in Folge, sondern die nächsten drei Tage mit
tatsächlicher Verfügbarkeit. Verfügbarkeits-Einträge von Personen, die keine dieser Funktionen
(mehr) haben, zählen nicht mit. Ein Klick auf einen Vorschlag übernimmt die bestehende
Duplikat-Funktion (`/events/new?duplicate=…`), jetzt erweitert um einen optionalen
`date`-Parameter, der das Terminformular mit dem gewählten Tag vorausfüllt statt das Datum leer
zu lassen.

## Flugschule: Pausierungs-Status (Planung 5.2)

Die Statusverwaltung (aktiv/pausiert/abgebrochen mit Grund und Datum) griff bereits auf eine
Tabelle `student_status_history` zu, die als Migration fehlte – jede Statusänderung landete
dadurch nur im Browser-localStorage (nicht geräte-/sitzungsübergreifend) statt in der Datenbank,
und ein "Grund" wurde nirgends erfasst (immer `null`, obwohl in der UI-Datenstruktur bereits
vorgesehen). Migration `0006_student_status_history.sql` ergänzt die Tabelle; die
localStorage-Umgehung entfällt zugunsten des im Projekt etablierten Musters: eine
Statusänderung erscheint erst nach bestätigter Speicherung, bei einem Fehler springt die
Anzeige auf den vorherigen Stand zurück und ein Toast informiert. Beim Ändern des Status fragt
ein Dialog neu nach einem optionalen Grund; Grund und Datum der letzten Änderung werden bei
pausierten/abgebrochenen Schülern in der Personenübersicht angezeigt.

Die Personenübersicht zeigt standardmässig nur aktive Schüler (Filter aktiv/alle, analog zum
bestehenden Muster im Material-Bereich); pausierte/abgebrochene bleiben über "Alle" weiterhin
erreichbar und damit im Kontrollblatt/Flugbuch nachvollziehbar, verschwinden aber aus der
Standardansicht der aktiven Terminplanung. Der CSV-Export bleibt bewusst ungefiltert (exportiert
immer alle Schüler unabhängig vom Bildschirmfilter).

## Flugschule: Verfügbarkeitsplanung Team (Planung 6.1)

Unter **Verfügbarkeit** trägt das Team (Schulleitung, Fluglehrer, Starthelfer) pro Tag eine
Wochenansicht mit drei Zuständen (verfügbar/unsicher/nicht verfügbar, optional mit Notiz) ein –
ein Klick auf den eigenen Status zykelt weiter, ein weiterer Klick über "nicht verfügbar" hinaus
löscht den Eintrag wieder. Da die Flugschul-Ansicht insgesamt nur für Schulleitung/Fluglehrer
erreichbar ist, kann von dort aus auch für andere Teammitglieder eingetragen werden (z. B. wenn
ein Starthelfer die Abwesenheit telefonisch durchgibt); serverseitig bleibt es über RLS
abgesichert (jede Person darf ohnehin nur ihre eigenen Einträge schreiben, Staff zusätzlich alle).

Bei der Termin-Einteilung ([EventStaff.tsx](src/components/EventStaff.tsx)) werden die
vorschlagbaren Personen nach Verfügbarkeit für das Termindatum sortiert (verfügbar zuerst) und
mit ihrem Status markiert – als Empfehlung, kein Blocker, da nicht jede Person ihre Verfügbarkeit
zwingend vorab einträgt. Ist bereits jemand eingeteilt, der sich für diesen Tag explizit als
nicht verfügbar gemeldet hat, erscheint dafür ein eigener Hinweis. Zusätzlich – kombiniert mit
Abschnitt 4.2 – warnt die Ansicht, wenn für ein Flugschul-Termin noch niemand eingeteilt ist und
keine als verfügbar gemeldete Person ein gültiges Fluglehrer-Zertifikat hat.

## Flugschule: Vorfallmeldung – Schnellzugriff & Materialfilter (Planung 4.1, 9.2)

Das Formular zur Unfall-/Vorfallmeldung ist aus [IncidentReports.tsx](src/components/school/IncidentReports.tsx)
in [IncidentReportDialog.tsx](src/components/school/IncidentReportDialog.tsx) ausgelagert und wird jetzt an zwei
Stellen verwendet: in der Sicherheits-Übersicht (Liste + Formular) und als eigenständiger
Schnellzugriff direkt im Termin (`EventDetail.tsx`), sichtbar für Schulleitung/Fluglehrer bei
Terminen einer Flugschulgruppe, unabhängig vom Terminstatus. Der Termin ist beim Öffnen aus dem
Termin heraus vorausgewählt, lässt sich aber weiterhin ändern oder auf „kein Termin" setzen.

In der Materialliste lässt sich zusätzlich nach dem SHV-Typengeprüft-Attribut filtern (alle /
nur typengeprüft / nur nicht typengeprüft), kombinierbar mit dem bestehenden Status-Filter.

## Flugschule: Zertifikate und Unterrichtstage (Planung 4.2)

Unter **Sicherheit → Zertifikate** zählt die Übersicht unterschiedliche lokale
Kalendertage mit bestätigten, bereits begonnenen Terminen und Einteilung als
Fluglehrer. Der Zeitraum beginnt mit dem erfassten Ausstellungs-/Rezertifizierungsdatum,
frühestens vor drei Jahren. Mehrere Termine am selben Tag zählen einmal. Ohne
Ausstellungsdatum bleibt die Zahl unbekannt. Der Zielwert von 15 Tagen innerhalb
von drei Jahren stammt aus der Planung; die Einteilung dient als Datengrundlage,
nicht als separater Anwesenheitsnachweis.

Ablaufwarnungen berücksichtigen alle erfassten Zertifikatsarten und die nächsten
90 Kalendertage. Ein Zertifikat gilt am Ablaufdatum noch nicht als abgelaufen.
Ladefehler werden sichtbar angezeigt. Beim Speichern werden nur geänderte Einträge
geschrieben; Fehler lassen den Dialog mit den Eingaben offen. Änderungen werden pro
Zertifikat gespeichert: Bereits erfolgreiche Änderungen bleiben bei einem späteren
Fehler erhalten und werden beim Wiederholen übersprungen. Offline gibt es keine
lokale Speicherwarteschlange. Die bestehenden Datenbankrechte bleiben unverändert.

## Flugschule: Materialquote (Planung 4.3)

Grundkurs-Termine zeigen dem Schulteam eine Warnung bei weniger als zwei verfügbaren,
typengeprüften Schulschirmen pro drei Schüler (aufgerundet). Gezählt werden angemeldete
Schüler ohne Wartelistenplatz, die in dieser Schule weniger als drei unterschiedliche
Grundkurstage mit erfasster Anwesenheit vor dem Termin haben. Fehlende historische
Anwesenheiten führen vorsichtshalber dazu, dass Schüler weiter mitgezählt werden.

Als Inventareinheit dient `school_equipment.equipment_type = glider`; Zubehör zählt
nicht als zusätzliches Schirmsystem. Schirme im Service oder ausser Betrieb werden
nicht berücksichtigt. Offene Ausgaben an andere Personen werden abgezogen, Ausgaben
an die gezählten Teilnehmer werden einmal mitgezählt. Ein geplantes Rückgabedatum
allein gilt nicht als erfolgte Rückgabe; am Rückgabetag zählt das Gerät konservativ
noch als ausgegeben. Es handelt sich um eine Bestandsprüfung, keine Reservierung
oder Prüfung kompletter Ausrüstungssets.

Die Berechnung aktualisiert sich nach Änderungen der Anmeldeliste. Fehlgeschlagene
oder abgeschnittene Abfragen werden als unbekannter Status mit Wiederholen-Button
angezeigt. Eigenes Material kann die Schule weiterhin berücksichtigen; der Hinweis
blockiert keine Anmeldung. Datenbankstruktur und Zugriffsrechte bleiben unverändert.

## Flugschule: Ausrüstungscheck (Planung 5.1)

In der Schülerübersicht öffnet **Ausrüstung** die persönliche Checkliste für Helm,
Schuhwerk, Gurtzeug mit Protektor und Rettungsgerät. Änderungen werden erst nach
Bestätigung durch die Datenbank angezeigt; bei Fehlern bleibt der vorherige Stand
erhalten. Offline werden Änderungen nicht zwischengespeichert und nicht als erledigt
angezeigt. Fehlgeschlagene Abfragen lassen sich erneut laden.

Schüler sehen bei Höhenflug-Terminen ihrer Schule vor der Anmeldung einen Hinweis
auf fehlende Bestätigungen mit den betroffenen Gegenständen. Die Anmeldung bleibt
möglich, damit Leihmaterial berücksichtigt werden kann. Die vorhandene
`equipment_checks`-Tabelle und deren RLS-Regeln bleiben unverändert (Schüler lesen
ihre eigenen Checks, das Schulteam bearbeitet sie).

## Flugschule: Wartungsfristen (Planung 9.1)

Unter **Material → Wartung** lassen sich mehrere Prüf- und Wartungsfristen pro Gerät
erfassen und erledigen. Filter zeigen überfällige Fristen oder die nächsten 30 Tage.
Am Fälligkeitstag gilt eine Prüfung noch nicht als überfällig. Im Lager und bei der
Ausgabe erscheint eine Warnung für offene überfällige Wartungen sowie für das bisherige
Feld „Nächster Check“. Die Warnung verhindert die Ausgabe nicht.

Speicherfehler beim Erledigen bleiben sichtbar; der Eintrag wird erst nach bestätigter
Speicherung als erledigt angezeigt. Ohne Verbindung wird kein lokaler Wartungsabschluss
vorgemerkt. Ladefehler werden als unbekannter Wartungsstatus angezeigt.
Voraussetzung ist die bestehende Phase-1-Tabelle `equipment_maintenance` mit ihren
RLS-Regeln. Diese Ergänzung ändert keine Datenbankrechte.

## Flugschule: Jahresbericht – Ausbildungsstand pro Jahr (Planung 4.4)

`profiles.training_level` ist ein Live-Wert ohne Zeitbezug; für vergangene Berichtsjahre
liess sich daraus weder die Kursart-Verteilung noch „abgeschlossene Brevetierungen im
Berichtsjahr" korrekt rekonstruieren – der Jahresfilter wirkte sich nur auf die
Betriebstage/Monat aus, alle anderen Zahlen zeigten immer den heutigen Stand. Neue Tabelle
`training_level_history` protokolliert ab sofort jede Änderung mit Zeitstempel (ergänzt in
`set_member_training_level`). Für das aktuelle Jahr wird ohne Historieneintrag weiterhin auf
den Live-Wert zurückgegriffen; für vergangene Jahre ohne Historieneintrag gilt der
Ausbildungsstand als unbekannt statt geraten – sichtbar als eigene Zeile „Ausbildungsstand
unbekannt" mit Hinweistext. Änderungen vor Einführung dieser Erfassung bleiben unbekannt.

„Brevetiert {{Jahr}}" zählt neu Personen mit einem Wechsel zu `training_level = licensed`
innerhalb des gewählten Jahres (Zufluss), nicht mehr den aktuellen Bestand an Brevetierten.
Zusätzlich behebt dies einen Vokabular-Mismatch: `profiles.training_level` enthält sowohl
das ältere Schema (`grundkurs`/`brevetkurs`/`siku`, siehe Migration
`20260917075246_...sql`) als auch das neuere aus [SchoolPeople.tsx](src/components/school/SchoolPeople.tsx)
(`ground`/`altitude`/`exam_ready`/`licensed`) – die Kursart-Aufschlüsselung zeigt jetzt beide
Wertebereiche mit Übersetzung statt nur die neueren Werte zu zählen und den Rest stillschweigend
als „unbekannt" zu verbuchen. Diese beiden Vokabulare selbst sind nicht vereinheitlicht;
das bleibt eine offene, separate Aufräumarbeit im Bestandscode.

Ich möchte eine PWA mobile App, welche als Tagebuch für meine Gleitschirmflüge dient. Damit sollen Flugdaten (.ics) eingelesen werden. Orte (Startplätze und Landeplätze) erfasst werden können. Diese auf einer Karte anzeigen. Zu den einzelnen Flügen, sollen alle wichtigen Daten erfasst werden können und auch Fotos angehängt und YouTube Videos verlinkt werden.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://flyaryapp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8c75fe1e-bceb-41c1-8ee8-2d4a58373f69).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Datenbank-Migrationen

Die Schema-Historie ist auf zwei Ordner verteilt, weil Lovable die Art, wie Migrationen
geführt werden, unterwegs umgestellt hat:

- `supabase/migrations/` – die ursprüngliche Migrationsreihe. War lange historisch (bis ca. Mai
  2026), enthält aber inzwischen auch `20260921113000_flight_school_phase1.sql` – ein
  versehentliches Duplikat der Phase-1-Tabellen aus `drizzle/migrations/0002_...`, entstanden
  durch parallele Arbeit auf zwei Branches ohne Kenntnis voneinander. Siehe
  `drizzle/migrations/0004_reconcile_phase1_rls.sql` für den Hintergrund und die Bereinigung.
- `drizzle/migrations/` – die eigentlich vorgesehene neuere Migrationsreihe (ab Phase 1 der
  Flugschul-Erweiterungen, z. B. `0002_school_phase1_shv_compliance.sql`). `drizzle/schema.ts`
  ist absichtlich leer (`// auto-generated and intentionally left blank, do not edit`) – Drizzle
  wird hier nur als Migrations-Journal genutzt, nicht als ORM. Es gibt kein `drizzle-kit`-npm-Skript
  und keinen CI-Workflow, der eine der beiden Reihen automatisch anwendet; Lovable spielt
  Änderungen direkt gegen die produktive Datenbank ein.

Für einen Schema-Aufbau von Grund auf müssen **beide Ordner, in dieser Reihenfolge**, angewendet
werden: zuerst alle Dateien aus `supabase/migrations/`, danach alle aus `drizzle/migrations/`
(chronologisch nach Dateiname). Neue Migrationen ab Phase 1 der Flugschul-Erweiterungen gehören
in `drizzle/migrations/`.

### Bereinigung der doppelten Phase-1-Tabellen (`0004_reconcile_phase1_rls.sql`)

`20260921113000_flight_school_phase1.sql` (supabase) und `0002_school_phase1_shv_compliance.sql`
(drizzle) legen unabhängig voneinander dieselben fünf Tabellen an
(`incident_reports`, `instructor_certifications`, `equipment_maintenance`, `equipment_checks`,
`annual_report_submissions`), mit **unterschiedlichen RLS-Policies**. Welche der beiden zuerst
gegen die produktive Datenbank lief – und ob beide liefen – lässt sich aus dem Repo-Stand allein
nicht feststellen; es gibt keinen Zugriff auf eine Migrations-Tracking-Tabelle oder die DB selbst
im Rahmen dieser Arbeit.

Statt zu raten, macht `0004_reconcile_phase1_rls.sql` das Ergebnis unabhängig vom Ausgangszustand
eindeutig: Sie entfernt zuerst alle Policy-Namen, die aus beiden ursprünglichen Migrationen
stammen könnten (`DROP POLICY IF EXISTS`, dadurch idempotent), und legt danach einen einzigen,
definitiven Policy-Satz an. Zwei konkrete Abweichungen wurden dabei bewusst zugunsten der
strengeren/präziseren Variante aufgelöst:

- `incident_reports`: Löschen ist nur Admins vorbehalten, nicht jedem Staff-Mitglied (die
  supabase-Migration hatte hier eine pauschale Staff-Policy für alle Operationen).
- `instructor_certifications` und `equipment_checks`: Die betroffene Person kann ihre eigenen
  Zeilen lesen (z. B. liest [StudentEquipmentHint.tsx](src/components/school/StudentEquipmentHint.tsx)
  `equipment_checks` als der angemeldete Schüler selbst). War nur die supabase-Migration aktiv,
  gab es diese Selbstlese-Policy nicht – der Ausrüstungs-Hinweis hätte dann für Schüler dauerhaft
  "fehlend" angezeigt, unabhängig vom tatsächlichen Stand.

Die beiden ursprünglichen Migrationsdateien bleiben unverändert als historischer Beleg stehen;
nur `0004` verändert das tatsächliche Verhalten.
