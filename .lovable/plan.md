

# Chat-Link-Feld für Termine

## Änderungen

### 1. Migration: Neue Spalte `chat_link` auf `flight_events`
- `ALTER TABLE flight_events ADD COLUMN chat_link text;`

### 2. EventForm.tsx
- Neues Feld "Gruppenlink (Telegram/WhatsApp)" als optionales Input-Feld
- Wert wird als `chat_link` gespeichert

### 3. EventDetail.tsx
- Wenn `chat_link` vorhanden: Button "Gruppenchat öffnen" anzeigen (Icon: `MessageCircle`, öffnet Link in neuem Tab)

### Dateien
- **Migration**: `chat_link` Spalte hinzufügen
- **Edit**: `src/pages/EventForm.tsx`
- **Edit**: `src/pages/EventDetail.tsx`

