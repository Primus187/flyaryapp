// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

// Isolated PostgreSQL fixture: real RLS and invoker execution, no production connection.
// Only columns/policies needed by migration 0015 are represented here.
let db: PGlite;
const student = "00000000-0000-0000-0000-000000000001";
const teacher = "00000000-0000-0000-0000-000000000002";
const outsider = "00000000-0000-0000-0000-000000000003";
const school = "10000000-0000-0000-0000-000000000001";
const otherSchool = "10000000-0000-0000-0000-000000000002";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE group_members(group_id uuid, user_id uuid, role text);
    CREATE FUNCTION is_group_admin(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM group_members WHERE user_id=u AND group_id=g AND role='admin') $$;
    CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT is_group_admin(u,g) $$;
    CREATE TABLE locations(id uuid PRIMARY KEY, name text);
    CREATE TABLE flights(id uuid PRIMARY KEY, user_id uuid, date date, glider text, duration_minutes integer, altitude_gain integer, distance_km numeric, group_id uuid, takeoff_location_id uuid, landing_location_id uuid);
    CREATE TABLE igc_tracks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flight_id uuid, track_data jsonb);
    CREATE TABLE flight_events(id uuid PRIMARY KEY, group_id uuid, title text, event_date timestamptz, status text);
    CREATE TABLE student_day_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, student_user_id uuid, flight_number integer, note text, is_next_step boolean);
    CREATE TABLE student_status_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid, student_id uuid, status text, reason text, changed_at timestamptz);
    CREATE TABLE profiles(user_id uuid, pilot_name text, training_level text);
    CREATE TABLE training_items(id uuid PRIMARY KEY, is_exam_maneuver boolean);
    CREATE TABLE training_progress(user_id uuid, item_id uuid, rating integer);
    CREATE TABLE event_signups(event_id uuid, user_id uuid, signed_up boolean);
    CREATE TABLE billing_items(group_id uuid, amount numeric, paid_at timestamptz);
    CREATE TABLE training_level_history(group_id uuid, user_id uuid, training_level text, changed_at timestamptz);
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
    CREATE POLICY flights_read ON flights FOR SELECT TO authenticated USING(user_id=auth.uid() OR is_group_staff(auth.uid(),group_id));
    ALTER TABLE igc_tracks ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tracks_read ON igc_tracks FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM flights WHERE id=flight_id));
    ALTER TABLE student_status_history ENABLE ROW LEVEL SECURITY;
    CREATE POLICY status_read ON student_status_history FOR SELECT TO authenticated USING(is_group_staff(auth.uid(),group_id));
    INSERT INTO group_members VALUES ('${school}', '${student}', 'member'), ('${school}', '${teacher}', 'admin');
    INSERT INTO profiles VALUES ('${student}', 'Student', 'grundkurs');
    INSERT INTO flights(id,user_id,date,glider,group_id)
      SELECT md5(i::text)::uuid, '${student}', '2026-09-21', 'Wing '||i, '${school}' FROM generate_series(1,85) i;
    INSERT INTO flights(id,user_id,date,glider,group_id) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff','${outsider}','2026-09-21','Private','${otherSchool}');
    INSERT INTO igc_tracks(flight_id,track_data) SELECT md5('1')::uuid, jsonb_agg(jsonb_build_array(46+i/10000.0,7+i/10000.0,i)) FROM generate_series(0,9999) i;
    INSERT INTO flight_events VALUES ('20000000-0000-0000-0000-000000000001','${school}','Past',now()-interval '1 day','confirmed');
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0015_performance_read_models.sql", import.meta.url), "utf8"));
}, 60_000);
afterAll(async () => { await db?.close(); });

async function asUser(id: string) {
  await db.exec(`RESET ROLE; SET app.user_id = '${id}'; SET ROLE authenticated;`);
}
async function rpc<T>(sql: string, args: unknown[] = []) {
  const result = await db.query<{ data: T }>(`SELECT ${sql} AS data`, args);
  return result.rows[0].data;
}

