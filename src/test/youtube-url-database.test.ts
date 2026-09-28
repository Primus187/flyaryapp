// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0068: only YouTube addresses may be stored as flight videos.
let db: PGlite;
const flight = "50000000-0000-0000-0000-000000000001";
const insert = (url: string) => db.query("INSERT INTO flight_videos (flight_id, youtube_url) VALUES ($1, $2)", [flight, url]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE flight_videos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flight_id uuid, youtube_url text, storage_path text, poster_path text,
      CONSTRAINT flight_videos_source_check CHECK (((youtube_url IS NOT NULL) AND (storage_path IS NULL)) OR ((youtube_url IS NULL) AND (storage_path IS NOT NULL))));
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0068_youtube_url_check.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0068_youtube_url_check.sql", import.meta.url), "utf8"));
}, 30_000);
afterAll(async () => { await db?.close(); });

describe("flight video addresses", () => {
  it("accepts YouTube addresses and uploaded videos", async () => {
    for (const url of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://m.youtube.com/shorts/abc123", "http://youtube.com/live/abc123"]) {
      await insert(url);
    }
    await db.query("INSERT INTO flight_videos (flight_id, storage_path) VALUES ($1, 'u/f/v.mp4')", [flight]);
  });

  it("refuses script and foreign addresses", async () => {
    for (const url of ["javascript:alert(document.cookie)//youtube.com", "https://youtube.com.evil.example/x", "https://evil.example/?youtube.com", "data:text/html,x"]) {
      await expect(insert(url)).rejects.toThrow(/flight_videos_youtube_url_check/);
    }
  });
});
