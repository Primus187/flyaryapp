// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const instructor = "00000000-0000-0000-0000-000000000001";
const helper = "00000000-0000-0000-0000-000000000002";
const student = "00000000-0000-0000-0000-000000000003";
const student2 = "00000000-0000-0000-0000-000000000004";
const waitlisted = "00000000-0000-0000-0000-000000000005";
const eventHelper = "00000000-0000-0000-0000-000000000006";
const eventInstructor = "00000000-0000-0000-0000-000000000007";
const foreignTeam = "00000000-0000-0000-0000-000000000008";
const outsider = "00000000-0000-0000-0000-000000000009";
const school = "10000000-0000-0000-0000-000000000001";
const otherSchool = "10000000-0000-0000-0000-000000000002";
const club = "10000000-0000-0000-0000-000000000003";
const event = "20000000-0000-0000-0000-000000000001";
const closedEvent = "20000000-0000-0000-0000-000000000002";
const clubEvent = "20000000-0000-0000-0000-000000000003";
const oldEvent = "20000000-0000-0000-0000-000000000004";
const camp = "20000000-0000-0000-0000-000000000005";
const takeoff = "30000000-0000-0000-0000-000000000001";
const landing = "30000000-0000-0000-0000-000000000002";
const takeoff2 = "30000000-0000-0000-0000-000000000003";
const unused = "30000000-0000-0000-0000-000000000004";
const launch = "40000000-0000-0000-0000-000000000001";
const approach = "40000000-0000-0000-0000-000000000002";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    CREATE TABLE groups(id uuid PRIMARY KEY, group_type text);
    CREATE TABLE group_members(group_id uuid, user_id uuid);
    CREATE TABLE locations(id uuid PRIMARY KEY, name text, user_id uuid);
    CREATE TABLE flights(id uuid PRIMARY KEY);
    CREATE TABLE training_items(id uuid PRIMARY KEY, name text, sort_order integer);
    INSERT INTO training_items VALUES ('${approach}','Landeeinteilung',2),('${launch}','Aufziehen',1);
    CREATE TABLE flight_events(id uuid PRIMARY KEY, group_id uuid, title text, event_date timestamptz, status text, end_date date);
    CREATE TABLE student_day_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, student_user_id uuid, note text, flight_number integer, visible_to_student boolean);
    ALTER TABLE student_day_notes ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Students can view own visible notes" ON student_day_notes FOR SELECT USING (student_user_id = auth.uid() AND visible_to_student = true);
    CREATE TABLE event_signups(event_id uuid, user_id uuid, signed_up boolean, status text);
    CREATE TABLE event_staff(event_id uuid, user_id uuid, role text);
    CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT (u='${instructor}' AND g IN ('${school}','${club}')) OR (u='${foreignTeam}' AND g='${otherSchool}') $$;
    CREATE FUNCTION is_group_team_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT is_group_staff(u, g) OR (u='${helper}' AND g='${school}') $$;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    INSERT INTO groups VALUES ('${school}','school'),('${otherSchool}','school'),('${club}','club');
    INSERT INTO group_members VALUES ('${school}','${student}'),('${school}','${student2}'),('${school}','${instructor}');
    INSERT INTO locations VALUES ('${takeoff}','Niederbauen','${instructor}'),('${landing}','Emmetten','${instructor}'),
      ('${takeoff2}','Klewenalp','${instructor}'),('${unused}','Privat','${instructor}');
    ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own ON locations FOR SELECT USING (user_id = auth.uid());
    INSERT INTO flight_events VALUES ('${event}','${school}','Höhenflüge',now(),'confirmed'),
      ('${closedEvent}','${school}','Gestern',now()-interval '1 day','confirmed'),
      ('${clubEvent}','${club}','Clubtag',now(),'confirmed'),
      ('${oldEvent}','${school}','Früher',now()-interval '3 days','confirmed');
    INSERT INTO flight_events(id,group_id,title,event_date,status,end_date) VALUES ('${camp}','${school}','Camp',now()-interval '3 days','confirmed',(now()+interval '1 day')::date);
    INSERT INTO student_day_notes(event_id,student_user_id,note,flight_number,visible_to_student) VALUES
      ('${oldEvent}','${student}','Alte Rückmeldung',NULL,true),('${oldEvent}','${student}','Intern alt',1,false),
      ('${event}','${student}','Heutige Zusammenfassung',NULL,true),('${camp}','${student}','Camp-Zusammenfassung',NULL,true);
    INSERT INTO event_signups VALUES ('${event}','${student}',true,'confirmed'),('${event}','${student2}',true,'confirmed'),
      ('${event}','${waitlisted}',true,'waitlist'),('${closedEvent}','${student}',true,'confirmed'),('${clubEvent}','${student}',true,'confirmed');
    INSERT INTO event_staff VALUES ('${event}','${eventHelper}','launch_helper'),('${event}','${eventInstructor}','instructor');
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0050_event_school_flights.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0052_school_flight_items.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0053_flight_day_landing_hint.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0054_flight_day_feedback_release.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0059_instructor_ratings.sql", import.meta.url), "utf8"));
  await db.exec(`UPDATE flight_events SET default_takeoff_location_id='${takeoff}', default_landing_location_id='${landing}' WHERE id='${event}';
    UPDATE flight_events SET day_closed_at=now() WHERE id='${closedEvent}';`);
}, 60_000);
afterAll(async () => { await db?.close(); });

