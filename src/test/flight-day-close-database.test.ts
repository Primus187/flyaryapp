// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const instructor = "00000000-0000-0000-0000-000000000001";
const helper = "00000000-0000-0000-0000-000000000002";
const anna = "00000000-0000-0000-0000-000000000003";
const beat = "00000000-0000-0000-0000-000000000004";
const carla = "00000000-0000-0000-0000-000000000005";
const lead = "00000000-0000-0000-0000-000000000006";
const school = "10000000-0000-0000-0000-000000000001";
const event = "20000000-0000-0000-0000-000000000001";
const oldDay = "20000000-0000-0000-0000-000000000002";
const takeoff = "30000000-0000-0000-0000-000000000001";
const wing = "50000000-0000-0000-0000-000000000001";
const harness = "50000000-0000-0000-0000-000000000002";
const loanAnna = "60000000-0000-0000-0000-000000000001";
const loanOld = "60000000-0000-0000-0000-000000000002";

const migration = (name: string) => readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    CREATE TABLE groups(id uuid PRIMARY KEY, group_type text);
    CREATE TABLE locations(id uuid PRIMARY KEY, name text, user_id uuid);
    CREATE TABLE flights(id uuid PRIMARY KEY);
    CREATE TABLE training_items(id uuid PRIMARY KEY, name text, sort_order integer);
    CREATE TABLE profiles(user_id uuid PRIMARY KEY, pilot_name text);
    CREATE TABLE flight_events(id uuid PRIMARY KEY, group_id uuid, title text, event_date timestamptz, status text, end_date date);
    CREATE TABLE event_signups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, user_id uuid, signed_up boolean,
      status text DEFAULT 'confirmed', confirmed_by_school boolean NOT NULL DEFAULT false, attended boolean NOT NULL DEFAULT false,
      updated_at timestamptz DEFAULT now(), UNIQUE(event_id, user_id));
    CREATE TABLE event_staff(event_id uuid, user_id uuid, role text);
    CREATE TABLE group_member_functions(group_id uuid, user_id uuid, function text);
    CREATE TABLE student_day_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, student_user_id uuid, instructor_id uuid,
      note text, flight_number integer, visible_to_student boolean DEFAULT false, is_next_step boolean DEFAULT false, created_at timestamptz DEFAULT now());
    CREATE POLICY "Students can view own visible notes" ON student_day_notes FOR SELECT USING (student_user_id = auth.uid());
    CREATE TABLE school_equipment(id uuid PRIMARY KEY, group_id uuid, name text, inventory_number text, status text);
    CREATE TABLE equipment_assignments(id uuid PRIMARY KEY, group_id uuid, user_id uuid, equipment_id uuid, event_id uuid,
      assigned_on date, returned_on date, updated_at timestamptz DEFAULT now());
    CREATE TABLE school_rates(group_id uuid, rate_key text, amount numeric, valid_from date);
    CREATE TABLE launch_leader_credits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid, user_id uuid, event_id uuid,
      entry_type text, booking_date date, days numeric, amount numeric, created_by uuid);
    CREATE TABLE billing_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid, user_id uuid, event_id uuid, item_type text,
      description text, quantity numeric, unit_amount numeric, amount numeric, billing_date date, created_by uuid);
    CREATE TABLE pushes(user_id uuid, title text, body text, url text);
    CREATE FUNCTION send_push_notification(_user_id uuid, _title text, _body text, _url text) RETURNS void LANGUAGE sql AS $$
      INSERT INTO pushes VALUES (_user_id, _title, _body, _url) $$;
    CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u IN ('${instructor}','${lead}') $$;
    CREATE FUNCTION is_group_team_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u IN ('${instructor}','${lead}','${helper}') $$;
    CREATE FUNCTION is_group_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    INSERT INTO groups VALUES ('${school}','school');
    INSERT INTO locations VALUES ('${takeoff}','Niederbauen','${instructor}');
    INSERT INTO profiles VALUES ('${instructor}','Iris');
    INSERT INTO flight_events(id,group_id,title,event_date,status) VALUES ('${event}','${school}','Höhenflüge',now(),'confirmed'),
      ('${oldDay}','${school}','Vorgestern',now()-interval '2 days','confirmed');
    INSERT INTO event_signups(event_id,user_id,signed_up) VALUES ('${event}','${anna}',true),('${event}','${beat}',true),('${event}','${carla}',true),
      ('${oldDay}','${anna}',true);
    INSERT INTO event_staff VALUES ('${event}','${helper}','launch_helper'),('${event}','${instructor}','instructor');
    INSERT INTO group_member_functions VALUES ('${school}','${lead}','school_lead'),('${school}','${instructor}','instructor');
    INSERT INTO school_equipment VALUES ('${wing}','${school}','Schulschirm M','S-1','assigned'),('${harness}','${school}','Gurtzeug','G-1','assigned');
    INSERT INTO equipment_assignments(id,group_id,user_id,equipment_id,event_id,assigned_on) VALUES
      ('${loanAnna}','${school}','${anna}','${wing}','${event}',current_date),
      ('${loanOld}','${school}','${beat}','${harness}',NULL,current_date - 30);
    INSERT INTO school_rates VALUES ('${school}','launch_leader_per_day',40,current_date - 400),('${school}','launch_leader_per_day',50,current_date - 10),
      ('${school}','rental_per_day',30,current_date - 10);
  `);
  for (const m of ["0050_event_school_flights.sql", "0051_flight_day_presence.sql", "0052_school_flight_items.sql",
    "0053_flight_day_landing_hint.sql", "0054_flight_day_feedback_release.sql", "0055_flight_day_close.sql"]) {
    await db.exec(migration(m));
  }
}, 60_000);
afterAll(async () => { await db?.close(); });

async function asUser(user: string) { await db.exec(`RESET ROLE; SET app.user_id='${user}'; SET ROLE authenticated;`); }
async function rows<T>(sql: string, params: unknown[] = []) { await db.exec("RESET ROLE"); return (await db.query<T>(sql, params)).rows; }
type Preview = {
  inAir: { flightId: string }[]; expected: string[]; missingTakeoff: number; creditRate: number; rentalRate: number;
  loans: { id: string; userId: string }[]; credits: { userId: string; booked: boolean }[];
  rentals: { userId: string; hasLoan: boolean; booked: boolean }[]; summaries: { studentId: string; hasSummary: boolean; feedback: string[] }[];
  closedAt: string | null; closedBy: string | null;
};
const preview = async () => (await db.query<{ p: Preview }>("SELECT flight_day_close_preview($1) AS p", [event])).rows[0].p;

describe("closing a flying day", () => {
  it("previews what is still open and what would be booked", async () => {
    await asUser(helper);
    await db.query("SELECT set_signup_presence($1,$2,'present')", [event, beat]);
    await db.query("SELECT school_flight_start($1,$2)", [event, anna]);
    await asUser(instructor);
    const flight = (await db.query<{ id: string }>("SELECT id FROM event_school_flights WHERE student_user_id=$1", [anna])).rows[0];
    const p = await preview();
    expect(p.inAir).toEqual([{ flightId: flight.id, studentId: anna }]);
    expect(p.expected).toEqual([carla]);
    expect(p.creditRate).toBe(50);
    expect(p.rentalRate).toBe(30);
    expect(p.credits).toEqual([{ userId: helper, booked: false }]);
    expect(p.rentals.find((r) => r.userId === anna)).toMatchObject({ hasLoan: true, booked: false });
    expect(p.rentals.find((r) => r.userId === beat)).toMatchObject({ hasLoan: true, booked: false });
    expect(p.loans.map((l) => l.id).sort()).toEqual([loanAnna, loanOld].sort());
    expect(p.missingTakeoff).toBe(0);
  });

  it("refuses to close while someone is in the air", async () => {
    await asUser(instructor);
    await expect(db.query("SELECT close_flight_day($1)", [event])).rejects.toThrow("Flights still in the air");
  });

  it("fills the day's take-off into flights without one", async () => {
    await asUser(instructor);
    const flight = (await db.query<{ id: string }>("SELECT id FROM event_school_flights WHERE student_user_id=$1", [anna])).rows[0];
    await db.query("SELECT school_flight_land($1,NULL,$2)", [flight.id, JSON.stringify({ feedback: "Anflug sauber" })]);
    await expect(db.query("SELECT school_flight_fill_takeoff($1)", [event])).rejects.toThrow("No take-off site set");
    await db.query("SELECT set_flight_day_locations($1,$2,NULL)", [event, takeoff]);
    expect((await db.query<{ n: number }>("SELECT school_flight_fill_takeoff($1) AS n", [event])).rows[0].n).toBe(1);
    const p = await preview();
    expect(p.missingTakeoff).toBe(0);
    expect(p.summaries.find((s) => s.studentId === anna)).toEqual({ studentId: anna, hasSummary: false, feedback: ["Anflug sauber"] });
  });

  it("returns loans, books only the chosen items once, closes, releases and pushes once", async () => {
    await asUser(instructor);
    const result = (await db.query<{ r: Record<string, number> }>("SELECT close_flight_day($1,$2,$3,$4) AS r",
      [event, [helper], [anna, carla], [loanAnna]])).rows[0].r;
    // carla is not present, so no rental item for her.
    expect(result).toEqual({ credits: 1, items: 1, returned: 1, notified: 1 });
    expect(await rows("SELECT user_id, amount FROM launch_leader_credits")).toEqual([{ user_id: helper, amount: "50" }]);
    expect(await rows("SELECT user_id, amount, description FROM billing_items")).toEqual([{ user_id: anna, amount: "30", description: "Materialmiete Flugtag" }]);
    expect(await rows("SELECT status FROM school_equipment WHERE id=$1", [wing])).toEqual([{ status: "in_stock" }]);
    expect((await rows<{ returned_on: string | null }>("SELECT returned_on FROM equipment_assignments WHERE id=$1", [loanOld]))[0].returned_on).toBeNull();
    expect(await rows("SELECT user_id, url FROM pushes")).toEqual([{ user_id: anna, url: `/events/${event}?tab=feedback` }]);
    const ev = (await rows<{ day_closed_at: string | null; feedback_released_at: string | null }>("SELECT day_closed_at, feedback_released_at FROM flight_events WHERE id=$1", [event]))[0];
    expect(ev.day_closed_at).not.toBeNull();
    expect(ev.feedback_released_at).not.toBeNull();

    await asUser(instructor);
    expect((await preview()).closedBy).toBe("Iris");
    await expect(db.query("SELECT close_flight_day($1)", [event])).rejects.toThrow("Flight day is closed");
    await expect(db.query("SELECT school_flight_add($1,$2)", [event, beat])).rejects.toThrow("Flight day is closed");
  });

  it("reopens without cancelling and never books or pushes twice", async () => {
    await asUser(instructor);
    await db.query("SELECT reopen_flight_day($1)", [event]);
    await db.query("SELECT school_flight_add($1,$2)", [event, beat]);
    const result = (await db.query<{ r: Record<string, number> }>("SELECT close_flight_day($1,$2,$3,'{}') AS r", [event, [helper], [anna, beat]])).rows[0].r;
    expect(result).toEqual({ credits: 0, items: 1, returned: 0, notified: 0 });
    expect(await rows("SELECT count(*)::int AS n FROM launch_leader_credits")).toEqual([{ n: 1 }]);
    expect(await rows("SELECT user_id FROM billing_items ORDER BY user_id")).toEqual([{ user_id: anna }, { user_id: beat }]);
    expect(await rows("SELECT count(*)::int AS n FROM pushes")).toEqual([{ n: 1 }]);
  });

  it("lets only the day's instructors preview, close and reopen", async () => {
    for (const user of [helper, anna, ""]) {
      await asUser(user);
      await expect(preview()).rejects.toThrow("Flight day access required");
      await expect(db.query("SELECT reopen_flight_day($1)", [event])).rejects.toThrow("Flight day access required");
      await expect(db.query("SELECT close_flight_day($1)", [oldDay])).rejects.toThrow("Flight day access required");
    }
  });
});

describe("daily run", () => {
  it("releases and pushes unclosed days once from 06:00 the day after and reminds the instructors once", async () => {
    await asUser(instructor);
    await db.query("SELECT school_flight_add($1,$2)", [oldDay, anna]);
    await db.exec("RESET ROLE; DELETE FROM pushes;");
    const run = async () => (await db.query<{ r: Record<string, number> }>("SELECT flight_day_daily_run(now() - interval '30 days') AS r")).rows[0].r;
    expect(await run()).toEqual({ released: 1, reminded: 1 });
    const pushes = await rows<{ user_id: string; title: string }>("SELECT user_id, title FROM pushes ORDER BY title, user_id");
    // The old day has no event_staff instructor, so the school's instructors and lead are reminded.
    expect(pushes).toEqual([
      { user_id: anna, title: "Deine Rückmeldung ist da" },
      { user_id: instructor, title: "Flugtag noch offen" },
      { user_id: lead, title: "Flugtag noch offen" },
    ]);
    expect(await run()).toEqual({ released: 0, reminded: 0 });
    // Days before the start date never trigger anything.
    await db.exec(`RESET ROLE; UPDATE flight_events SET feedback_notified_at=NULL, close_reminded_at=NULL WHERE id='${oldDay}';`);
    expect((await db.query<{ r: Record<string, number> }>("SELECT flight_day_daily_run(now()) AS r")).rows[0].r).toEqual({ released: 0, reminded: 0 });
  });
});
