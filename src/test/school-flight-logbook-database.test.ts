// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const instructor = "00000000-0000-0000-0000-000000000001";
const anna = "00000000-0000-0000-0000-000000000003";
const beat = "00000000-0000-0000-0000-000000000004";
const school = "10000000-0000-0000-0000-000000000001";
const event = "20000000-0000-0000-0000-000000000001";
const takeoff = "30000000-0000-0000-0000-000000000001";
const landing = "30000000-0000-0000-0000-000000000002";
const ownFlight = "70000000-0000-0000-0000-000000000001";

const migration = (name: string) => readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");
type Day = { eventId: string; flights: { id: string; number: number; takeoff: string }[]; candidates: { id: string }[] };

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    CREATE TABLE groups(id uuid PRIMARY KEY, group_type text);
    CREATE TABLE locations(id uuid PRIMARY KEY, name text, user_id uuid);
    CREATE TABLE flights(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, date date, takeoff_location_id uuid,
      landing_location_id uuid, duration_minutes integer, group_id uuid, event_id uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE training_items(id uuid PRIMARY KEY, name text, sort_order integer);
    CREATE TABLE flight_events(id uuid PRIMARY KEY, group_id uuid, title text, event_date timestamptz, status text, end_date date);
    CREATE TABLE event_signups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, user_id uuid, signed_up boolean,
      status text DEFAULT 'confirmed', confirmed_by_school boolean NOT NULL DEFAULT false, attended boolean NOT NULL DEFAULT false,
      updated_at timestamptz DEFAULT now(), UNIQUE(event_id, user_id));
    CREATE TABLE event_staff(event_id uuid, user_id uuid, role text);
    CREATE TABLE student_day_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, student_user_id uuid, instructor_id uuid,
      note text, flight_number integer, visible_to_student boolean DEFAULT false, created_at timestamptz DEFAULT now());
    CREATE POLICY "Students can view own visible notes" ON student_day_notes FOR SELECT USING (student_user_id = auth.uid());
    CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u = '${instructor}' $$;
    CREATE FUNCTION is_group_team_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u = '${instructor}' $$;
    CREATE FUNCTION is_group_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT INSERT, UPDATE, DELETE ON flights TO authenticated;
    ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_select ON flights FOR SELECT USING (user_id = auth.uid());
    CREATE POLICY own_insert ON flights FOR INSERT WITH CHECK (user_id = auth.uid());
    CREATE POLICY own_update ON flights FOR UPDATE USING (user_id = auth.uid());
    CREATE POLICY own_delete ON flights FOR DELETE USING (user_id = auth.uid());
    INSERT INTO groups VALUES ('${school}','school');
    INSERT INTO locations VALUES ('${takeoff}','Niederbauen','${instructor}'),('${landing}','Emmetten','${instructor}');
    INSERT INTO flight_events(id,group_id,title,event_date,status) VALUES ('${event}','${school}','Höhenflüge',now(),'confirmed');
    INSERT INTO event_signups(event_id,user_id,signed_up) VALUES ('${event}','${anna}',true),('${event}','${beat}',true);
    INSERT INTO flights(id,user_id,date,group_id,event_id,duration_minutes) VALUES ('${ownFlight}','${anna}',current_date,'${school}','${event}',11);
  `);
  for (const m of ["0050_event_school_flights.sql", "0051_flight_day_presence.sql", "0052_school_flight_items.sql",
    "0053_flight_day_landing_hint.sql", "0054_flight_day_feedback_release.sql", "0057_school_flight_logbook.sql"]) {
    await db.exec(migration(m));
  }
  await db.exec(`SET app.user_id='${instructor}'; SET ROLE authenticated;`);
  await db.query("SELECT set_flight_day_locations($1,$2,$3)", [event, takeoff, landing]);
  await db.query("SELECT school_flight_start($1,$2)", [event, anna]);
  await db.exec(`RESET ROLE; UPDATE event_school_flights SET started_at = now() - interval '14 minutes';`);
  await db.exec(`SET ROLE authenticated;`);
  const inAir = (await db.query<{ id: string }>("SELECT id FROM event_school_flights WHERE status='in_air'")).rows[0];
  await db.query("SELECT school_flight_land($1)", [inAir.id]);
  await db.query("SELECT school_flight_add($1,$2)", [event, anna]);
  await db.query("SELECT school_flight_add($1,$2)", [event, beat]);
  await db.exec("RESET ROLE");
}, 60_000);
afterAll(async () => { await db?.close(); });

async function asUser(user: string) { await db.exec(`RESET ROLE; SET app.user_id='${user}'; SET ROLE authenticated;`); }
const imports = async () => (await db.query<{ d: Day[] }>("SELECT my_school_flight_imports() AS d")).rows[0].d;

describe("taking school flights into the logbook", () => {
  it("offers nothing before the day is released", async () => {
    await asUser(anna);
    expect(await imports()).toEqual([]);
    await expect(db.query("SELECT import_school_flights($1,'[]')", [event])).rejects.toThrow("Flight day not released yet");
  });

  it("lists the released flights with the student's own entries of that day", async () => {
    await db.exec(`RESET ROLE; UPDATE flight_events SET feedback_released_at = now() WHERE id='${event}';`);
    await asUser(anna);
    const [day] = await imports();
    expect(day.eventId).toBe(event);
    expect(day.flights.map((f) => f.number)).toEqual([1, 2]);
    expect(day.flights[0].takeoff).toBe("Niederbauen");
    expect(day.candidates.map((c) => c.id)).toEqual([ownFlight]);
  });

  it("links one flight to an own entry and creates the other", async () => {
    await asUser(anna);
    const [day] = await imports();
    const result = (await db.query<{ r: Record<string, number> }>("SELECT import_school_flights($1,$2) AS r", [event,
      JSON.stringify([{ schoolFlightId: day.flights[1].id, flightId: ownFlight }, { schoolFlightId: day.flights[0].id, flightId: null }])])).rows[0].r;
    expect(result).toEqual({ created: 1, linked: 1 });
    const mine = (await db.query<{ id: string; school_flight_id: string; duration_minutes: number | null; takeoff_location_id: string; event_id: string }>(
      "SELECT id, school_flight_id, duration_minutes, takeoff_location_id, event_id FROM flights ORDER BY created_at")).rows;
    expect(mine).toHaveLength(2);
    // A linked entry keeps its own data; a new one gets date, sites, event and the flight time (14 min).
    expect(mine[0]).toMatchObject({ id: ownFlight, school_flight_id: day.flights[1].id, duration_minutes: 11 });
    expect(mine[1]).toMatchObject({ school_flight_id: day.flights[0].id, takeoff_location_id: takeoff, event_id: event, duration_minutes: 14 });
    expect(await imports()).toEqual([]);
    await db.exec("RESET ROLE");
    const links = (await db.query<{ logbook_flight_id: string | null }>("SELECT logbook_flight_id FROM event_school_flights WHERE student_user_id=$1 ORDER BY seq", [anna])).rows;
    expect(links.map((l) => l.logbook_flight_id)).toEqual([mine[1].id, ownFlight]);
  });

  it("leaves the flight time empty when the start was not recorded", async () => {
    await asUser(beat);
    const [day] = await imports();
    await db.query("SELECT import_school_flights($1,$2)", [event, JSON.stringify([{ schoolFlightId: day.flights[0].id, flightId: null }])]);
    // Beat's flight was recorded without a start: no flight time.
    expect((await db.query<{ duration_minutes: number | null }>("SELECT duration_minutes FROM flights")).rows).toEqual([{ duration_minutes: null }]);
  });

  it("never lets anyone link a school flight directly or take someone else's", async () => {
    await asUser(anna);
    const annaSchool = (await db.query<{ school_flight_id: string }>("SELECT school_flight_id FROM flights WHERE id=$1", [ownFlight])).rows[0].school_flight_id;
    await expect(db.query(`INSERT INTO flights(user_id,date,school_flight_id) VALUES ('${anna}',current_date,$1)`, [annaSchool])).rejects.toThrow("import_school_flights");
    await expect(db.query("UPDATE flights SET school_flight_id=$1 WHERE id <> $2", [annaSchool, ownFlight])).rejects.toThrow();
    await asUser(beat);
    await expect(db.query("SELECT import_school_flights($1,$2)", [event, JSON.stringify([{ schoolFlightId: annaSchool, flightId: null }])]))
      .rejects.toThrow("School flight not available");
  });

  it("keeps the school's record when the student deletes the logbook entry", async () => {
    await asUser(anna);
    await db.query("DELETE FROM flights WHERE id=$1", [ownFlight]);
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT count(*)::int AS n FROM event_school_flights WHERE student_user_id=$1", [anna])).rows).toEqual([{ n: 2 }]);
    await asUser(anna);
    const [day] = await imports();
    expect(day.flights.map((f) => f.number)).toEqual([2]);
  });

  it("hides the day after 'not now'", async () => {
    await asUser(anna);
    await db.query("SELECT dismiss_school_flight_import($1)", [event]);
    expect(await imports()).toEqual([]);
  });
});