async function asUser(user: string) { await db.exec(`RESET ROLE; SET app.user_id='${user}'; SET ROLE authenticated;`); }
async function call<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0];
}
const start = (studentId: string, ev = event) => call<{ id: string; seq: number; status: string; takeoff_location_id: string | null }>(
  "SELECT * FROM school_flight_start($1,$2)", [ev, studentId]);

describe("recording flights", () => {
  it("starts, lands and numbers flights with the day's default sites", async () => {
    await asUser(helper);
    const first = await start(student);
    expect(first).toMatchObject({ seq: 1, status: "in_air", takeoff_location_id: takeoff });
    await expect(start(student)).rejects.toThrow("Student is already in the air");

    await asUser(instructor);
    const landed = await call<{ status: string; landing_location_id: string; landed_by: string }>(
      "SELECT * FROM school_flight_land($1,NULL,$2,$3)", [first.id, JSON.stringify({ feedback: "Anflug sauber", internal_note: "Knie beobachten" }),
        JSON.stringify([{ item_id: launch, rating: 2 }, { item_id: approach, rating: 1 }, { item_id: approach, rating: 3 }])]);
    expect(landed).toMatchObject({ status: "landed", landing_location_id: landing, landed_by: instructor });
    await expect(db.query("SELECT school_flight_land($1)", [first.id])).rejects.toThrow("Flight is not in the air");
    const notes = await call<{ feedback: string; internal_note: string }>("SELECT * FROM event_school_flight_notes WHERE flight_id=$1", [first.id]);
    expect(notes).toMatchObject({ feedback: "Anflug sauber", internal_note: "Knie beobachten" });
    // A maneuver listed twice keeps its last rating.
    expect((await db.query("SELECT training_item_id, rating FROM event_school_flight_items WHERE flight_id=$1 ORDER BY rating", [first.id])).rows)
      .toEqual([{ training_item_id: launch, rating: 2 }, { training_item_id: approach, rating: 3 }]);

    await asUser(helper);
    const second = await call<{ id: string; seq: number; takeoff_location_id: string }>(
      "SELECT * FROM school_flight_start($1,$2,$3,'2. Start')", [event, student, takeoff2]);
    expect(second.seq).toBe(2);
    expect(second.takeoff_location_id).toBe(takeoff2);
    // Without an explicit site, the one used last on this day is taken.
    const other = await start(student2);
    expect(other.takeoff_location_id).toBe(takeoff2);
  });

  it("lets helpers abort a launch and correct the take-off, but not land or write feedback", async () => {
    await asUser(helper);
    const flight = (await db.query<{ id: string }>("SELECT id FROM event_school_flights WHERE student_user_id=$1 AND status='in_air'", [student2])).rows[0];
    const aborted = await call<{ status: string; start_note: string }>("SELECT * FROM school_flight_abort($1,'Aufziehen asymmetrisch')", [flight.id]);
    expect(aborted).toMatchObject({ status: "aborted", start_note: "Aufziehen asymmetrisch" });
    const updated = await call<{ takeoff_location_id: string; start_note: string | null }>(
      "SELECT * FROM school_flight_update($1,$2)", [flight.id, JSON.stringify({ takeoff_location_id: takeoff, start_note: "" })]);
    expect(updated).toMatchObject({ takeoff_location_id: takeoff, start_note: null });
    await expect(db.query("SELECT school_flight_update($1,$2)", [flight.id, JSON.stringify({ landing_location_id: landing })])).rejects.toThrow("Flight day access required");

    const inAir = (await db.query<{ id: string }>("SELECT id FROM event_school_flights WHERE student_user_id=$1 AND status='in_air'", [student])).rows[0];
    for (const [sql, params] of [
      ["SELECT school_flight_land($1)", [inAir.id]],
      ["SELECT school_flight_add($1,$2)", [event, student2]],
      ["SELECT school_flight_set_notes($1,$2)", [inAir.id, JSON.stringify({ feedback: "x" })]],
      ["SELECT school_flight_delete($1)", [inAir.id]],
      ["SELECT set_flight_day_locations($1,NULL,NULL)", [event]],
    ] as const) {
      await expect(db.query(sql, [...params])).rejects.toThrow("Flight day access required");
    }
  });

  it("adds flights without a start, edits notes by key and deletes without renumbering", async () => {
    await asUser(instructor);
    const inAir = (await db.query<{ id: string }>("SELECT id FROM event_school_flights WHERE student_user_id=$1 AND status='in_air'", [student])).rows[0];
    await db.query("SELECT school_flight_land($1)", [inAir.id]);
    const added = await call<{ id: string; seq: number; status: string; started_at: string | null; landing_location_id: string }>(
      "SELECT * FROM school_flight_add($1,$2)", [event, student]);
    expect(added).toMatchObject({ seq: 3, status: "landed", started_at: null, landing_location_id: landing });

    await db.query("SELECT school_flight_set_notes($1,$2)", [added.id, JSON.stringify({ feedback: "Gut" })]);
    await db.query("SELECT school_flight_set_notes($1,$2)", [added.id, JSON.stringify({ internal_note: "Intern" })]);
    expect(await call("SELECT feedback, internal_note FROM event_school_flight_notes WHERE flight_id=$1", [added.id]))
      .toEqual({ feedback: "Gut", internal_note: "Intern" });

    await db.query("SELECT school_flight_delete($1)", [inAir.id]);
    const seqs = (await db.query<{ seq: number }>("SELECT seq FROM event_school_flights WHERE student_user_id=$1 AND event_id=$2 ORDER BY seq", [student, event])).rows;
    expect(seqs.map(r => r.seq)).toEqual([1, 3]);
  });

  it("accepts staff assigned to the event without a school function", async () => {
    await asUser(eventHelper);
    const flight = await start(student2);
    expect(flight.seq).toBe(2);
    await asUser(eventInstructor);
    await expect(db.query("SELECT school_flight_land($1)", [flight.id])).resolves.toBeDefined();
    await db.query("SELECT set_flight_day_locations($1,$2,$3)", [event, takeoff2, landing]);
    await asUser(instructor);
    expect((await call<{ default_takeoff_location_id: string }>("SELECT default_takeoff_location_id FROM flight_events WHERE id=$1", [event])).default_takeoff_location_id).toBe(takeoff2);
  });
});

