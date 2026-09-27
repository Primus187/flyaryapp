// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
let siteId: string;
const pilot = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";

const migration = (name: string) => readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");
const asUser = async <T>(user: string, fn: () => Promise<T>) => {
  await db.exec(`SET ROLE authenticated; SELECT set_config('app.user_id', '${user}', false);`);
  try { return await fn(); } finally { await db.exec("RESET ROLE;"); }
};
const location = async (id: string) => (await db.query<Record<string, unknown>>("SELECT * FROM locations WHERE id=$1", [id])).rows[0];

beforeAll(async () => {
  db = new PGlite();
  // locations as live: every pilot reads and writes only their own places.
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TYPE location_type AS ENUM ('takeoff','landing','both');
    CREATE TABLE locations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL,
      latitude double precision NOT NULL, longitude double precision NOT NULL, type location_type NOT NULL DEFAULT 'both',
      altitude integer, description text, country_code text, optimal_wind_directions text[] NOT NULL DEFAULT '{}',
      updated_at timestamptz NOT NULL DEFAULT now());
    ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own ON locations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    GRANT SELECT, INSERT, UPDATE, DELETE ON locations TO authenticated;
  `);
  await db.exec(migration("0063_official_sites.sql"));
  await db.exec(migration("0063_official_sites.sql")); // re-runnable
  siteId = (await db.query<{ id: string }>(`INSERT INTO official_sites (source_id, name_de, name_fr, name_en, type, latitude, longitude, altitude, country_code, wind_directions)
    VALUES ('2226','Säntis Startplatz','Säntis Décollage','Säntis Takeoff','takeoff',47.245918,9.347563,2375,'CH','{SW,W}') RETURNING id`)).rows[0].id;
}, 60_000);
afterAll(async () => { await db?.close(); });

describe("official sites", () => {
  it("are readable for signed-in pilots but not writable", async () => {
    await asUser(pilot, async () => {
      expect((await db.query("SELECT name_de FROM official_sites")).rows).toHaveLength(1);
      await expect(db.query("UPDATE official_sites SET name_de='x'")).rejects.toThrow(/permission denied/);
      await expect(db.query("INSERT INTO official_sites (source_id,name_de,name_fr,name_en,type,latitude,longitude,country_code) VALUES ('1','a','a','a','takeoff',0,0,'CH')")).rejects.toThrow(/permission denied/);
    });
    await db.exec("SET ROLE anon;");
    await expect(db.query("SELECT * FROM official_sites")).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE;");
  });

  it("gives a linked place the fixed name, type and position, and keeps the pilot's notes", async () => {
    const id = await asUser(pilot, async () => {
      const { rows } = await db.query<{ id: string }>(`INSERT INTO locations (user_id, name, latitude, longitude, description) VALUES ($1, 'Mein Säntis', 47.2, 9.3, 'Notiz') RETURNING id`, [pilot]);
      await db.query("UPDATE locations SET official_site_id=$1 WHERE id=$2", [siteId, rows[0].id]);
      await db.query("UPDATE locations SET name='Umbenannt', latitude=1, type='both', description='Neue Notiz' WHERE id=$1", [rows[0].id]);
      return rows[0].id;
    });
    expect(await location(id)).toMatchObject({ name: "Säntis Startplatz", type: "takeoff", latitude: 47.245918, altitude: 2375, country_code: "CH", description: "Neue Notiz", optimal_wind_directions: ["SW", "W"] });
  });

  it("lets a pilot add an official site directly and keeps own wind choices", async () => {
    const row = await asUser(pilot, async () => (await db.query<Record<string, unknown>>(
      `INSERT INTO locations (user_id, name, latitude, longitude, official_site_id, optimal_wind_directions) VALUES ($1, 'egal', 0, 0, $2, '{S}') RETURNING *`, [pilot, siteId])).rows[0]);
    expect(row).toMatchObject({ name: "Säntis Startplatz", latitude: 47.245918, optimal_wind_directions: ["S"] });
  });

  it("carries a renamed site to every linked place, also other pilots'", async () => {
    const otherId = await asUser(other, async () => (await db.query<{ id: string }>(
      `INSERT INTO locations (user_id, name, latitude, longitude, official_site_id) VALUES ($1, 'x', 0, 0, $2) RETURNING id`, [other, siteId])).rows[0].id);
    await db.query("UPDATE official_sites SET name_de='Säntis Startplatz 1', altitude=2380 WHERE id=$1", [siteId]);
    expect(await location(otherId)).toMatchObject({ name: "Säntis Startplatz 1", altitude: 2380 });
    const names = (await db.query<{ name: string }>("SELECT DISTINCT name FROM locations WHERE official_site_id=$1", [siteId])).rows;
    expect(names).toEqual([{ name: "Säntis Startplatz 1" }]);
  });

  it("leaves unlinked places freely editable and unlinks when a site is removed", async () => {
    const id = await asUser(pilot, async () => {
      const { rows } = await db.query<{ id: string }>(`INSERT INTO locations (user_id, name, latitude, longitude) VALUES ($1, 'Wiese hinter dem Haus', 46, 8) RETURNING id`, [pilot]);
      await db.query("UPDATE locations SET name='Wiese' WHERE id=$1", [rows[0].id]);
      return rows[0].id;
    });
    expect(await location(id)).toMatchObject({ name: "Wiese", official_site_id: null });
    await db.query("DELETE FROM official_sites");
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM locations WHERE official_site_id IS NOT NULL")).rows[0].n).toBe(0);
  });
});
