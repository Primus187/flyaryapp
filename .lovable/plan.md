
# Gleitschirm-Flugtagebuch (PWA)

## Übersicht
Eine mobile-first PWA für Gleitschirmpiloten, um Flüge zu dokumentieren, IGC-Tracks zu visualisieren und Start-/Landeplätze auf einer Karte zu verwalten. Multi-User mit Login.

## Backend (Lovable Cloud / Supabase)
- **Auth**: Email-Login mit Profilen (Pilotenname, Schirm-Info, Profilbild)
- **Datenbank-Tabellen**:
  - `profiles` – Pilotendaten (Name, bevorzugter Schirm, etc.)
  - `flights` – Flugdaten (Datum, Startplatz, Landeplatz, Flugzeit, Höhenmeter, Strecke, Thermik-Bedingungen, Wind, Schirm, Kommentar)
  - `locations` – Start-/Landeplätze (Name, Koordinaten, Typ, Höhe, Beschreibung)
  - `flight_photos` – Foto-Referenzen pro Flug
  - `flight_videos` – YouTube-Links pro Flug
  - `igc_tracks` – gespeicherte IGC-Dateien pro Flug
  - `user_roles` – Rollenverwaltung
- **Storage**: Bucket für IGC-Dateien und Flugfotos

## Seiten & Features

### 1. Login / Registrierung
- Email-basierte Authentifizierung
- Passwort-Reset-Flow

### 2. Dashboard (Startseite)
- Flug-Statistiken: Gesamtflüge, Gesamtflugzeit, Gesamthöhenmeter
- Letzte Flüge als Karten
- Quick-Action: Neuen Flug erfassen

### 3. Flugbuch (Liste)
- Chronologische Liste aller Flüge mit Suchfunktion
- Filterbar nach Datum, Ort, Schirm
- Sortieroptionen

### 4. Flug-Detail / Erfassung
- **Basisdaten**: Datum, Startplatz, Landeplatz (aus gespeicherten Orten wählbar), Flugzeit, Schirm
- **Erweiterte Daten**: Höhenmeter, Strecke (km), Thermik-Bedingungen (Dropdown), Wind (Stärke & Richtung), Freitext-Kommentar
- **IGC-Import**: Datei hochladen → Track wird auf Karte angezeigt, Flugdaten werden automatisch extrahiert (Startzeit, Dauer, Höhe)
- **Fotos**: Mehrere Fotos pro Flug hochladen (aus Galerie oder Kamera)
- **YouTube-Videos**: Links hinzufügen, Thumbnail-Vorschau

### 5. Karte
- **Leaflet/OpenStreetMap** Vollbild-Karte
- Alle Start-/Landeplätze als farbige Marker (grün = Start, rot = Landung)
- Klick auf Marker → Details & verknüpfte Flüge
- IGC-Track als Fluglinie einblendbar
- Topografische Kartenebene

### 6. Orte verwalten
- Liste aller erfassten Start-/Landeplätze
- Neuen Ort erfassen: Name, Typ (Start/Landung/Beides), Koordinaten (manuell oder per Karten-Tap), Höhe, Beschreibung
- Ort bearbeiten/löschen

### 7. Profil
- Pilotenname, Schirm-Infos bearbeiten
- Profilbild

## Technische Highlights
- **PWA**: Installierbar auf dem Homescreen, Service Worker, Offline-fähiges UI
- **IGC-Parser**: Client-seitiges Parsing der IGC-Dateien zur Track-Extraktion
- **Kartenintegration**: Leaflet mit OpenStreetMap + OpenTopoMap Layer
- **Mobile-first Design**: Optimiert für Smartphone-Nutzung im Feld, Bottom-Navigation

## Design
- Frisches, sportliches Design mit Blau/Grün-Tönen (Himmel & Natur)
- Bottom-Tab-Navigation: Dashboard | Flugbuch | ＋Neuer Flug | Karte | Profil
- Karten und Card-basiertes Layout