describe("maneuver ratings", () => {
  it("lets instructors replace and clear ratings, rejecting invalid ones", async () => {
    await asUser(instructor);
    const flight = await call<{ id: string }>("SELECT * FROM school_flight_add($1,$2,NULL,NULL,NULL,$3)", [event, student2, JSON.stringify([{ item_id: launch, rating: 1 }])]);
    await db.query("SELECT school_flight_set_items($1,$2)", [flight.id, JSON.stringify([{ item_id: approach, rating: 2 }])]);
    expect((await db.query("SELECT training_item_id, rating FROM event_school_flight_items WHERE flight_id=$1", [flight.id])).rows)
      .toEqual([{ training_item_id: approach, rating: 2 }]);
    await expect(db.query("SELECT school_flight_set_items($1,$2)", [flight.id, JSON.stringify([{ item_id: launch, rating: 4 }])])).rejects.toThrow();
    await expect(db.query("SELECT school_flight_set_items($1,$2)", [flight.id, JSON.stringify({ item_id: launch })])).rejects.toThrow("Invalid ratings");
    await db.query("SELECT school_flight_set_items($1,$2)", [flight.id, "[]"]);
    expect((await db.query("SELECT * FROM event_school_flight_items WHERE flight_id=$1", [flight.id])).rows).toHaveLength(0);
    await db.query("SELECT school_flight_delete($1)", [flight.id]);
  });

  it("keeps ratings from helpers and rejects their writes", async () => {
    await asUser(helper);
    expect((await db.query("SELECT * FROM event_school_flight_items")).rows).toHaveLength(0);
    const any = (await db.query<{ id: string }>("SELECT id FROM event_school_flights LIMIT 1")).rows[0];
    await expect(db.query("SELECT school_flight_set_items($1,'[]')", [any.id])).rejects.toThrow("Flight day access required");
  });
});

