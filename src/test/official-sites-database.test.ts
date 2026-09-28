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
const insertOwn = (user: string, name: string, extra = "") => asUser(user, async () => (await db.query<{ id: string }>(
  `INSERT INTO locations (user_id, name, latitude, longitude${extra ? ", official_site_id" : ""}) VALUES ($1, $2, 47.2, 9.3${extra ? ", $3" : ""}) RETURNING id`,
  extra ? [user, name, extra] : [user, name])).rows[0].id);

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
  await db.exec(migration("0064_own_site_names.sql"));
  await db.exec(migration("0064_own_site_names.sql")); // re-runnable
  siteId = (await db.query<{ id: string }>(`INSERT INTO official_sites (source_id, source_name, name_de, name_fr, name_en, type, latitude, longitude, altitude, country_code, wind_directions)
    VALUES ('2226','Säntis Startplatz','Säntis','Säntis','Säntis','takeoff',47.245918,9.347563,2375,'CH','{SW,W}') RETURNING id`)).rows[0].id;
}, 60_000);
afterAll(async () => { await db?.close(); });

describe("official sites", () => {
  it("are readable for signed-in pilots but not writable", async () => {
    await asUser(pilot, async () => {
      expect((await db.query("SELECT name_de FROM official_sites")).rows).toHaveLength(1);
      await expect(db.query("UPDATE official_sites SET name_override='x'")).rejects.toThrow(/permission denied/);
      await expect(db.query("INSERT INTO official_sites (source_id,name_de,name_fr,name_en,type,latitude,longitude,country_code) VALUES ('1','a','a','a','takeoff',0,0,'CH')")).rejects.toThrow(/permission denied/);
    });
    await db.exec("SET ROLE anon;");
    await expect(db.query("SELECT * FROM official_sites")).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE;");
  });

  it("keeps the pilot's name when an existing place is linked, but fixes type and position", async () => {
    const id = await insertOwn(pilot, "Mein Säntis");
    await asUser(pilot, () => db.query("UPDATE locations SET official_site_id=$1, latitude=1, type='both' WHERE id=$2", [siteId, id]));
    expect(await location(id)).toMatchObject({ name: "Mein Säntis", custom_name: "Mein Säntis", type: "takeoff", latitude: 47.245918, altitude: 2375, optimal_wind_directions: ["SW", "W"] });
  });

  it("gives a place picked from the catalogue the official name", async () => {
    const id = await insertOwn(pilot, "egal", siteId);
    expect(await location(id)).toMatchObject({ name: "Säntis", custom_name: null });
  });

  it("lets the pilot rename a linked place and go back to the official name", async () => {
    const id = await insertOwn(pilot, "x", siteId);
    await asUser(pilot, () => db.query("UPDATE locations SET name='Säntis Lisengrat', description='Notiz' WHERE id=$1", [id]));
    expect(await location(id)).toMatchObject({ name: "Säntis Lisengrat", custom_name: "Säntis Lisengrat", description: "Notiz" });
    await asUser(pilot, () => db.query("UPDATE locations SET description='Neu' WHERE id=$1", [id]));
    expect(await location(id)).toMatchObject({ name: "Säntis Lisengrat" });
    await asUser(pilot, () => db.query("UPDATE locations SET custom_name=NULL WHERE id=$1", [id]));
    expect(await location(id)).toMatchObject({ name: "Säntis", custom_name: null });
    await asUser(pilot, () => db.query("UPDATE locations SET name='  ' WHERE id=$1", [id]));
    expect(await location(id)).toMatchObject({ name: "Säntis", custom_name: null });
  });

  it("carries official renames to places without an own name only", async () => {
    const plain = await insertOwn(other, "x", siteId);
    const named = await insertOwn(other, "Hausberg");
    await asUser(other, () => db.query("UPDATE locations SET official_site_id=$1 WHERE id=$2", [siteId, named]));
    await db.query("UPDATE official_sites SET name_override='Säntis Lisengrat', altitude=2380 WHERE id=$1", [siteId]);
    expect(await location(plain)).toMatchObject({ name: "Säntis Lisengrat", altitude: 2380 });
    expect(await location(named)).toMatchObject({ name: "Hausberg", altitude: 2380 });
    await db.query("UPDATE official_sites SET name_override=NULL, name_de='Säntis West' WHERE id=$1", [siteId]);
    expect(await location(plain)).toMatchObject({ name: "Säntis West", custom_name: null });
  });

  it("leaves unlinked places freely editable and unlinks when a site is removed", async () => {
    const id = await insertOwn(pilot, "Wiese hinter dem Haus");
    await asUser(pilot, () => db.query("UPDATE locations SET name='Wiese', custom_name='ignoriert' WHERE id=$1", [id]));
    expect(await location(id)).toMatchObject({ name: "Wiese", official_site_id: null, custom_name: null });
    await db.query("DELETE FROM official_sites");
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM locations WHERE official_site_id IS NOT NULL")).rows[0].n).toBe(0);
  });
});
