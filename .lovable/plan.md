

# Kontrollblatt / Training-Tracker

## Übersicht
Ein "Kontrollblatt" (wie in den Screenshots) zum Tracken von Ausbildungsfortschritt und Fähigkeiten. Kategorien mit Übungen, Sterne-Bewertung (1-3), und Detailansicht mit Ziel, Inhalt, Fehler, Gefahr.

## Datenmodell

### Migration 1: Tabellen

**`training_categories`** — Kategorien (z.B. Theorie, Übungshang, Höhenflüge)
- `id uuid PK`, `name text`, `sort_order int`, `created_at`

**`training_items`** — Einzelne Übungen/Manöver
- `id uuid PK`, `category_id uuid FK`, `name text`, `sort_order int`
- `goal text` (Ziel), `content text` (Inhalt), `mistakes text` (Fehler), `danger text` (Gefahr)

**`training_progress`** — Benutzerbewertung pro Item
- `id uuid PK`, `user_id uuid`, `item_id uuid FK → training_items`
- `rating int` (1-3 Sterne), `notes text`, `updated_at`
- UNIQUE(user_id, item_id)

Vordefinierte Daten: Alle Kategorien und Items aus den Screenshots werden als Seed-Daten eingefügt (Theorie: Fluglehre, Wetterkunde, etc. / Übungshang: Auslegen, Slalomlauf, etc. / Höhenflüge: alle ~25 Items).

RLS: 
- `training_categories` und `training_items`: SELECT für alle authenticated
- `training_progress`: CRUD nur eigene Daten (user_id = auth.uid())

### 2. Neue Seiten

**`src/pages/Training.tsx`** — Kontrollblatt-Übersicht
- Collapsible Accordion pro Kategorie
- Jedes Item zeigt 3 Sterne (orange gefüllt nach Rating, grau wenn leer)
- Antippen eines Items → Detailseite
- Sterne direkt antippbar zum schnellen Bewerten

**`src/pages/TrainingItemDetail.tsx`** — Detail eines Manövers
- Header mit Name
- Sektionen: Ziel, Inhalt, Fehler (Bullet-Liste), Gefahr
- Sterne-Bewertung editierbar
- Optionales Notizfeld

### 3. Navigation
- Neuer Tab in BottomNav: `GraduationCap` Icon, Label "Training"
- Route `/training` und `/training/:itemId`

### 4. i18n
- Neue Keys: `training.title`, `training.goal`, `training.content`, `training.mistakes`, `training.danger`, `training.rating`, `training.noRating`

## Dateien
- **Migration**: 3 Tabellen + Seed-Daten + RLS
- **Neu**: `src/pages/Training.tsx`
- **Neu**: `src/pages/TrainingItemDetail.tsx`
- **Edit**: `src/App.tsx` — Routen
- **Edit**: `src/components/BottomNav.tsx` — Neuer Tab
- **Edit**: `src/i18n/locales/{de,fr,en}.json` — Übersetzungen

## Technische Details
- Seed-Daten enthalten alle ~50 Items aus den Screenshots mit deutschem Text für goal/content/mistakes/danger
- Sterne-Bewertung: Upsert auf `training_progress` (INSERT ON CONFLICT UPDATE)
- Accordion verwendet bestehende shadcn Accordion-Komponente