describe("guards", () => {
  it("rejects students without a confirmed place", async () => {
    await asUser(instructor);
    await expect(start(waitlisted)).rejects.toThrow("Student is not signed up for this flight day");
    await expect(start(outsider)).rejects.toThrow("Student is not signed up for this flight day");
  });

  it("rejects every write once the day is closed", async () => {
    await asUser(instructor);
    await expect(start(student, closedEvent)).rejects.toThrow("Flight day is closed");
    await expect(db.query("SELECT school_flight_add($1,$2)", [closedEvent, student])).rejects.toThrow("Flight day is closed");
    await expect(db.query("SELECT set_flight_day_locations($1,NULL,NULL)", [closedEvent])).rejects.toThrow("Flight day is closed");
  });

  it("rejects events of non-school groups, foreign teams, students, outsiders and anonymous users", async () => {
    await asUser(instructor);
    await expect(start(student, clubEvent)).rejects.toThrow("Flight day access required");
    for (const user of [foreignTeam, student, outsider, ""]) {
      await asUser(user);
      await expect(start(student)).rejects.toThrow("Flight day access required");
    }
  });

  it("allows no direct writes, only the RPCs", async () => {
    await asUser(instructor);
    await expect(db.query(`INSERT INTO event_school_flights(event_id,group_id,student_user_id,seq,status,started_at) VALUES ('${event}','${school}','${student}',9,'in_air',now())`)).rejects.toThrow();
    await expect(db.query("UPDATE event_school_flights SET seq=99")).rejects.toThrow();
    await expect(db.query("DELETE FROM event_school_flights")).rejects.toThrow();
    await expect(db.query("UPDATE event_school_flight_notes SET feedback='x'")).rejects.toThrow();
    await expect(db.query("SELECT school_flight_guard($1,'helper')", [event])).rejects.toThrow();
  });
});

describe("reading", () => {
  it("shows flights to the day's team, notes only to instructors", async () => {
    await asUser(instructor);
    const all = (await db.query("SELECT * FROM event_school_flights WHERE event_id=$1", [event])).rows.length;
    expect(all).toBeGreaterThan(0);
    expect((await db.query("SELECT * FROM event_school_flight_notes")).rows.length).toBeGreaterThan(0);
    for (const user of [helper, eventHelper]) {
      await asUser(user);
      expect((await db.query("SELECT * FROM event_school_flights WHERE event_id=$1", [event])).rows).toHaveLength(all);
      expect((await db.query("SELECT * FROM event_school_flight_notes")).rows).toHaveLength(0);
    }
    for (const user of [student, foreignTeam, outsider, ""]) {
      await asUser(user);
      expect((await db.query("SELECT * FROM event_school_flights")).rows).toHaveLength(0);
      expect((await db.query("SELECT * FROM event_school_flight_notes")).rows).toHaveLength(0);
    }
  });

  it("lets the day's team read the names of the day's sites, nobody else", async () => {
    for (const user of [helper, eventHelper, eventInstructor]) {
      await asUser(user);
      expect((await db.query<{ name: string }>("SELECT name FROM locations ORDER BY name")).rows.map(r => r.name)).toEqual(["Emmetten", "Klewenalp", "Niederbauen"]);
    }
    for (const user of [student, foreignTeam, outsider]) {
      await asUser(user);
      expect((await db.query("SELECT name FROM locations")).rows).toHaveLength(0);
    }
  });

  it("gives students their landed flights with feedback only after release", async () => {
    await asUser(student);
    expect((await call<{ data: unknown[] }>("SELECT my_school_flights($1) AS data", [event])).data).toEqual([]);

    await db.exec(`RESET ROLE; UPDATE flight_events SET feedback_released_at=now() WHERE id='${event}';`);
    await asUser(student);
    const mine = (await call<{ data: { number: number; feedback: string | null; takeoff: string }[] }>("SELECT my_school_flights($1) AS data", [event])).data;
    expect(mine.map(f => f.number)).toEqual([1, 2]);
    expect(mine[0]).toMatchObject({ feedback: "Anflug sauber", takeoff: "Niederbauen", items: [{ name: "Aufziehen", rating: 2 }, { name: "Landeeinteilung", rating: 3 }] });
    expect(mine[1].feedback).toBe("Gut");
    expect(JSON.stringify(mine)).not.toMatch(/Knie|Intern|2\. Start|asymmetrisch/);

    // student2 has an aborted launch and one landed flight: only the landed one counts.
    await asUser(student2);
    expect((await call<{ data: unknown[] }>("SELECT my_school_flights($1) AS data", [event])).data).toHaveLength(1);
  });
});

