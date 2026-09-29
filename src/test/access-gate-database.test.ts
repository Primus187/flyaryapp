// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0079: pilot phase access gate, personal invitations, flight schools only by Flyary admins.
let db: PGlite;
const admin = "00000000-0000-0000-0000-000000000001";
const existing = "00000000-0000-0000-0000-000000000002";
const newbie = "00000000-0000-0000-0000-000000000003";
const other = "00000000-0000-0000-0000-000000000004";
const student = "00000000-0000-0000-0000-000000000005";
const school = "10000000-0000-0000-0000-000000000001";
const schoolCode = "20000000-0000-0000-0000-000000000001";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    INSERT INTO auth.users VALUES ('${admin}', 'admin@flyary.ch', '{}'), ('${existing}', 'old@example.ch', '{}');
    CREATE TABLE profiles(user_id uuid PRIMARY KEY, pilot_name text);
    CREATE TABLE user_roles(user_id uuid, role text);
    INSERT INTO user_roles VALUES ('${admin}', 'admin');
    CREATE FUNCTION has_role(u uuid, r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = u AND role = r) $$;
    CREATE TABLE pushes(user_id uuid, title text, body text, url text);
    CREATE FUNCTION send_push_notification(u uuid, t text, b text, l text) RETURNS void LANGUAGE sql AS $$ INSERT INTO pushes VALUES (u, t, b, l) $$;
    CREATE TABLE groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, group_type text DEFAULT 'pilot_group', created_by uuid, invite_code uuid DEFAULT gen_random_uuid());
    CREATE TABLE group_members(group_id uuid, user_id uuid, role text DEFAULT 'member');
    ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE ON groups TO authenticated;
    CREATE POLICY "read" ON groups FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can create groups" ON groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
    CREATE POLICY "update" ON groups FOR UPDATE TO authenticated USING (created_by = auth.uid());
    CREATE FUNCTION join_group_by_invite_code(_code uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
      DECLARE g uuid; BEGIN SELECT id INTO g FROM groups WHERE invite_code = _code;
      INSERT INTO group_members VALUES (g, auth.uid(), 'member'); RETURN g; END $$;
    GRANT EXECUTE ON FUNCTION join_group_by_invite_code(uuid) TO authenticated;
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0078_pilot_waitlist.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0079_access_gate.sql", import.meta.url), "utf8"));
  // Accounts created after the migration have no access yet.
  await db.exec(`
    INSERT INTO auth.users VALUES ('${newbie}', 'Neu@Example.ch', '{"full_name":"Nora Neu"}'), ('${other}', 'other@example.ch', '{}'), ('${student}', 'student@example.ch', '{}');
    INSERT INTO groups (id, name, group_type, created_by, invite_code) VALUES ('${school}', 'Flugschule Beispiel', 'school', '${admin}', '${schoolCode}');
  `);
}, 60_000);
afterAll(async () => { await db?.close(); });

async function as(uid?: string) {
  await db.exec(`RESET ROLE; ${uid ? `SET app.user_id='${uid}';` : "RESET app.user_id;"} SET ROLE authenticated;`);
}
const access = async () => (await db.query<{ a: { has_access: boolean; waitlisted: boolean; invited: boolean } }>("SELECT my_access() AS a")).rows[0].a;
const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<{ r: T }>(sql, params)).rows[0].r;

