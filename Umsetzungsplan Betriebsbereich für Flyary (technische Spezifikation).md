# Umsetzungsplan Betriebsbereich für Flyary (technische Spezifikation)

Stand: 2026-09-30 · Status: Plan, nichts umgesetzt · Entscheide von Tobias eingearbeitet (§12)

## 1. Ziel und Entscheid

Mit der Öffnung für Flugschulen und Testpiloten wachsen die Aufgaben des App-Betreibers: Zugänge vergeben und entziehen, Schulen einrichten, Fehler und Feedback bearbeiten, Backups überwachen, den Marktplatz moderieren, die Mailbox info@flyary.ch betreuen.

**Entscheid: vorerst keine eigene Admin-App.** Die Betreiberfunktionen werden in der bestehenden App in einem klar abgegrenzten **Betriebsbereich unter `/admin`** zusammengeführt. Begründung:

- Die Sicherheit liegt in der Datenbank (RLS, `SECURITY DEFINER`-RPCs mit Admin-Prüfung), nicht im Frontend. Eine zweite App würde dieselbe Supabase-Datenbank mit denselben RPCs nutzen und brächte keinen Sicherheitsgewinn.
- Eine zweite App verdoppelt Deploy, Login, Abhängigkeiten und den Abgleich von `types.ts` nach jeder Migration. Das passt nicht zu einem Ein-Personen-Betrieb.
- Der heutige Admin-Code ist klein: rund 570 Zeilen in 4 Seiten.
- Den grössten echten Sicherheitsgewinn bringt die **Zwei-Faktor-Anmeldung für Admin-Konten** (Schritt 5), nicht die Trennung der Apps.

Die Mailbox info@flyary.ch wird **nicht** in die App geholt (siehe Abschnitt 9).

## 2. Ist-Stand (geprüft am Code, 2026-09-30)

