// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const instructor = "00000000-0000-0000-0000-000000000001";
const helper = "00000000-0000-0000-0000-000000000002";
const student = "00000000-0000-0000-0000-000000000003";
const student2 = "00000000-0000-0000-0000-000000000004";
const student3 = "00000000-0000-0000-0000-000000000005";
const outsider = "00000000-0000-0000-0000-000000000009";
const school = "10000000-0000-0000-0000-000000000001";
const event = "20000000-0000-0000-0000-000000000001";
const closedEvent = "20000000-0000-0000-0000-000000000002";
const oldEvent = "20000000-0000-0000-0000-000000000003";

const migration = (name: string) => readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");

beforeAll(async () => {
  db = new PGlite();
  // event_signups as live: members read, everyone writes only their own row.
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    CREATE TABLE groups(id uuid PRIMARY KEY, group_type text);
    CREATE TABLE locations(id uuid PRIMARY KEY, name text);
    CREATE TABLE flights(id uuid PRIMARY KEY);
    CREATE TABLE flight_events(id uuid PRIMARY KEY, group_id uuid, title text, event_date timestamptz, status text);
    CREATE TABLE event_signups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, user_id uuid, signed_up boolean,
      status text DEFAULT 'confirmed', confirmed_by_school boolean NOT NULL DEFAULT false, attended boolean NOT NULL DEFAULT false,
      updated_at timestamptz DEFAULT now(), UNIQUE(event_id, user_id));
    CREATE TABLE event_staff(event_id uuid, user_id uuid, role text);
    CREATE TABLE student_day_notes(id uuid DEFAULT gen_random_uuid(), event_id uuid, student_user_id uuid, instructor_id uuid,
      note text, flight_number integer, created_at timestamptz DEFAULT now());
    CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u='${instructor}' $$;
    CREATE FUNCTION is_group_team_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u IN ('${instructor}','${helper}') $$;
    CREATE FUNCTION is_group_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u <> '${outsider}' $$;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT INSERT, UPDATE, DELETE ON event_signups TO authenticated;
    ALTER TABLE event_signups ENABLE ROW LEVEL SECURITY;
    CREATE POLICY view ON event_signups FOR SELECT USING (EXISTS (SELECT 1 FROM flight_events fe WHERE fe.id = event_id AND is_group_member(auth.uid(), fe.group_id)));
    CREATE POLICY ins ON event_signups FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY upd ON event_signups FOR UPDATE USING (auth.uid() = user_id);
    INSERT INTO groups VALUES ('${school}','school');
    INSERT INTO flight_events VALUES ('${event}','${school}','Heute',now(),'confirmed'),
      ('${closedEvent}','${school}','Gestern',now()-interval '1 day','confirmed'),
      ('${oldEvent}','${school}','Früher',now()-interval '30 days','confirmed');
    INSERT INTO event_signups(event_id,user_id,signed_up,status) VALUES ('${event}','${student}',true,'confirmed'),
      ('${event}','${student2}',true,'confirmed'),('${event}','${student3}',true,'waitlist'),('${closedEvent}','${student}',true,'confirmed');
    INSERT INTO event_signups(event_id,user_id,signed_up,attended) VALUES ('${oldEvent}','${student}',true,true),('${oldEvent}','${student2}',true,false);
    INSERT INTO student_day_notes(event_id,student_user_id,instructor_id,note,flight_number) VALUES
      ('${oldEvent}','${student}','${instructor}','paused',-1),('${oldEvent}','${student}','${instructor}','Summary',NULL);
  `);
  await db.exec(migration("0050_event_school_flights.sql"));
  await db.exec(migration("0051_flight_day_presence.sql"));
  await db.exec(`UPDATE flight_events SET day_closed_at=now() WHERE id='${closedEvent}';`);
}, 60_000);
afterAll(async () => { await db?.close(); });

async function asUser(user: string) { await db.exec(`RESET ROLE; SET app.user_id='${user}'; SET ROLE authenticated;`); }
async function signup(user: string, ev = event) {
  await db.exec("RESET ROLE");
  return (await db.query<{ presence: string; attended: boolean; checked_in_at: string | null; confirmed_by_school: boolean; signed_up: boolean }>(
    "SELECT * FROM event_signups WHERE event_id=$1 AND user_id=$2", [ev, user])).rows[0];
}

describe("migration", () => {
  it("turns attended into presence and keeps attended as a generated column", async () => {
    expect(await signup(student, oldEvent)).toMatchObject({ presence: "present", attended: true });
    expect(await signup(student2, oldEvent)).toMatchObject({ presence: "expected", attended: false });
    await expect(db.query(`UPDATE event_signups SET attended=true`)).rejects.toThrow();
  });

  it("moves the old pause markers into event_day_pauses", async () => {
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT reason FROM event_day_pauses WHERE event_id=$1", [oldEvent])).rows).toEqual([{ reason: "other" }]);
    expect((await db.query("SELECT flight_number FROM student_day_notes")).rows).toEqual([{ flight_number: null }]);
  });
});

describe("check-in", () => {
  it("lets launch helpers check students in, mark them absent and reset", async () => {
    await asUser(helper);
    await db.query("SELECT set_signup_presence($1,$2,'present')", [event, student]);
    const present = await signup(student);
    expect(present).toMatchObject({ presence: "present", attended: true });
    expect(present.checked_in_at).not.toBeNull();
    await asUser(helper);
    await db.query("SELECT set_signup_presence($1,$2,'absent')", [event, student]);
    expect(await signup(student)).toMatchObject({ presence: "absent", checked_in_at: null });
    await asUser(helper);
    await expect(db.query("SELECT set_signup_presence($1,$2,'late')", [event, student])).rejects.toThrow("Invalid presence");
    await expect(db.query("SELECT set_signup_presence($1,$2,'present')", [event, outsider])).rejects.toThrow("Student is not signed up");
  });

  it("checks in only the listed students who are still expected", async () => {
    await asUser(helper);
    const count = (await db.query<{ n: number }>("SELECT set_signups_present($1,$2) AS n", [event, [student, student2]])).rows[0].n;
    expect(count).toBe(1); // student is 'absent' from the previous test and stays so
    expect((await signup(student2)).presence).toBe("present");
    expect((await signup(student)).presence).toBe("absent");
    expect((await signup(student3)).presence).toBe("expected");
  });

  it("checks a student in with the first recorded flight", async () => {
    await asUser(instructor);
    await db.query("SELECT set_signup_presence($1,$2,'expected')", [event, student]);
    await asUser(instructor);
    await db.query("SELECT school_flight_start($1,$2)", [event, student]);
    expect((await signup(student)).presence).toBe("present");
  });

  it("rejects students, outsiders and closed days", async () => {
    for (const user of [student, outsider, ""]) {
      await asUser(user);
      await expect(db.query("SELECT set_signup_presence($1,$2,'present')", [event, student2])).rejects.toThrow("Flight day access required");
      await expect(db.query("SELECT set_day_pause($1,$2,'other')", [event, student2])).rejects.toThrow("Flight day access required");
    }
    await asUser(instructor);
    await expect(db.query("SELECT set_signup_presence($1,$2,'present')", [closedEvent, student])).rejects.toThrow("Flight day is closed");
  });
});

describe("pauses", () => {
  it("pauses with a reason, checks the student in and resumes", async () => {
    await asUser(helper);
    await db.query("SELECT set_day_pause($1,$2,'injury','Knie')", [event, student3]);
    await asUser(helper);
    expect((await db.query("SELECT reason, note FROM event_day_pauses WHERE event_id=$1", [event])).rows).toEqual([{ reason: "injury", note: "Knie" }]);
    expect((await signup(student3)).presence).toBe("present");
    await asUser(instructor);
    await expect(db.query("SELECT set_day_pause($1,$2,'bored')", [event, student3])).rejects.toThrow();
    await db.query("SELECT set_day_pause($1,$2,NULL)", [event, student3]);
    await db.query("SELECT set_day_pause($1,$2,'material')", [event, student3]);
    expect((await db.query("SELECT reason, note FROM event_day_pauses WHERE event_id=$1", [event])).rows).toEqual([{ reason: "material", note: null }]);
  });

  it("keeps pauses from students and outsiders and allows no direct writes", async () => {
    for (const user of [student, student3, outsider]) {
      await asUser(user);
      expect((await db.query("SELECT * FROM event_day_pauses")).rows).toHaveLength(0);
    }
    await asUser(instructor);
    await expect(db.query(`INSERT INTO event_day_pauses(event_id,student_user_id,reason) VALUES ('${event}','${student2}','other')`)).rejects.toThrow();
    await expect(db.query("DELETE FROM event_day_pauses")).rejects.toThrow();
  });
});

describe("school fields on the student's own signup", () => {
  it("ignores a student's changes to presence and school confirmation but keeps signing off", async () => {
    await asUser(student2);
    await db.query("UPDATE event_signups SET presence='absent', checked_in_at=NULL, confirmed_by_school=true, signed_up=false WHERE event_id=$1 AND user_id=$2", [event, student2]);
    expect(await signup(student2)).toMatchObject({ presence: "present", confirmed_by_school: false, signed_up: false });
    expect((await signup(student2)).checked_in_at).not.toBeNull();
  });

  it("resets school fields on a student's own new signup", async () => {
    await asUser(outsider);
    await db.query(`INSERT INTO event_signups(event_id,user_id,signed_up,presence,confirmed_by_school) VALUES ('${closedEvent}','${outsider}',true,'present',true)`);
    expect(await signup(outsider, closedEvent)).toMatchObject({ presence: "expected", confirmed_by_school: false });
  });

  it("lets instructors, not helpers, confirm a signup", async () => {
    await asUser(helper);
    await expect(db.query("SELECT set_signup_confirmed($1,$2,true)", [event, student])).rejects.toThrow("Flight day access required");
    await asUser(instructor);
    await db.query("SELECT set_signup_confirmed($1,$2,true)", [event, student]);
    expect((await signup(student)).confirmed_by_school).toBe(true);
  });
});
