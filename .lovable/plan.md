

# Fix: IGC-Datei erneut hochladen hängt

## Problem
Beim erneuten Hochladen einer IGC-Datei bleibt die App im Ladezustand hängen.

## Ursache
Die Storage-Bucket-Policy für `igc-files` hat keine **UPDATE**-Policy. Beim erneuten Upload mit `upsert: true` versucht Supabase, die bestehende Datei zu überschreiben, braucht dafür aber UPDATE-Rechte. Ohne diese Policy schlägt der Upload fehl. Zusätzlich prüft der Code auf Zeile 133 nicht, ob der `delete`-Aufruf fehlschlägt — Fehler werden verschluckt.

## Änderungen

### 1. Migration: UPDATE-Policy für igc-files Storage hinzufügen
```sql
CREATE POLICY "Users can update own igc files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'igc-files' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 2. `src/pages/FlightDetail.tsx` — Fehlerbehandlung verbessern
- Zeile 133: Fehler beim Löschen des alten Tracks abfangen und loggen
- Zusätzlich: den `track` in `FlightForm.tsx` beim Erstellen ebenfalls mit `stats` speichern (Zeile 156), damit nach dem ersten Upload bereits Zeitstempel vorhanden sind

### 3. `src/pages/FlightForm.tsx` — Stats beim Erstellen mitspeichern
Zeile 156: `track_data` um `stats` erweitern, analog zu FlightDetail:
```typescript
track_data: limitedPoints ? { points: limitedPoints, stats: igcStats } as any : null
```

Drei Dateien, eine Migration.

