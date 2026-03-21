

# Soziale Flugtage-Planung (Termine)

## Übersicht
Gruppen (Schulen/Freundeskreise) können Flugtage planen. Mitglieder sehen die Termine und können sich an-/abmelden — wie in der alten App.

## Datenmodell (4 neue Tabellen)

### `groups`
- `id`, `name`, `description`, `created_by` (user_id), `created_at`
- RLS: Mitglieder können lesen, Ersteller kann bearbeiten/löschen

### `group_members`
- `id`, `group_id`, `user_id`, `role` (enum: `admin`, `member`), `joined_at`
- Ersteller wird automatisch Admin
- RLS: Mitglieder der Gruppe können lesen, Admins können hinzufügen/entfernen

### `flight_events`
- `id`, `group_id`, `title`, `description`, `status` (enum: `announced`, `confirmed`, `cancelled`), `event_date` (timestamp), `signup_deadline` (timestamp), `event_type` (z.B. Höhenflüge, Thermikflüge, Groundhandling), `meeting_point` (text), `instructor` (text), `launch_helper` (text), `max_participants` (int, nullable), `created_by`, `created_at`
- RLS: Gruppenmitglieder können lesen, Admins können CRUD

### `event_signups`
- `id`, `event_id`, `user_id`, `signed_up` (boolean), `updated_at`
- RLS: Gruppenmitglieder können lesen, User können eigene An-/Abmeldung bearbeiten

## Neue Seiten

### 1. Termine-Liste (`src/pages/Events.tsx`)
- Listenansicht wie im Screenshot: Toggle (an/abgemeldet), Status-Badge, Datum, Treffpunkt
- Vergangene Termine ausgegraut
- Filter-Dropdown für Gruppe (wenn User in mehreren Gruppen)
- Klick öffnet Detailansicht

### 2. Termin-Detail (`src/pages/EventDetail.tsx`)
- Anmeldung-Toggle oben
- Alle Felder: Status, Datum/Zeit, Anmeldefrist, Terminart, Treffpunkt, Fluglehrer, Starthelfer, Beschreibung
- Teilnehmer-Liste unten (X/Y Anmeldungen + Namen)

### 3. Termin erstellen/bearbeiten (`src/pages/EventForm.tsx`)
- Nur für Gruppen-Admins
- Formular mit allen Feldern

### 4. Gruppen-Verwaltung (`src/pages/Groups.tsx`)
- Meine Gruppen anzeigen
- Gruppe erstellen (Name, Beschreibung)
- Einladungslink generieren (UUID-basiert) oder Mitglieder per E-Mail einladen
- Mitglieder verwalten (nur Admins)

## Navigation
- Neuer Tab **"Termine"** in der Bottom-Nav (Icon: `Calendar`, zwischen Flugbuch und Orte)
- Bottom-Nav wird 5 Tabs: Dashboard | Flugbuch | Termine | Orte | Profil
- Gruppen-Verwaltung erreichbar über Profil-Seite

## Dateien
- **Neu**: `src/pages/Events.tsx` — Terminliste
- **Neu**: `src/pages/EventDetail.tsx` — Termindetail mit An-/Abmeldung
- **Neu**: `src/pages/EventForm.tsx` — Termin erstellen/bearbeiten
- **Neu**: `src/pages/Groups.tsx` — Gruppenverwaltung
- **Edit**: `src/components/BottomNav.tsx` — Termine-Tab hinzufügen
- **Edit**: `src/App.tsx` — Routen für `/events`, `/events/:id`, `/events/new`, `/groups`
- **Edit**: `src/pages/Profile.tsx` — Link zu Gruppen-Verwaltung
- **Migration**: 4 Tabellen + 2 Enums + RLS-Policies + Einladungs-Logik

