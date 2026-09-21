# Flyary

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

- `supabase/migrations/` – die ursprüngliche, historische Migrationsreihe (bis ca. Mai 2026).
- `drizzle/migrations/` – die neuere Migrationsreihe (ab Phase 1 der Flugschul-Erweiterungen,
  z. B. `0002_school_phase1_shv_compliance.sql`). `drizzle/schema.ts` ist absichtlich leer
  (`// auto-generated and intentionally left blank, do not edit`) – Drizzle wird hier nur als
  Migrations-Journal genutzt, nicht als ORM. Es gibt kein `drizzle-kit`-npm-Skript und keinen
  CI-Workflow, der eine der beiden Reihen automatisch anwendet; Lovable spielt Änderungen direkt
  gegen die produktive Datenbank ein.

Für einen Schema-Aufbau von Grund auf müssen **beide Ordner, in dieser Reihenfolge**, angewendet
werden: zuerst alle Dateien aus `supabase/migrations/`, danach alle aus `drizzle/migrations/`
(chronologisch nach Dateiname). Neue Migrationen ab Phase 1 der Flugschul-Erweiterungen gehören
in `drizzle/migrations/`.