describe("landing hint", () => {
  it("lets instructors switch the hint on and off, nobody else", async () => {
    await asUser(instructor);
    await db.query("SELECT set_flight_day_landing_hint($1,30::smallint)", [event]);
    expect((await call<{ landing_hint_minutes: number | null }>("SELECT landing_hint_minutes FROM flight_events WHERE id=$1", [event])).landing_hint_minutes).toBe(30);
    await expect(db.query("SELECT set_flight_day_landing_hint($1,20::smallint)", [event])).rejects.toThrow();
    await db.query("SELECT set_flight_day_landing_hint($1,NULL)", [event]);
    expect((await call<{ landing_hint_minutes: number | null }>("SELECT landing_hint_minutes FROM flight_events WHERE id=$1", [event])).landing_hint_minutes).toBeNull();
    for (const user of [helper, student, outsider]) {
      await asUser(user);
      await expect(db.query("SELECT set_flight_day_landing_hint($1,15::smallint)", [event])).rejects.toThrow("Flight day access required");
    }
  });
});

describe("feedback release", () => {
  it("releases a day when it is closed or at 06:00 the day after (after the last day of a camp)", async () => {
    await asUser(student);
    const released = async (ev: string) => (await call<{ r: boolean }>("SELECT flight_day_feedback_released($1) AS r", [ev])).r;
    expect(await released(oldEvent)).toBe(true);
    expect(await released(camp)).toBe(false);
    expect(await released(clubEvent)).toBe(false);
    await db.exec(`RESET ROLE; UPDATE flight_events SET feedback_released_at=now() WHERE id='${clubEvent}';`);
    await asUser(student);
    expect(await released(clubEvent)).toBe(true);
  });

  it("shows students their day summaries only once released, never hidden notes", async () => {
    await asUser(student);
    const notes = (await db.query<{ note: string }>("SELECT note FROM student_day_notes ORDER BY note")).rows.map((r) => r.note);
    expect(notes).toContain("Alte Rückmeldung");
    expect(notes).not.toContain("Intern alt");
    expect(notes).not.toContain("Camp-Zusammenfassung");
    // The main event was released by an earlier test (feedback_released_at = now()).
    expect(notes).toContain("Heutige Zusammenfassung");
  });
});

describe("instructor ratings in the training level", () => {
  it("gives students their latest released rating per maneuver", async () => {
    await asUser(student);
    const ratings = (await call<{ r: Record<string, { rating: number; date: string }> }>("SELECT my_instructor_ratings() AS r")).r;
    expect(Object.fromEntries(Object.entries(ratings).map(([k, v]) => [k, v.rating]))).toEqual({ [launch]: 2, [approach]: 3 });
    await asUser(student2);
    expect((await call<{ r: Record<string, unknown> }>("SELECT my_instructor_ratings() AS r")).r).toEqual({});
  });

  it("hides ratings of a day that is not released yet", async () => {
    await db.exec(`RESET ROLE; UPDATE flight_events SET feedback_released_at = NULL WHERE id='${event}';`);
    await asUser(student);
    expect((await call<{ r: Record<string, unknown> }>("SELECT my_instructor_ratings() AS r")).r).toEqual({});
    await db.exec(`RESET ROLE; UPDATE flight_events SET feedback_released_at = now() WHERE id='${event}';`);
  });

  it("shows the school's staff the history per maneuver, nobody else", async () => {
    await asUser(instructor);
    const history = (await call<{ r: Record<string, { rating: number }[]> }>("SELECT school_student_ratings($1,$2) AS r", [school, student])).r;
    expect(history[launch].map((h) => h.rating)).toEqual([2]);
    expect(history[approach].map((h) => h.rating)).toEqual([3]);
    for (const user of [helper, student, foreignTeam]) {
      await asUser(user);
      await expect(db.query("SELECT school_student_ratings($1,$2)", [school, student])).rejects.toThrow("School student access required");
    }
  });
});

