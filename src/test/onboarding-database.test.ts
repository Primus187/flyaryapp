// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0081: onboarding per path (student, school team, pilot), remembered per account.
let db: PGlite;
const existing = "00000000-0000-0000-0000-000000000001";
const newbie = "00000000-0000-0000-0000-000000000002";
const school = "10000000-0000-0000-0000-000000000001";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE profiles(user_id uuid PRIMARY KEY, pilot_name text);
    INSERT INTO profiles VALUES ('${existing}', 'Alt');
    CREATE TABLE groups(id uuid PRIMARY KEY, name text, group_type text);
    INSERT INTO groups VALUES ('${school}', 'Flugschule Beispiel', 'school');
    CREATE TABLE group_members(group_id uuid, user_id uuid, role text DEFAULT 'member', joined_at timestamptz DEFAULT now());
    CREATE TABLE group_member_functions(group_id uuid, user_id uuid, function text);
    CREATE FUNCTION is_group_team_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM group_member_functions WHERE user_id = u AND group_id = g) $$;
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0081_onboarding.sql", import.meta.url), "utf8"));
  await db.exec(`INSERT INTO profiles VALUES ('${newbie}', 'Neu')`);
}, 60_000);
afterAll(async () => { await db?.close(); });

async function as(uid: string) { await db.exec(`RESET ROLE; SET app.user_id='${uid}'; SET ROLE authenticated;`); }
const state = async () => (await db.query<{ o: { show: boolean; kind: string; school: string | null } }>("SELECT my_onboarding() AS o")).rows[0].o;

describe("onboarding per path", () => {
  it("does not show it again to existing accounts", async () => {
    await as(existing);
    expect(await state()).toEqual({ show: false, kind: "pilot", school: null });
  });

  it("shows the pilot introduction once", async () => {
    await as(newbie);
    expect(await state()).toEqual({ show: true, kind: "pilot", school: null });
    await db.exec("SELECT complete_onboarding('pilot')");
    await db.exec("SELECT complete_onboarding('pilot')");
    expect((await state()).show).toBe(false);
    await expect(db.exec("SELECT complete_onboarding('boss')")).rejects.toThrow(/Unknown onboarding/);
  });

  it("shows the school's welcome after joining as student, and the team introduction after becoming staff", async () => {
    await db.exec(`RESET ROLE; INSERT INTO group_members (group_id, user_id) VALUES ('${school}', '${newbie}')`);
    await as(newbie);
    expect(await state()).toEqual({ show: true, kind: "student", school: "Flugschule Beispiel" });
    await db.exec("SELECT complete_onboarding('student')");
    await db.exec(`RESET ROLE; INSERT INTO group_member_functions VALUES ('${school}', '${newbie}', 'instructor')`);
    await as(newbie);
    expect(await state()).toEqual({ show: true, kind: "staff", school: "Flugschule Beispiel" });
    await db.exec("RESET ROLE");
    expect((await db.query(`SELECT onboarding_seen FROM profiles WHERE user_id = '${newbie}'`)).rows).toEqual([{ onboarding_seen: ["pilot", "student"] }]);
  });
});