| Bereich | Heute | Code |
|---|---|---|
| Admin-Erkennung | `useAppAdmin()` → RPC `has_role(uid, 'admin')`; Rolle in `user_roles` (`app_role`: admin, moderator, user) | [use-app-admin.ts](src/hooks/use-app-admin.ts) |
| Einstieg | 3 einzelne Einträge unter «Mehr», nur für Admins | [More.tsx:161-168](src/pages/More.tsx#L161-L168) |
| Fehlermeldungen | `client_errors` (gruppiert nach Fingerprint, `resolved_at`), Seite `/admin/errors` | 0049, [AdminErrors.tsx](src/pages/AdminErrors.tsx) |
| Testliste / Zugänge | `pilot_waitlist`, `app_access`, `access_invites`; RPCs `create_access_invite`, `grant_app_access`; Seite `/admin/waitlist`; Einladung per `mailto:` | 0078, 0079, [AdminWaitlist.tsx](src/pages/AdminWaitlist.tsx), [app-access.ts](src/lib/app-access.ts) |
| Zugang entziehen | **fehlt**; es gibt nur Vergeben | – |
| Schulen anlegen | Im normalen Gruppen-Dialog; Typ «Schule» nur für Admins; Trigger `guard_school_groups` erzwingt das. Der Admin wird dabei **selbst Gruppen-Admin der Schule** | [Groups.tsx:34-62](src/pages/Groups.tsx#L34-L62), 0079 |
| Offizielle Startplätze | Seite `/admin/sites` | 0067, [AdminSites.tsx](src/pages/AdminSites.tsx) |
| Marktplatz-Moderation | Moderationswarteschlange; Admin plus Schul-Moderatoren | 0038, [MarketModeration.tsx](src/pages/MarketModeration.tsx) |
| Backups | `ops_backup_runs`, `ops_backup_alerts`, Push an Admins mit Link auf `/more`; keine Anzeige in der App | 0082 |
| Feedback | nur `mailto:info@flyary.ch` unter «Mehr» | [More.tsx:100](src/pages/More.tsx#L100) |
| Admin-Prüfungen in SQL | 22× `has_role(auth.uid(), 'admin')` in 8 Migrationen | 0032, 0038, 0039, 0049, 0067, 0078, 0079, 0082 |

**Zwei Befunde, die über reine Ordnung hinausgehen:**

1. **Kein Entziehen.** Ein Testpilot oder eine Schule lässt sich heute nicht sauber sperren. Ein gelöschter Eintrag in `app_access` würde zudem beim nächsten Gruppenbeitritt vom Trigger `grant_access_on_membership` wieder angelegt.
2. **Der Betreiber ist Mitglied jeder Schule.** Wer eine Schule anlegt, wird heute ihr Gruppen-Admin. Er sieht damit Schülerdaten, Ausbildungsstand und Bestätigungen, und als Schul-Admin kann er je nach Ausweis Flüge bestätigen (0077). Das ist für die Übergabe an die Schulleitung weder nötig noch erwünscht.

## 3. Übersicht der Schritte

| # | Schritt | Migration | Aufwand |
|---|---|---|---|
| 1 | Betriebsbereich `/admin`: Übersicht, Layout, Umzug der bestehenden Seiten, `is_ops_admin()` | ja (klein) | M |
| 2 | Zugänge verwalten: Übersicht, entziehen, wiederherstellen, Protokoll | ja | M |
| 3 | Schulen verwalten: anlegen ohne Mitgliedschaft, Einladung für die Schulleitung, Liste | ja | M |
| 4 | Feedback von Testern in der App, mit Screenshots | ja | M |
| 5 | Zwei-Faktor-Anmeldung (TOTP) für Admins | ja | M |
| 6 | Optional: Sentry für Fehlermeldungen | nein | S |

Reihenfolge: 1 schafft die Grundlage. 2 und 3 schliessen die Lücken für die Öffnung und kommen **vor** der Einladung weiterer Schulen. 4 folgt vor der breiten Einladung von Testern. 5 ist unabhängig, sollte aber vor der offiziellen Öffnung live sein.

Für jeden Schritt gilt der bestehende Ablauf: Migration in `drizzle/migrations/` mit RLS, Logik in `src/lib/*.ts` mit Vitest-Tests, i18n de/en/fr, README-Abschnitt, `typecheck`, `eslint`, `vitest` und `smoke` grün. Die Migration führt Tobias selbst aus, danach `gen-types`, eine lesende Prüfung, dann der Push. Die Migrationsnummern unten (ab 0083) sind Platzhalter.

## 4. Schritt 1: Betriebsbereich `/admin`

### 4.1 Datenbank (Migration `0083_ops_admin`)

- **`is_ops_admin()`**: `STABLE SECURITY DEFINER`, liefert `has_role(auth.uid(), 'admin')`. Diese eine Funktion ist künftig die Admin-Prüfung für alle Betreiberfunktionen. In Schritt 5 wird hier die Zwei-Faktor-Pflicht ergänzt, ohne die übrigen 22 Stellen einzeln anzufassen.
- Die bestehenden Policies und RPCs mit `has_role(auth.uid(), 'admin')` werden auf `is_ops_admin()` umgestellt (`CREATE OR REPLACE` bzw. Policies neu anlegen). **Nicht** umgestellt werden Stellen, an denen `has_role` mit einer fremden `_user_id` aufgerufen wird, etwa die Schleife über `user_roles` in `notify_admins_backup`.
- **`ops_overview()`**: gibt für die Übersichtsseite in einem Aufruf die Zähler zurück:
  - offene Testlisten-Einträge (`handled_at IS NULL`)
  - offene Fehler (`resolved_at IS NULL`) und davon neue der letzten 24 Stunden
  - offene Marktplatz-Meldungen, die der Admin bearbeitet
  - letzter Backup-Lauf (Zeit, ok/Fehler) und offene Backup-Alarme
  - ab Schritt 4: offenes Feedback

  Ohne Admin-Rechte bricht die Funktion mit Fehler `42501` ab.
- `notify_admins_backup`: Der Push-Link geht neu auf `/admin` statt `/more`.

### 4.2 Frontend

- Route `/admin` mit eigenem `AdminLayout`:
  - Auf dem Desktop eine Seitenleiste mit Übersicht, Zugänge, Schulen, Feedback, Fehler, Startplätze, Marktplatz, Backups.
  - Auf dem Handy eine einfache Liste. Die bestehende untere Navigation bleibt.
  - Alles wird als eigenes Paket nachgeladen (`lazy`).
- `AdminGuard`: Nicht-Admins werden auf `/` umgeleitet. Das ist nur Komfort, geschützt wird in der Datenbank.
- **Übersichtsseite**: Kacheln aus `ops_overview()`. Jede Kachel führt zur passenden Liste. Die Backup-Kachel zeigt die letzte Sicherung, rot ab 48 Stunden ohne erfolgreichen Lauf. Das entspricht der Schwelle von `check_backup_freshness`.
- Bestehende Seiten ziehen unter das Layout: `/admin/errors`, `/admin/waitlist` (wird in Schritt 2 zu «Zugänge»), `/admin/sites`. Die Marktplatz-Moderation erhält zusätzlich einen Eintrag im Betriebsbereich. Die Route `/market/moderation` bleibt für Schul-Moderatoren bestehen.
- «Mehr»: Die drei Admin-Einträge werden durch **einen** Eintrag «Betrieb» mit Zähler für offene Punkte ersetzt.
- Logik in `src/lib/ops-overview.ts`, z. B. Ampelregeln für die Backup-Kachel, mit Tests.
- Smoke: Fixture `ops_overview` in `scripts/smoke-routes.mjs`; Route `/admin` aufnehmen.

### 4.3 Abnahme

- Ein Nicht-Admin sieht keinen Eintrag «Betrieb»; der RPC-Aufruf von `ops_overview` scheitert mit `42501`.
- Alle bisherigen Admin-Funktionen arbeiten nach der Umstellung auf `is_ops_admin()` unverändert. Das wird mit den bestehenden Datenbanktests geprüft: `access-gate`, `pilot-waitlist`, `backup-monitoring`, `marketplace`, `site-admin-merge`.

## 5. Schritt 2: Zugänge verwalten

### 5.1 Datenbank (Migration `0084_access_revoke`)

- `app_access` erhält:
  - `revoked_at timestamptz`
  - `revoked_by uuid`
  - `revoke_reason text` (höchstens 300 Zeichen)
- `has_app_access()` prüft zusätzlich `revoked_at IS NULL` (die Ausnahme für `signup_mode = 'open'` bleibt).
- `grant_access_on_membership()` bleibt bei `ON CONFLICT DO NOTHING`. Ein gesperrtes Konto erhält also durch einen neuen Gruppenbeitritt **keinen** Zugang zurück. Das ist der Grund, weshalb gesperrt statt gelöscht wird.
- **`ops_admin_log`**: Protokoll aller Betreiberaktionen (`id, actor, action, target_user, target_group, detail jsonb, created_at`), nur für Admins lesbar, ohne direkte Schreibrechte. `grant_app_access`, `create_access_invite` und die neuen RPCs schreiben hinein.
- Neue RPCs, alle mit `is_ops_admin()`-Prüfung:
  - `ops_access_list(_filter text)`: Konten mit Name, E-Mail, Zugangsweg (`granted_via`), Datum, Status (aktiv/gesperrt), Schulmitgliedschaften und letzter Aktivität (letzte Anmeldung aus `auth.users.last_sign_in_at`). Die E-Mail kommt aus `auth.users` und nur über diesen RPC, nie über eine Tabellenfreigabe.
  - `revoke_app_access(_user_id, _reason)`: setzt `revoked_*` und protokolliert. Sich selbst oder einen anderen Admin sperren ist nicht erlaubt.
  - `restore_app_access(_user_id)`: setzt `revoked_*` auf NULL und protokolliert.
  - `revoke_access_invite(_invite_id)`: macht eine noch nicht eingelöste Einladung ungültig, z. B. bei falscher E-Mail-Adresse.
- `my_access()` liefert zusätzlich `revoked` (ja/nein). Der Wartebereich zeigt dann einen eigenen Text wie «Dein Zugang ist pausiert. Melde dich bei info@flyary.ch» statt der Testliste.

### 5.2 Frontend

- Seite **«Zugänge»**, ersetzt `/admin/waitlist`, mit drei Reitern:
  - **Testliste**: bisherige Funktion mit Freischalten und Einladungslink; zusätzlich «Einladung zurückziehen».
  - **Konten**: Suche, Filter (aktiv, gesperrt, ohne Zugang), Sperren mit Pflichtgrund, Wiederherstellen.
  - **Protokoll**: die letzten Einträge aus `ops_admin_log`.
- Logik (Filter, Statusberechnung, Texte) in `src/lib/app-access.ts` mit Tests.

### 5.3 Entscheid

- Das Sperren eines Kontos beendet seine **Schulmitgliedschaften nicht**. Es betrifft nur den App-Zugang. Mitgliedschaften und bestätigte Flüge bleiben erhalten, weil sie Nachweise der Schule sind.

## 6. Schritt 3: Schulen verwalten

### 6.1 Datenbank (Migration `0085_school_setup`)

- **`ops_create_school(_name, _description, _lead_email, _language)`**:
  - legt die Gruppe mit `group_type = 'school'` an, ohne den Admin als Mitglied (Trigger `guard_school_groups` lässt Admins zu)
  - erzeugt eine **Leitungs-Einladung**: einmalig, 14 Tage gültig, nur der Hash gespeichert, gleiches Muster wie `access_invites`
  - protokolliert und gibt den Link zurück
- **`school_lead_invites`**: `id, group_id, token_hash, email, language, created_by, created_at, expires_at, redeemed_by, redeemed_at, revoked_at`
- **`redeem_school_lead_invite(_token)`**: macht das einlösende Konto zum Gruppen-Admin der Schule und gibt ihm App-Zugang. Die Ergebnisse `invalid`, `expired` und `used` folgen demselben Muster wie `redeem_access_invite`.
- **`ops_school_list()`**: alle Schulen mit Anzahl Mitglieder, Anzahl Staff, Leitung (Name), offener Leitungs-Einladung, Erstelldatum und letzter Aktivität (letzter Flug oder Flugtag).
- **`ops_leave_school(_group_id)`**: Der Admin tritt aus Schulen aus, die er nach altem Ablauf angelegt hat. Das geht nur, wenn die Schule danach noch mindestens einen Gruppen-Admin hat.

### 6.2 Frontend

- Seite **«Schulen»**:
  - Liste aus `ops_school_list()`
  - Knopf «Schule einrichten»: Name, E-Mail und Sprache der Leitung; danach Link kopieren oder als `mailto:` im bestehenden Stil von `inviteMailto`
  - Hinweis bei Schulen, in denen der Admin noch Mitglied ist, mit Knopf «Austreten»
- Die Route `/welcome/<token>` erkennt auch Leitungs-Einladungen, z. B. über das Präfix `/welcome/lead/<token>`.
- Im Gruppen-Dialog ([Groups.tsx](src/pages/Groups.tsx)) entfällt der Typ «Schule»; dort steht der Hinweis «Schulen werden im Betriebsbereich eingerichtet».
- Die Onboarding-Pfade aus 0081 (`staff`) greifen nach dem Einlösen automatisch; beim Bau prüfen.

### 6.3 Entscheid und Übergang

- Ganze Schulen **pausieren** wird erst bei Bedarf gebaut. Für die Pilotphase reicht das Sperren einzelner Konten.
- Bestehende Schulen, in denen Tobias Admin ist (Vertical): austreten, sobald dort eine Leitung als Gruppen-Admin eingetragen ist.

## 7. Schritt 4: Feedback von Testern

### 7.1 Datenbank (Migration `0086_app_feedback`)

- **`app_feedback`**:
  - `id, user_id, kind (idee | problem | lob | frage), message (≤ 2000), path (≤ 300), app_version (≤ 60), user_agent (≤ 300), created_at, status (neu | in_arbeit | erledigt), admin_note (≤ 1000), handled_at`
  - RLS: Admins lesen alles und dürfen `status`, `admin_note` und `handled_at` ändern; das eigene Konto liest nur die eigenen Einträge.
- **`submit_feedback(_kind, _message, _path, _app_version, _user_agent)`**: Rate-Limit wie `report_client_error` (z. B. 10 pro Stunde und Konto). Gibt die `id` zurück, damit die App danach die Screenshots hochladen kann.
- **`finish_feedback(_id)`**: wird nach dem Upload aufgerufen. Erst dann geht der Push an alle Admins mit Link auf `/admin/feedback`, damit die Bilder beim Öffnen schon da sind. Scheitert der Upload, sendet die App trotzdem `finish_feedback`, und das Feedback erscheint ohne Bild.
- `ops_overview()` zählt offenes Feedback.

**Screenshots** (Entscheid: gehören dazu, sonst bringt das Feedback zu wenig):

- Privater Bucket **`feedback-screenshots`**: höchstens 1 MB pro Datei, nur `image/webp` und `image/jpeg`, gleiches Muster wie `marketplace-photos` (0033).
- Pfad `<user id>/<feedback id>/<n>.webp`. Das folgt der Regel, dass Upload-Pfade mit der Konto-ID beginnen.
- Höchstens **3 Bilder** pro Feedback.
- Storage-Policies:
  - Hochladen nur in den eigenen Ordner und nur zu eigenem Feedback, das noch nicht abgeschlossen ist (`finished_at IS NULL`).
  - Lesen für das eigene Konto und für Admins (`is_ops_admin()`).
  - Kein Überschreiben oder Löschen durch Nutzer.
- `app_feedback` erhält `screenshot_paths text[]` (höchstens 3) und `finished_at timestamptz`. `finish_feedback` prüft, dass die Pfade zum Feedback gehören.
- **Aufbewahrung**: Screenshots werden 90 Tage nach «erledigt» gelöscht, Feedback ohne Abschluss nach 1 Tag (abgebrochene Uploads). Der Text des Feedbacks bleibt erhalten.
  - Die Datenbank sammelt die Pfade (`feedback_daily_cleanup()`), eine Edge Function `feedback-cleanup` löscht die Dateien über die Storage API.
  - Zeitplan per `pg_cron` in einer eigenen Migration (`0087_feedback_cleanup_schedule`), gleiches Muster wie `marketplace-cleanup` (0039/0040).
- **Speicherbudget** (Free-Plan 1 GB): etwa 150–300 KB pro Bild nach Komprimierung. Bei 3 Bildern und 100 Feedbacks sind das höchstens rund 90 MB, durch die Löschfrist dauerhaft deutlich weniger. Die Belegung erscheint auf der Übersichtsseite (vorhandenes `storage-usage.ts` prüfen und wiederverwenden).

### 7.2 Frontend

- «Mehr» → «Feedback senden» öffnet einen kurzen Dialog statt `mailto:`:
  - Art, Text, Hinweis «Seite und App-Version werden mitgesendet»
  - **Screenshots anhängen** (bis 3): Auswahl aus der Galerie bzw. Dateiauswahl, mit Vorschau und Entfernen. Auf dem Handy macht der Tester vorher einen normalen System-Screenshot. Die Bilder werden vor dem Upload mit dem vorhandenen `compressImage` ([image-compress.ts](src/lib/image-compress.ts)) auf höchstens 1600 px und WebP verkleinert.
  - Hinweis im Dialog: «Achte darauf, dass keine fremden Daten sichtbar sind», weil Screenshots Namen oder Flugdaten anderer Personen zeigen können.
  - der Link «Lieber per E-Mail» bleibt als Ausweg
- **Ohne Screenshots:** Eine automatische Aufnahme der aktuellen Seite (z. B. mit `html-to-image`) wird nicht gebaut. Karten, Canvas und Videos werden damit oft leer oder falsch dargestellt, und die Bibliothek macht das App-Paket grösser. Der System-Screenshot zeigt genau, was der Tester sieht.
- Optional: Aus der Fehlerseite der `PageErrorBoundary` lässt sich direkt Feedback mit dem Fehlerpfad senden.
- Seite **«Feedback»** im Betriebsbereich: Liste mit Filter nach Status und Art, Vorschaubilder der Screenshots (Klick öffnet das Bild gross, über signierte URLs), Notiz, Status setzen, Antwort per `mailto:` an die E-Mail des Kontos (über einen Admin-RPC, wie in Schritt 2).
- Logik (Validierung, Kontexterfassung, Pfadaufbau, Grenzen für Anzahl und Grösse) in `src/lib/feedback.ts` mit Tests.

### 7.3 Abnahme

- Ein Konto kann nicht in einen fremden Ordner oder zu fremdem Feedback hochladen und kann fremde Screenshots nicht lesen (Datenbanktest mit Storage-Policies).
- Ein vierter Screenshot und Dateien über 1 MB werden abgelehnt, in der App und im Bucket.
- Nach Ablauf der Frist sind die Dateien gelöscht, der Feedback-Text bleibt.

## 8. Schritt 5: Zwei-Faktor-Anmeldung für Admins

### 8.1 Ansatz

Supabase Auth unterstützt TOTP-MFA mit Authenticator-Apps (Google Authenticator, 1Password …). Nach der Bestätigung trägt das Zugriffstoken `aal = 'aal2'`.

### 8.2 Datenbank (Migration `0088_admin_mfa`)

- `is_ops_admin()` wird zu:

  ```sql
  has_role(auth.uid(), 'admin') AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  ```

  Weil seit Schritt 1 alle Betreiberfunktionen über `is_ops_admin()` laufen, genügt diese eine Änderung.
- Zusätzlich eine Funktion `is_admin_role()` ohne `aal`-Prüfung. Die App braucht sie, um zu erkennen «du bist Admin, aber noch nicht mit dem zweiten Faktor angemeldet».
- Prüfen: Rufen Edge Functions oder Skripte (`sync-xcontest`, `marketplace-cleanup`, Backup-Meldung) Admin-RPCs mit Benutzer-Token auf? Laut Ist-Stand arbeiten sie mit dem Service-Key; beim Bau bestätigen.

### 8.3 Frontend

- Einstellungen → Sicherheit (nur für Admins): TOTP einrichten mit QR-Code (`supabase.auth.mfa.enroll` / `challenge` / `verify`) und Faktor entfernen.
- `AdminGuard`: Ist das Konto Admin mit `aal1`, erscheint die Code-Eingabe; danach wird die Sitzung aufgewertet.
- `useAppAdmin()` unterscheidet «Admin» und «Admin, zweiter Faktor aktiv».

### 8.4 Vorbedingung und Notfall

- Im Supabase-Dashboard MFA (TOTP) aktivieren; das macht Tobias.
- **Notfallzugang festlegen:** Wiederherstellungscodes sicher ablegen (Passwortmanager). Falls das Gerät verloren geht, lässt sich der Faktor über das Supabase-Dashboard bzw. die Management API entfernen. Dieses Vorgehen kommt in `docs/technical/operations.md`; die Datei erst nach Rückfrage anpassen.

## 9. info@flyary.ch

**Keine Umsetzung in der App.** Die Mailbox liegt bei Hostpoint. Empfehlung:

- Im Mailprogramm auf Laptop und Handy per IMAP einbinden (Hostpoint-Webmail als Ausweichlösung). Alternativ eine Weiterleitung nach Gmail mit «Senden als» info@flyary.ch.
- Ordner oder Labels: *Schulen*, *Tester*, *Support*, *Erledigt*.
- Vorlagen für wiederkehrende Antworten (Einladung neu schicken, Zugang pausiert, Datenlöschung).
- Die MX-/TXT-Einträge bei Hostpoint bleiben unberührt (siehe Domain-Setup).

Wenn das Mailvolumen stark wächst, eher ein Helpdesk-Tool (z. B. Freescout, Zammad, Help Scout) als eine Eigenentwicklung.

## 10. Schritt 6 (optional): Sentry

Die eigene Fehlertabelle (`client_errors`) reicht für die Pilotphase. Sentry lohnt sich ab etwa 50 aktiven Nutzern oder wenn die Stack-Traces ohne Source Maps nicht mehr genügen:

- EU-Region wählen; keine personenbezogenen Daten mitsenden (`sendDefaultPii: false`, nur die Konto-ID).
- Source Maps beim Vercel-Build hochladen.
- `client_errors` parallel weiterführen oder abschalten; Entscheid dann.
- In der Datenschutzerklärung erwähnen.

## 11. Wann doch eine eigene Admin-App

Ein Wechsel lohnt sich, sobald eines davon zutrifft:

- Eine zweite Person übernimmt Support oder Betrieb und braucht abgestufte Rollen.
- Admin-Oberfläche und -Code sollen aus der ausgelieferten Nutzer-App verschwinden (Audit, Kundenanforderung).
- Der Betriebsbereich wächst auf mehr als etwa 10 Seiten oder braucht schwere Bibliotheken (Datentabellen, Diagramme).

**Weg dahin:** gleiches Repo, zweiter Vite-Einstiegspunkt (`admin.html` bzw. eigenes Vercel-Projekt auf `admin.flyary.ch`) mit gemeinsamem Supabase-Client, `types.ts`, UI-Komponenten und i18n. Weil der Betriebsbereich ab Schritt 1 eigenes Layout und eigene Routen hat, ist das ein Umzug und kein Neubau. Supabase Auth braucht dann die zusätzliche Redirect-URL.

## 12. Entscheide (Tobias, 2026-09-30)

1. Sperren beendet Schulmitgliedschaften nicht (§5.3): **ja**.
2. Ganze Schulen pausieren erst bei Bedarf (§6.3): **ja**.
3. Feedback **mit Screenshots**, sonst bringt es zu wenig (§7).
4. Zwei-Faktor-Pflicht vorerst nur für Admins, nicht für Schulleitungen: **ja**.
5. Zwei-Faktor wird **nicht** vorgezogen; die Reihenfolge 1 → 2 → 3 → 4 → 5 bleibt.
