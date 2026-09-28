// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Stage B: places of other people show the viewer's own name for an official site, else the official
// name; the SHV proof always shows official names and counts sites per official site.
let db: PGlite;
const instructor = "00000000-0000-0000-0000-000000000001";
const anna = "00000000-0000-0000-0000-000000000003";
const beat = "00000000-0000-0000-0000-000000000004";
const school = "10000000-0000-0000-0000-000000000001";
const event = "20000000-0000-0000-0000-000000000001";
const takeoff = "30000000-0000-0000-0000-000000000001";
const landing = "30000000-0000-0000-0000-000000000002";
const takeoff2 = "30000000-0000-0000-0000-000000000003";
const annaOwn = "30000000-0000-0000-0000-000000000004";
const annaWiese = "30000000-0000-0000-0000-000000000005";

const migration = (name: string) => readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");
const as = async <T>(user: string, fn: () => Promise<T>) => {
  await db.exec(`SET app.user_id='${user}'; SET ROLE authenticated;`);
  try { return await fn(); } finally { await db.exec("RESET ROLE;"); }
};
const label = (user: string, id: string, fn = "display_name") =>
  as(user, async () => (await db.query<{ n: string }>(`SELECT public.${fn}(l) AS n FROM locations l WHERE l.id = $1`, [id])).rows[0]?.n);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    CREATE TYPE location_type AS ENUM ('takeoff','landing','both');
    CREATE TABLE groups(id uuid PRIMARY KEY, group_type text, name text);
    CREATE TABLE group_members(group_id uuid, user_id uuid);
    CREATE TABLE profiles(user_id uuid PRIMARY KEY, pilot_name text, shv_number text);
    CREATE TABLE locations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL,
      latitude double precision NOT NULL DEFAULT 0, longitude double precision NOT NULL DEFAULT 0, type location_type NOT NULL DEFAULT 'both',
      altitude integer, description text, country_code text, optimal_wind_directions text[] NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
    -- as live: own places, plus places of flights one may see (simplified to "all" for reading)
    CREATE POLICY read_all ON locations FOR SELECT USING (true);
    CREATE POLICY own_write ON locations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE TABLE flights(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, date date, takeoff_location_id uuid,
      landing_location_id uuid, duration_minutes integer, group_id uuid, event_id uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE training_items(id uuid PRIMARY KEY, name text, sort_order integer);
    CREATE TABLE flight_events(id uuid PRIMARY KEY, group_id uuid, title text, event_date timestamptz, status text, end_date date, event_category text DEFAULT 'height_flight');
    CREATE TABLE event_signups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, user_id uuid, signed_up boolean,
      status text DEFAULT 'confirmed', confirmed_by_school boolean NOT NULL DEFAULT false, attended boolean NOT NULL DEFAULT false,
      updated_at timestamptz DEFAULT now(), UNIQUE(event_id, user_id));
    CREATE TABLE event_staff(event_id uuid, user_id uuid, role text);
    CREATE TABLE student_day_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, student_user_id uuid, instructor_id uuid,
      note text, flight_number integer, visible_to_student boolean DEFAULT false, created_at timestamptz DEFAULT now());
    CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u = '${instructor}' $$;
    CREATE FUNCTION is_group_team_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u = '${instructor}' $$;
    CREATE FUNCTION is_group_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT INSERT, UPDATE, DELETE ON flights, locations TO authenticated;
    INSERT INTO groups VALUES ('${school}','school','Vertical');
    INSERT INTO group_members VALUES ('${school}','${anna}'),('${school}','${beat}'),('${school}','${instructor}');
    INSERT INTO profiles VALUES ('${anna}','Anna','12345'),('${instructor}','Iris',NULL);
    INSERT INTO flight_events(id,group_id,title,event_date,status) VALUES ('${event}','${school}','Höhenflüge',now(),'confirmed');
    INSERT INTO event_signups(event_id,user_id,signed_up) VALUES ('${event}','${anna}',true),('${event}','${beat}',true);
  `);
  for (const m of ["0050_event_school_flights.sql", "0051_flight_day_presence.sql", "0052_school_flight_items.sql",
    "0053_flight_day_landing_hint.sql", "0054_flight_day_feedback_release.sql", "0057_school_flight_logbook.sql",
    "0058_school_student_proof.sql", "0060_school_flight_link_consistency.sql",
    "0063_official_sites.sql", "0064_own_site_names.sql", "0065_location_display_names.sql"]) {
    await db.exec(migration(m));
  }
  // The feed and flight list functions read tables this test does not build; only the school reads run here.
  await db.exec(`SET check_function_bodies = off; ${migration("0066_viewer_site_names.sql")} RESET check_function_bodies;`);
  await db.exec(`
    INSERT INTO official_sites (id, source_id, source_name, name_de, name_fr, name_en, type, latitude, longitude, country_code) VALUES
      ('40000000-0000-0000-0000-000000000001','1','Niederbauen Startplatz','Niederbauen','Niederbauen','Niederbauen','takeoff',46.9,8.5,'CH'),
      ('40000000-0000-0000-0000-000000000002','2','Niederbauen Landeplatz 1','Emmetten 1','Emmetten 1','Emmetten 1','landing',46.95,8.51,'CH');
    INSERT INTO locations (id, user_id, name, official_site_id) VALUES
      ('${takeoff}','${instructor}','x','40000000-0000-0000-0000-000000000001'),
      ('${landing}','${instructor}','x','40000000-0000-0000-0000-000000000002'),
      ('${takeoff2}','${instructor}','x','40000000-0000-0000-0000-000000000001'),
      ('${annaOwn}','${anna}','x','40000000-0000-0000-0000-000000000001');
    INSERT INTO locations (id, user_id, name) VALUES ('${annaWiese}','${anna}','Annas Wiese');
    UPDATE locations SET name='Schulstart' WHERE id='${takeoff}';
    UPDATE locations SET name='Hausberg' WHERE id='${annaOwn}';
  `);
  await as(instructor, async () => {
    await db.query("SELECT set_flight_day_locations($1,$2,$3)", [event, takeoff, landing]);
    await db.query("SELECT school_flight_add($1,$2)", [event, anna]);
    await db.query("SELECT set_flight_day_locations($1,$2,$3)", [event, takeoff2, landing]);
    await db.query("SELECT school_flight_add($1,$2)", [event, anna]);
  });
  await db.exec(`UPDATE flight_events SET feedback_released_at = now() WHERE id='${event}';`);
}, 60_000);
afterAll(async () => { await db?.close(); });

describe("place names from the viewer's side", () => {
  it("shows own places as named, also linked ones", async () => {
    expect(await label(instructor, takeoff)).toBe("Schulstart");
    expect(await label(anna, annaOwn)).toBe("Hausberg");
  });

  it("shows another's place on an official site under the viewer's own name, else the official one", async () => {
    expect(await label(anna, takeoff)).toBe("Hausberg");
    expect(await label(beat, takeoff)).toBe("Niederbauen");
    expect(await label(anna, landing)).toBe("Emmetten 1");
  });

  it("keeps the owner's name for places that are not official", async () => {
    expect(await label(instructor, annaWiese)).toBe("Annas Wiese");
  });

  it("gives the official name regardless of who asks", async () => {
    expect(await label(anna, takeoff, "official_name")).toBe("Niederbauen");
    expect(await label(instructor, annaWiese, "official_name")).toBe("Annas Wiese");
  });
});

describe("school reads", () => {
  it("SHV proof: official names and one site for two school places at the same official site", async () => {
    const proof = await as(instructor, async () => (await db.query<{ p: { sites: number; flights: { takeoff: string; landing: string }[] } }>(
      "SELECT school_student_proof($1,$2) AS p", [school, anna])).rows[0].p);
    expect(proof.flights.map((f) => [f.takeoff, f.landing])).toEqual([["Niederbauen", "Emmetten 1"], ["Niederbauen", "Emmetten 1"]]);
    expect(proof.sites).toBe(1);
  });

  it("the student sees the school's sites under her own name", async () => {
    const flights = await as(anna, async () => (await db.query<{ f: { takeoff: string; landing: string }[] }>(
      "SELECT my_school_flights($1) AS f", [event])).rows[0].f);
    expect(flights.map((f) => [f.takeoff, f.landing])).toEqual([["Hausberg", "Emmetten 1"], ["Hausberg", "Emmetten 1"]]);
  });
});