describe("pilot phase access", () => {
  it("keeps access for existing accounts and gates new ones", async () => {
    await as(existing);
    expect((await access()).has_access).toBe(true);
    await as(newbie);
    expect(await access()).toEqual({ has_access: false, waitlisted: false, invited: false });
  });

  it("lets a waiting account join the test list once and notifies the admins", async () => {
    await as(newbie);
    expect(await one("SELECT join_waitlist_from_app('de', 'student', ARRAY['paraglider'], 'Flugschule Beispiel', '') AS r")).toBe("ok");
    expect(await one("SELECT join_waitlist_from_app('de', 'pilot', ARRAY['paraglider'], '', 'Nochmals') AS r")).toBe("ok");
    expect(await one("SELECT join_waitlist_from_app('xx', 'pilot', '{}', '', '') AS r")).toBe("invalid");
    expect(await access()).toEqual({ has_access: false, waitlisted: true, invited: false });
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT name, email, role, user_id FROM pilot_waitlist")).rows)
      .toEqual([{ name: "Nora Neu", email: "neu@example.ch", role: "pilot", user_id: newbie }]);
    expect((await db.query("SELECT user_id FROM pushes")).rows).toEqual([{ user_id: admin }]);
  });

  it("does not let a waiting account create groups, and only admins create schools", async () => {
    await as(newbie);
    await expect(db.exec(`INSERT INTO groups (name, created_by) VALUES ('Eigene', '${newbie}')`)).rejects.toThrow(/row-level security/);
    await as(existing);
    await db.exec(`INSERT INTO groups (name, created_by) VALUES ('Freunde', '${existing}')`);
    await expect(db.exec(`INSERT INTO groups (name, group_type, created_by) VALUES ('Meine Schule', 'school', '${existing}')`)).rejects.toThrow(/Only Flyary admins/);
    await expect(db.exec("UPDATE groups SET group_type = 'school' WHERE name = 'Freunde'")).rejects.toThrow(/Only Flyary admins/);
    await db.exec("UPDATE groups SET name = 'Freunde am Berg' WHERE name = 'Freunde'");
    await as(admin);
    await db.exec(`INSERT INTO groups (name, group_type, created_by) VALUES ('Neue Schule', 'school', '${admin}')`);
  });

  it("grants access when joining a school with its invite link", async () => {
    await as(student);
    expect((await access()).has_access).toBe(false);
    await db.query("SELECT join_group_by_invite_code($1)", [schoolCode]);
    expect((await access()).has_access).toBe(true);
  });

  it("personal invitation: only admins create it, it works once, for one account", async () => {
    await db.exec("RESET ROLE");
    await db.exec(`INSERT INTO pilot_waitlist (name, email, language, role, consent_at) VALUES ('Web Pilotin', 'web@example.ch', 'fr', 'pilot', now())`);
    const entry = await one<string>("SELECT id AS r FROM pilot_waitlist WHERE email = 'web@example.ch'");
    await as(existing);
    await expect(db.query("SELECT create_access_invite($1)", [entry])).rejects.toThrow(/admin required/);
    await as(admin);
    const first = await one<string>("SELECT create_access_invite($1) AS r", [entry]);
    const token = await one<string>("SELECT create_access_invite($1) AS r", [entry]);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT token_hash FROM access_invites")).rows).toHaveLength(1);
    expect((await db.query("SELECT 1 FROM access_invites WHERE token_hash = $1", [token])).rows).toHaveLength(0);
    expect((await db.query<{ invited: boolean }>("SELECT invited_at IS NOT NULL AS invited FROM pilot_waitlist WHERE id = $1", [entry])).rows[0].invited).toBe(true);

    await as(other);
    expect(await one("SELECT redeem_access_invite($1) AS r", [first])).toBe("invalid");
    expect(await one("SELECT redeem_access_invite('nope') AS r")).toBe("invalid");
    expect(await one("SELECT redeem_access_invite($1) AS r", [token])).toBe("ok");
    expect(await one("SELECT redeem_access_invite($1) AS r", [token])).toBe("ok");
    expect((await access()).has_access).toBe(true);
    await as(newbie);
    expect(await one("SELECT redeem_access_invite($1) AS r", [token])).toBe("used");
    expect((await access()).has_access).toBe(false);
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT user_id FROM pilot_waitlist WHERE id = $1", [entry])).rows).toEqual([{ user_id: other }]);
  });

  it("rejects an expired invitation", async () => {
    await db.exec(`RESET ROLE; INSERT INTO pilot_waitlist (name, email, language, role, consent_at) VALUES ('Spät', 'late@example.ch', 'de', 'pilot', now())`);
    await as(admin);
    const token = await one<string>("SELECT create_access_invite((SELECT id FROM pilot_waitlist WHERE email = 'late@example.ch')) AS r");
    await db.exec("RESET ROLE; UPDATE access_invites SET expires_at = now() - interval '1 minute' WHERE redeemed_at IS NULL");
    await as(newbie);
    expect(await one("SELECT redeem_access_invite($1) AS r", [token])).toBe("expired");
  });

  it("lets only admins grant access directly and read the access list", async () => {
    await as(existing);
    await expect(db.query("SELECT grant_app_access($1)", [newbie])).rejects.toThrow(/admin required/);
    expect((await db.query("SELECT user_id FROM app_access")).rows).toEqual([{ user_id: existing }]);
    await as(admin);
    await db.query("SELECT grant_app_access($1)", [newbie]);
    expect((await db.query("SELECT 1 FROM app_access")).rows.length).toBeGreaterThan(3);
    await as(newbie);
    expect((await access()).has_access).toBe(true);
    await db.exec("RESET ROLE");
    expect((await db.query<{ handled: boolean }>(`SELECT handled_at IS NOT NULL AS handled FROM pilot_waitlist WHERE user_id = '${newbie}'`)).rows[0].handled).toBe(true);
  });

  it("opens the door for everyone when the pilot phase ends", async () => {
    await db.exec("RESET ROLE; DELETE FROM app_access WHERE user_id = '" + newbie + "'");
    await as(existing);
    await expect(db.exec("UPDATE app_settings SET value = 'open'")).resolves.toBeDefined();
    expect((await db.query("SELECT value FROM app_settings")).rows).toEqual([{ value: "invite" }]);
    await as(admin);
    await db.exec("UPDATE app_settings SET value = 'open' WHERE key = 'signup_mode'");
    await as(newbie);
    expect((await access()).has_access).toBe(true);
  });
});
