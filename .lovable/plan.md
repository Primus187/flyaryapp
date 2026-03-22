

# Event-Chat auf der Termin-Detailseite

## Übersicht
Echtzeit-Chat direkt auf der Event-Detailseite, sichtbar für alle Gruppenmitglieder. Nachrichten werden in einer neuen Tabelle gespeichert und via Realtime-Subscription live aktualisiert.

## Änderungen

### 1. Migration: Neue Tabelle `event_messages`
```sql
CREATE TABLE public.event_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES flight_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_messages ENABLE ROW LEVEL SECURITY;

-- Gruppenmitglieder können Nachrichten lesen
CREATE POLICY "Members can view event messages" ON public.event_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM flight_events fe
    WHERE fe.id = event_messages.event_id
    AND is_group_member(auth.uid(), fe.group_id)
  ));

-- Gruppenmitglieder können Nachrichten schreiben
CREATE POLICY "Members can insert event messages" ON public.event_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM flight_events fe
      WHERE fe.id = event_messages.event_id
      AND is_group_member(auth.uid(), fe.group_id)
    )
  );

-- Eigene Nachrichten löschen
CREATE POLICY "Users can delete own messages" ON public.event_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Realtime aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_messages;
```

### 2. Neue Komponente: `src/components/EventChat.tsx`
- Nachrichten laden beim Mount, Realtime-Subscription für neue Nachrichten
- ScrollArea mit Nachrichten-Bubbles (eigene rechts/blau, andere links/grau)
- Pilotname + Zeitstempel pro Nachricht
- Input-Feld + Sende-Button unten
- Profiles der Chat-Teilnehmer laden (Pilotname, Avatar)
- Auto-Scroll bei neuen Nachrichten

### 3. `src/pages/EventDetail.tsx`
- `EventChat` Komponente am Ende der Seite einbinden
- Props: `eventId`, `groupId`

### 4. i18n-Strings (de/en/fr)
- `events.chat`, `events.typeMessage`, `events.sendMessage`, `events.noMessages`

## Dateien
- **Migration**: `event_messages` Tabelle + RLS + Realtime
- **Neu**: `src/components/EventChat.tsx`
- **Edit**: `src/pages/EventDetail.tsx` — Chat einbinden
- **Edit**: `src/i18n/locales/{de,fr,en}.json` — Chat-Übersetzungen

