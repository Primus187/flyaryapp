# Aufräumen: Telegram raus, Doppeltes zusammenführen

Alles läuft jetzt in der App (Ankündigung mit Push, Termin-Chat, Gruppenchat). Telegram wird komplett entfernt, dazu räumen wir doppelte und ungenutzte Teile auf.

## 1. Telegram entfernen

- Der Knopf "Telegram-Text kopieren" im Termin verschwindet. Die Ankündigung bleibt – dort gibt es die Vorschau mit Kopieren und Senden, also nichts geht verloren.
- Auf der Flugschul-Startseite wird die Schnellaktion "Telegram" zu "Ankündigung" und führt direkt zum nächsten Termin.
- Das Feld "Gruppenlink (Telegram/WhatsApp)" im Termin wird nicht mehr angezeigt und nicht mehr gespeichert; bestehende Termine zeigen keinen externen Chat-Link mehr, stattdessen gilt der Chat in der App.
- Alle Telegram-Texte in Deutsch, Englisch und Französisch werden gelöscht.

## 2. Doppeltes zusammenführen

- Zwei verschiedene "Leere Liste"-Bausteine existieren parallel. Wir behalten einen und verwenden ihn überall gleich.
- Der ungenutzte Ladezustand-Baustein wird entfernt oder überall dort eingesetzt, wo heute ein eigener Ladetext steht.

## 3. Ungenutzten Code löschen

Diese Teile werden nirgends verwendet und fliegen raus: die Feed-Karte für Challenges, ein alter Navigations-Link, sowie 12 nie eingesetzte Oberflächen-Bausteine aus der Komponentenbibliothek (Dialogvariante, Seitenleiste, Menüleiste, Blätter-Navigation u. a.).

## Was bleibt unverändert

Keine Funktion, die du nutzt, wird entfernt. Es gibt keine Datenbankänderung – die alte Spalte für den externen Chat-Link bleibt unangetastet, wird aber nicht mehr gelesen oder geschrieben.

## Technische Details

- Löschen: `src/components/TelegramTextGenerator.tsx`, `src/components/FeedChallengeCard.tsx`, `src/components/NavLink.tsx`, `src/components/layout/LoadingState.tsx` (falls nicht eingesetzt), sowie ungenutzte `src/components/ui/*`: alert-dialog, aspect-ratio, breadcrumb, drawer, dropdown-menu, hover-card, input-otp, menubar, navigation-menu, pagination, radio-group, resizable, toggle-group.
- `EventDetail.tsx`: Import und Render von `TelegramTextGenerator` entfernen, `event.chat_link`-Button entfernen. `EventForm.tsx`: `chat_link` aus State, Laden und Insert/Update entfernen.
- `src/lib/event-message.ts` bleibt (wird von `EventAnnounceDialog` genutzt), nur der Telegram-Kommentar wird angepasst.
- `SchoolOverview.tsx`: `school.telegram` → neuer Key `school.announce`.
- i18n de/en/fr: `events.copyTelegramText`, `events.telegramCopied`, `events.chatLink`, `events.chatLinkPlaceholder`, `school.telegram` entfernen; `school.announce` ergänzen.
- `src/components/EmptyState.tsx` und `src/components/layout/EmptyState.tsx` auf eine Variante in `layout/` konsolidieren, Importe in Flights/Feed/Dashboard/Events anpassen.
- `CRAWLER_PATTERN` in `get-shared-flight` behält "TelegramBot" (Link-Vorschau, kein Feature).
- Abschluss: `tsgo` und Vitest, Playwright-Sichtprüfung 430×932 auf `/events/:id`, `/school`, `/events/new`.