it("backfills at most 40 thumbnail points, including both endpoints", async () => {
  await asUser(student);
  const points = await rpc<number[][]>("(SELECT track_thumbnail FROM igc_tracks LIMIT 1)");
  expect(points).toHaveLength(40);
  expect(points[0]).toEqual([46, 7]);
  expect(points.at(-1)).toEqual([46.9999, 7.9999]);
});

it("handles object tracks and malformed input without breaking imports", async () => {
  expect(await rpc("build_track_thumbnail($1::jsonb)", [JSON.stringify({ points: [{ lat: 46, lng: 7 }, { lat: 47, lng: 8 }] })])).toEqual([[46, 7], [47, 8]]);
  expect(await rpc("build_track_thumbnail('null'::jsonb)")).toEqual([]);
  expect(await rpc("build_track_thumbnail('{\"points\":false}'::jsonb)")).toEqual([]);
});

it("paginates deterministically, searches beyond page one, and excludes another pilot", async () => {
  await asUser(student);
  type Page = { rows: { id: string; thumbnail: number[][] }[]; total: number; counts: { all: number } };
  const first = await rpc<Page>("list_flights_page()");
  const second = await rpc<Page>("list_flights_page(40)");
  expect(first.total).toBe(85);
  expect(first.rows).toHaveLength(40);
  expect(second.rows).toHaveLength(40);
  expect(new Set([...first.rows, ...second.rows].map(row => row.id)).size).toBe(80);
  expect(JSON.stringify(first)).not.toContain("track_data");
  const search = await rpc<Page>("list_flights_page(_search => 'Wing 85')");
  expect(search.rows).toHaveLength(1);
  expect(search.counts.all).toBe(85);
  expect((await rpc<Page>("list_flights_page(_filter => 'track')")).total).toBe(1);
  expect((await rpc<Page>("list_flights_page(_viewer_id => $1)", [outsider])).total).toBe(0);
});

it("denies student and other-school access to school aggregates", async () => {
  await asUser(student);
  await expect(rpc("school_dashboard_data($1)", [school])).rejects.toThrow("School staff access required");
  await asUser(teacher);
  await expect(rpc("school_dashboard_data($1)", [otherSchool])).rejects.toThrow("School staff access required");
});

it("returns only requested school summaries and updates counts after a pause", async () => {
  await asUser(teacher);
  const hub = await rpc<{ studentCount: number; openNotesCount: number; students?: unknown }>("school_dashboard_data($1)", [school]);
  expect(hub.studentCount).toBe(1);
  expect(hub.openNotesCount).toBe(1);
  expect(hub.students).toBeUndefined();
  expect(await rpc("school_dashboard_data($1, 'equipment')", [school])).toEqual({ isAdmin: true });
  const students = await rpc<{ students: { flightCount: number }[] }>("school_dashboard_data($1, 'students')", [school]);
  expect(students.students[0].flightCount).toBe(85);
  await db.exec("RESET ROLE");
  await db.query("INSERT INTO student_status_history(group_id,student_id,status,changed_at) VALUES ($1,$2,'paused',now())", [school, student]);
  await asUser(teacher);
  expect((await rpc<{ studentCount: number }>("school_dashboard_data($1)", [school])).studentCount).toBe(0);
});

it("does not grant anonymous RPC execution", async () => {
  await db.exec("RESET ROLE; SET ROLE anon");
  await expect(rpc("list_flights_page()")).rejects.toThrow("permission denied");
  await db.exec("RESET ROLE");
});

it("maintains thumbnails when tracks are inserted and replaced", async () => {
  await db.exec("RESET ROLE");
  const inserted = await db.query<{ id: string; track_thumbnail: number[][] }>(`INSERT INTO igc_tracks(track_data) VALUES ('[[46,7],[47,8]]') RETURNING id,track_thumbnail`);
  expect(inserted.rows[0].track_thumbnail).toEqual([[46, 7], [47, 8]]);
  const updated = await db.query<{ track_thumbnail: number[][] }>(`UPDATE igc_tracks SET track_data='{"points":[{"lat":48,"lng":9},{"lat":49,"lng":10}]}' WHERE id=$1 RETURNING track_thumbnail`, [inserted.rows[0].id]);
  expect(updated.rows[0].track_thumbnail).toEqual([[48, 9], [49, 10]]);
});
