// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0080: flights only in own groups, school students' training level set by the school,
// statistics only for oneself, bucket limits.
let db: PGlite;
const pilot = "00000000-0000-0000-0000-000000000001";
const student = "00000000-0000-0000-0000-000000000002";
const instructor = "00000000-0000-0000-0000-000000000003";
const friends = "10000000-0000-0000-0000-000000000001";
const school = "10000000-0000-0000-0000-000000000002";
const foreign = "10000000-0000-0000-0000-000000000003";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE storage.buckets(id text PRIMARY KEY, file_size_limit bigint, allowed_mime_types text[]);
    INSERT INTO storage.buckets VALUES ('flight-photos', NULL, NULL), ('igc-files', NULL, NULL), ('flight-videos', 52428800, NULL);
    CREATE TABLE groups(id uuid PRIMARY KEY, group_type text);
    CREATE TABLE group_members(group_id uuid, user_id uuid, role text DEFAULT 'member');
    CREATE TABLE group_member_functions(group_id uuid, user_id uuid, function text);
    INSERT INTO groups VALUES ('${friends}', 'pilot_group'), ('${school}', 'school'), ('${foreign}', 'pilot_group');
    INSERT INTO group_members VALUES ('${friends}', '${pilot}'), ('${school}', '${student}'), ('${school}', '${instructor}');
    INSERT INTO group_member_functions VALUES ('${school}', '${instructor}', 'instructor');
    CREATE FUNCTION is_group_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM group_members WHERE user_id = u AND group_id = g) $$;
    CREATE FUNCTION is_group_team_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM group_member_functions WHERE user_id = u AND group_id = g) $$;
    CREATE TABLE flights(id serial PRIMARY KEY, user_id uuid, group_id uuid, date date DEFAULT '2026-09-01', duration_minutes int, takeoff_location_id uuid, landing_location_id uuid, altitude_gain int, distance_km numeric, comments text);
    ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE ON flights TO authenticated; GRANT USAGE ON SEQUENCE flights_id_seq TO authenticated;
    CREATE POLICY own ON flights FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    CREATE TABLE profiles(user_id uuid PRIMARY KEY, training_level text, pilot_name text);
    INSERT INTO profiles VALUES ('${pilot}', 'grundkurs', 'Pia'), ('${student}', 'grundkurs', 'Sam'), ('${instructor}', NULL, 'Iris');
    GRANT SELECT, UPDATE ON profiles TO authenticated;
    CREATE FUNCTION set_member_training_level(_group_id uuid, _user_id uuid, _level text) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ UPDATE profiles SET training_level = _level WHERE user_id = _user_id $$;
    GRANT EXECUTE ON FUNCTION set_member_training_level(uuid, uuid, text) TO authenticated;
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0080_security_low.sql", import.meta.url), "utf8"));
}, 60_000);
afterAll(async () => { await db?.close(); });

async function as(uid: string) { await db.exec(`RESET ROLE; SET app.user_id='${uid}'; SET ROLE authenticated;`); }

describe("security review low findings", () => {
  it("links flights only to own groups, but keeps older flights editable after leaving", async () => {
    await as(pilot);
    await db.exec(`INSERT INTO flights (user_id, group_id) VALUES ('${pilot}', '${friends}'), ('${pilot}', NULL)`);
    await expect(db.exec(`INSERT INTO flights (user_id, group_id) VALUES ('${pilot}', '${foreign}')`)).rejects.toThrow(/Not a member/);
    await expect(db.exec(`UPDATE flights SET group_id = '${foreign}' WHERE group_id IS NULL`)).rejects.toThrow(/Not a member/);
    await db.exec(`RESET ROLE; DELETE FROM group_members WHERE user_id = '${pilot}'`);
    await as(pilot);
    await db.exec(`UPDATE flights SET comments = 'Schön war es' WHERE group_id = '${friends}'`);
    await db.exec(`RESET ROLE; SET app.user_id='${pilot}'; SELECT set_config('flyary.school_flight_link', 'on', false); SET ROLE authenticated`);
    await db.exec(`INSERT INTO flights (user_id, group_id) VALUES ('${pilot}', '${school}')`);
    await db.exec("RESET ROLE; SELECT set_config('flyary.school_flight_link', '', false)");
  });

  it("lets the school, not the student, set a student's training level", async () => {
    await as(student);
    expect((await db.query<{ r: boolean }>("SELECT my_level_set_by_school() AS r")).rows[0].r).toBe(true);
    await expect(db.exec(`UPDATE profiles SET training_level = 'brevetkurs' WHERE user_id = '${student}'`)).rejects.toThrow(/flight school sets/);
    await db.exec(`UPDATE profiles SET pilot_name = 'Sam S.' WHERE user_id = '${student}'`);
    await as(instructor);
    expect((await db.query<{ r: boolean }>("SELECT my_level_set_by_school() AS r")).rows[0].r).toBe(false);
    await db.exec(`SELECT set_member_training_level('${school}', '${student}', 'brevetkurs')`);
    await as(pilot);
    await db.exec(`UPDATE profiles SET training_level = 'brevetkurs' WHERE user_id = '${pilot}'`);
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT user_id, training_level FROM profiles WHERE training_level = 'brevetkurs' ORDER BY user_id")).rows)
      .toEqual([{ user_id: pilot, training_level: "brevetkurs" }, { user_id: student, training_level: "brevetkurs" }]);
  });

  it("returns statistics only for oneself", async () => {
    await as(student);
    expect((await db.query<{ total_flights: number }>(`SELECT total_flights FROM get_pilot_stats('${pilot}')`)).rows[0].total_flights).toBe(0);
    await as(pilot);
    expect((await db.query<{ total_flights: number }>(`SELECT total_flights FROM get_pilot_stats('${pilot}')`)).rows[0].total_flights).toBe(3);
  });

  it("limits size and type of photos and IGC files", async () => {
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id")).rows).toEqual([
      { id: "flight-photos", file_size_limit: 15728640, allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"] },
      { id: "flight-videos", file_size_limit: 52428800, allowed_mime_types: null },
      { id: "igc-files", file_size_limit: 10485760, allowed_mime_types: ["text/*", "application/octet-stream"] },
    ]);
  });
});
