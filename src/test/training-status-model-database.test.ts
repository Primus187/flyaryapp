// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0089: one vocabulary for the training level, self-declared pilot licence, licence goal.
let db: PGlite;
const pilot = "00000000-0000-0000-0000-000000000001";
const student = "00000000-0000-0000-0000-000000000002";
const instructor = "00000000-0000-0000-0000-000000000003";
const legacy = "00000000-0000-0000-0000-000000000004";
const school = "10000000-0000-0000-0000-000000000002";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE groups(id uuid PRIMARY KEY, group_type text);
    CREATE TABLE group_members(group_id uuid, user_id uuid);
    CREATE TABLE group_member_functions(group_id uuid, user_id uuid, function text);
    INSERT INTO groups VALUES ('${school}', 'school');
    INSERT INTO group_members VALUES ('${school}', '${student}'), ('${school}', '${instructor}');
    INSERT INTO group_member_functions VALUES ('${school}', '${instructor}', 'instructor');
    CREATE FUNCTION is_group_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM group_members WHERE user_id = u AND group_id = g) $$;
    CREATE FUNCTION is_group_team_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM group_member_functions WHERE user_id = u AND group_id = g) $$;
    CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT is_group_team_member(u, g) $$;
    CREATE FUNCTION is_school_student(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS (SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_id = u AND g.group_type = 'school' AND NOT is_group_team_member(u, g.id)) $$;
    CREATE TABLE profiles(user_id uuid PRIMARY KEY, training_level text DEFAULT 'grundkurs', pilot_name text, updated_at timestamptz);
    INSERT INTO profiles (user_id, training_level) VALUES ('${pilot}', 'pilot'), ('${student}', 'grundkurs'), ('${instructor}', NULL), ('${legacy}', 'siku');
    GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
    CREATE TABLE training_level_history(id serial PRIMARY KEY, group_id uuid NOT NULL, user_id uuid NOT NULL, training_level text NOT NULL, changed_by uuid NOT NULL, changed_at timestamptz NOT NULL DEFAULT now());
    INSERT INTO training_level_history (group_id, user_id, training_level, changed_by) VALUES ('${school}', '${student}', 'grundkurs', '${instructor}');
    CREATE TABLE pilot_licences(id serial PRIMARY KEY, user_id uuid NOT NULL, discipline text NOT NULL, level text NOT NULL, issued_at date NOT NULL);
    GRANT SELECT, INSERT ON pilot_licences TO authenticated; GRANT USAGE ON SEQUENCE pilot_licences_id_seq TO authenticated;
    CREATE FUNCTION set_member_training_level(_group_id uuid, _user_id uuid, _training_level text) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
    GRANT EXECUTE ON FUNCTION set_member_training_level(uuid, uuid, text) TO authenticated;
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0089_training_status_model.sql", import.meta.url), "utf8"));
}, 60_000);
afterAll(async () => { await db?.close(); });

async function as(uid: string) { await db.exec(`RESET ROLE; SET app.user_id='${uid}'; SET ROLE authenticated;`); }
async function level(uid: string) {
  return (await db.query<{ training_level: string | null }>(`SELECT training_level FROM profiles WHERE user_id = '${uid}'`)).rows[0].training_level;
}
async function history(uid: string) {
  await db.exec("RESET ROLE");
  return (await db.query(`SELECT training_level, changed_by FROM training_level_history WHERE user_id = '${uid}' ORDER BY id`)).rows;
}

describe("training status model", () => {
  it("merges the two vocabularies and drops the default", async () => {
    expect(await level(pilot)).toBe("licensed");
    expect(await level(student)).toBe("ground");
    expect(await level(legacy)).toBe("licensed");
    expect(await level(instructor)).toBeNull();
    expect(await history(student)).toEqual([{ training_level: "ground", changed_by: instructor }]);
    await db.exec("INSERT INTO profiles (user_id) VALUES ('00000000-0000-0000-0000-000000000009')");
    expect(await level("00000000-0000-0000-0000-000000000009")).toBeNull();
  });

  it("translates old values on write and refuses unknown ones", async () => {
    await as(pilot);
    await db.exec(`UPDATE profiles SET training_level = 'brevetkurs' WHERE user_id = '${pilot}'`);
    expect(await level(pilot)).toBe("altitude");
    await expect(db.exec(`UPDATE profiles SET training_level = 'expert' WHERE user_id = '${pilot}'`)).rejects.toThrow(/profiles_training_level_check/);
    await db.exec(`UPDATE profiles SET training_level = 'pilot' WHERE user_id = '${pilot}'`);
    expect(await level(pilot)).toBe("licensed");
    // Outside a school nothing is logged.
    expect(await history(pilot)).toEqual([]);
  });

  it("lets a school student declare the pilot licence, but no other level", async () => {
    await as(student);
    await expect(db.exec(`UPDATE profiles SET training_level = 'exam_ready' WHERE user_id = '${student}'`)).rejects.toThrow(/flight school sets/);
    // A cached app version sends the old word for the unchanged level.
    await db.exec(`UPDATE profiles SET training_level = 'grundkurs', pilot_name = 'Sam' WHERE user_id = '${student}'`);
    await db.exec(`UPDATE profiles SET training_level = 'licensed' WHERE user_id = '${student}'`);
    expect(await level(student)).toBe("licensed");
    await as(student);
    await expect(db.exec(`UPDATE profiles SET training_level = 'ground' WHERE user_id = '${student}'`)).rejects.toThrow(/flight school sets/);
    expect(await history(student)).toEqual([
      { training_level: "ground", changed_by: instructor },
      { training_level: "licensed", changed_by: student },
    ]);
  });

  it("lets the school set levels in the same vocabulary", async () => {
    await as(instructor);
    await db.exec(`SELECT set_member_training_level('${school}', '${student}', 'brevetkurs')`);
    expect(await level(student)).toBe("altitude");
    await expect(db.exec(`SELECT set_member_training_level('${school}', '${student}', 'expert')`)).rejects.toThrow(/Unknown training level/);
    await db.exec(`SELECT set_member_training_level('${school}', '${student}', 'licensed')`);
    await as(student);
    await expect(db.exec(`SELECT set_member_training_level('${school}', '${student}', 'ground')`)).rejects.toThrow(/Not authorized/);
    expect((await history(student)).slice(2)).toEqual([
      { training_level: "altitude", changed_by: instructor },
      { training_level: "licensed", changed_by: instructor },
    ]);
  });

  it("makes the holder of a licence a pilot and logs it for the school", async () => {
    await as(instructor);
    await db.exec(`SELECT set_member_training_level('${school}', '${student}', 'exam_ready')`);
    await as(student);
    await db.exec(`INSERT INTO pilot_licences (user_id, discipline, level, issued_at) VALUES ('${student}', 'paraglider', 'pilot', '2026-10-01')`);
    expect(await level(student)).toBe("licensed");
    expect((await history(student)).at(-1)).toEqual({ training_level: "licensed", changed_by: student });
  });

  it("accepts only licences with requirements as a goal", async () => {
    await as(pilot);
    await db.exec(`UPDATE profiles SET licence_goal = 'biplace_1' WHERE user_id = '${pilot}'`);
    await expect(db.exec(`UPDATE profiles SET licence_goal = 'instructor' WHERE user_id = '${pilot}'`)).rejects.toThrow(/profiles_licence_goal_check/);
    await db.exec(`UPDATE profiles SET licence_goal = NULL WHERE user_id = '${pilot}'`);
  });
});
