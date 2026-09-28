// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Stage C: the app admin curates official names; pilots merge two own places into one.
let db: PGlite;
const admin = "00000000-0000-0000-0000-000000000001";
const pilot = "00000000-0000-0000-0000-000000000002";
const student = "00000000-0000-0000-0000-000000000003";
const site = "40000000-0000-0000-0000-000000000001";
const keep = "30000000-0000-0000-0000-000000000001";
const dup = "30000000-0000-0000-0000-000000000002";
const foreign = "30000000-0000-0000-0000-000000000003";

const migration = (name: string) => readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");
const as = async <T>(user: string, fn: () => Promise<T>) => {
  await db.exec(`SET app.user_id='${user}'; SET ROLE authenticated;`);
  try { return await fn(); } finally { await db.exec("RESET ROLE;"); }
};
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TYPE app_role AS ENUM ('admin','user');
    CREATE TABLE user_roles(user_id uuid, role app_role);
    CREATE FUNCTION has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
      $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role) $$;
    CREATE TYPE location_type AS ENUM ('takeoff','landing','both');
    CREATE TABLE locations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL,
      latitude double precision NOT NULL DEFAULT 0, longitude double precision NOT NULL DEFAULT 0, type location_type NOT NULL DEFAULT 'both',
      altitude integer, description text, country_code text, optimal_wind_directions text[] NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own ON locations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE TABLE flights(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid,
      takeoff_location_id uuid REFERENCES locations(id) ON DELETE SET NULL, landing_location_id uuid REFERENCES locations(id) ON DELETE SET NULL);
    CREATE TABLE flight_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), takeoff_location_id uuid REFERENCES locations(id) ON DELETE SET NULL);
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    INSERT INTO user_roles VALUES ('${admin}','admin');
  `);
  for (const m of ["0063_official_sites.sql", "0064_own_site_names.sql", "0067_site_names_admin_and_merge.sql"]) await db.exec(migration(m));
  await db.exec(`
    INSERT INTO official_sites (id, source_id, name_de, name_fr, name_en, type, latitude, longitude, country_code)
      VALUES ('${site}','1','Kronberg 2','Kronberg 2','Kronberg 2','takeoff',47.29,9.33,'CH');
    INSERT INTO locations (id, user_id, name, official_site_id) VALUES ('${keep}','${pilot}','x','${site}');
    INSERT INTO locations (id, user_id, name, description, optimal_wind_directions) VALUES ('${dup}','${pilot}','Kronberg alt','Parkplatz beim Lift','{S}');
    INSERT INTO locations (id, user_id, name) VALUES ('${foreign}','${student}','Fremd');
    INSERT INTO flights (user_id, takeoff_location_id, landing_location_id) VALUES
      ('${pilot}','${dup}',NULL),('${pilot}','${dup}','${dup}'),('${student}','${dup}',NULL),('${pilot}','${keep}',NULL);
    INSERT INTO flight_templates (takeoff_location_id) VALUES ('${dup}');
  `);
}, 60_000);
afterAll(async () => { await db?.close(); });

describe("official names by the app admin", () => {
  it("only the admin may set them", async () => {
    await as(pilot, async () => {
      await expect(db.query("SELECT set_official_site_name($1,'Kronberg Süd')", [site])).rejects.toThrow("Admin required");
    });
  });

  it("reaches linked places without an own name, and an empty name goes back", async () => {
    await as(admin, () => db.query("SELECT set_official_site_name($1,'  Kronberg Süd ')", [site]));
    expect(await one("SELECT name_override FROM official_sites WHERE id=$1", [site])).toEqual({ name_override: "Kronberg Süd" });
    expect(await one("SELECT name FROM locations WHERE id=$1", [keep])).toEqual({ name: "Kronberg Süd" });
    await as(admin, () => db.query("SELECT set_official_site_name($1,'')", [site]));
    expect(await one("SELECT name FROM locations WHERE id=$1", [keep])).toEqual({ name: "Kronberg 2" });
    await as(admin, async () => {
      await expect(db.query("SELECT set_official_site_name($1,'x')", ["40000000-0000-0000-0000-000000000099"])).rejects.toThrow("Unknown site");
    });
  });
});

describe("merging own places", () => {
  it("only merges two own places", async () => {
    await as(pilot, async () => {
      await expect(db.query("SELECT merge_locations($1,$2)", [keep, foreign])).rejects.toThrow("Only own places");
      await expect(db.query("SELECT merge_locations($1,$1)", [keep])).rejects.toThrow("into itself");
    });
    await as(student, async () => {
      await expect(db.query("SELECT merge_locations($1,$2)", [keep, dup])).rejects.toThrow("Only own places");
    });
  });

  it("moves every reference, also of other people, keeps notes and deletes the duplicate", async () => {
    const moved = await as(pilot, async () => (await one<{ n: number }>("SELECT merge_locations($1,$2) AS n", [keep, dup])).n);
    expect(moved).toBe(5);
    expect(await one("SELECT count(*)::int AS n FROM flights WHERE takeoff_location_id=$1", [keep])).toEqual({ n: 4 });
    expect(await one("SELECT count(*)::int AS n FROM flights WHERE landing_location_id=$1", [keep])).toEqual({ n: 1 });
    expect(await one("SELECT takeoff_location_id AS t FROM flight_templates")).toEqual({ t: keep });
    expect(await one("SELECT count(*)::int AS n FROM locations WHERE id=$1", [dup])).toEqual({ n: 0 });
    expect(await one("SELECT name, description, optimal_wind_directions FROM locations WHERE id=$1", [keep]))
      .toEqual({ name: "Kronberg 2", description: "Parkplatz beim Lift", optimal_wind_directions: ["S"] });
  });
});
