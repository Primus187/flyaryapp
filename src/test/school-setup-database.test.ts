// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0085: Flyary admins set up schools without becoming members; the lead redeems a single-use link.
let db: PGlite;
const admin = "00000000-0000-0000-0000-000000000001";
const lead = "00000000-0000-0000-0000-000000000002";
const other = "00000000-0000-0000-0000-000000000003";
const paused = "00000000-0000-0000-0000-000000000004";
const oldSchool = "10000000-0000-0000-0000-000000000001";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    INSERT INTO auth.users VALUES ('${admin}', 'admin@example.ch'), ('${lead}', 'lead@example.ch'), ('${other}', 'other@example.ch'), ('${paused}', 'paused@example.ch');
    CREATE TABLE profiles(user_id uuid, pilot_name text);
    INSERT INTO profiles VALUES ('${admin}', 'Tobias'), ('${lead}', 'Laura Leitung');
    CREATE TABLE user_roles(user_id uuid, role text);
    INSERT INTO user_roles VALUES ('${admin}', 'admin');
    CREATE FUNCTION has_role(u uuid, r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = u AND role = r) $$;
    CREATE FUNCTION is_ops_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin') $$;
    CREATE FUNCTION access_invite_hash(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT md5(t) $$;
    CREATE TABLE groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, created_by uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), group_type text NOT NULL DEFAULT 'pilot_group');
    CREATE TABLE group_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id uuid NOT NULL, role text NOT NULL DEFAULT 'member', joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE (group_id, user_id));
    CREATE TABLE group_member_functions(group_id uuid, user_id uuid, function text);
    CREATE FUNCTION is_group_team_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS (SELECT 1 FROM group_members WHERE user_id = u AND group_id = g AND role = 'admin')
        OR EXISTS (SELECT 1 FROM group_member_functions WHERE user_id = u AND group_id = g) $$;
    CREATE TABLE flights(id serial, group_id uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE app_access(user_id uuid PRIMARY KEY, granted_via text NOT NULL, granted_by uuid, granted_at timestamptz DEFAULT now(),
      revoked_at timestamptz, revoked_by uuid, revoke_reason text);
    INSERT INTO app_access (user_id, granted_via, revoked_at) VALUES ('${admin}', 'existing', NULL), ('${paused}', 'group', now());
    CREATE TABLE ops_admin_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), actor uuid,
      action text NOT NULL CONSTRAINT ops_admin_log_action_check CHECK (action IN ('access_granted')), target_user uuid, target_group uuid, detail jsonb NOT NULL DEFAULT '{}');
    CREATE FUNCTION ops_log(a text, u uuid, g uuid, d jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
      INSERT INTO ops_admin_log (actor, action, target_user, target_group, detail) VALUES (auth.uid(), a, u, g, COALESCE(d, '{}')) $$;
    REVOKE ALL ON FUNCTION ops_log(text, uuid, uuid, jsonb) FROM PUBLIC;
    INSERT INTO groups (id, name, created_by, group_type) VALUES ('${oldSchool}', 'Vertical', '${admin}', 'school');
    INSERT INTO group_members (group_id, user_id, role) VALUES ('${oldSchool}', '${admin}', 'admin'), ('${oldSchool}', '${other}', 'member');
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0085_school_setup.sql", import.meta.url), "utf8"));
}, 60_000);
afterAll(async () => { await db?.close(); });

async function as<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET app.user_id='${uid ?? ""}'; SET ROLE authenticated`);
  try { return await fn(); } finally { await db.exec("RESET ROLE; RESET app.user_id"); }
}
const scalar = async (sql: string, params: unknown[] = []) => (await db.query<{ v: unknown }>(`SELECT ${sql} AS v`, params)).rows[0].v;
const create = (name: string, email: string) => as(admin, () => scalar("ops_create_school($1, NULL, $2, 'de')", [name, email])) as Promise<{ group_id: string; token: string }>;

let created: { group_id: string; token: string };

describe("setting up a school", () => {
  it("creates the school without the admin as member", async () => {
    created = await create("Flugschule Neu", "Lead@Example.ch");
    expect(created.token).toMatch(/^[0-9a-f]{64}$/);
    expect(await scalar("(SELECT group_type FROM groups WHERE id = $1)", [created.group_id])).toBe("school");
    expect(await scalar("(SELECT count(*) FROM group_members WHERE group_id = $1)", [created.group_id])).toBe(0);
    expect(await scalar("(SELECT email FROM school_lead_invites WHERE group_id = $1)", [created.group_id])).toBe("lead@example.ch");
  });

  it("is for Flyary admins only and checks its input", async () => {
    await expect(as(lead, () => db.query("SELECT ops_create_school('X-Schule', NULL, 'a@b.ch', 'de')"))).rejects.toThrow(/Flyary admin required/);
    await expect(create("X", "a@b.ch")).rejects.toThrow(/Invalid school name/);
    await expect(create("Gute Schule", "keine-mail")).rejects.toThrow(/Invalid e-mail/);
    await expect(as(lead, () => db.query("SELECT ops_new_lead_invite($1, 'a@b.ch', 'de')", [created.group_id]))).rejects.toThrow(/permission denied/);
  });
});

describe("redeeming the lead link", () => {
  it("refuses unknown links and paused accounts without using up the link", async () => {
    expect(await as(lead, () => scalar("redeem_school_lead_invite('nope')"))).toBe("invalid");
    expect(await as(paused, () => scalar("redeem_school_lead_invite($1)", [created.token]))).toBe("revoked");
    expect(await scalar("(SELECT redeemed_at FROM school_lead_invites WHERE group_id = $1)", [created.group_id])).toBeNull();
  });

  it("makes the lead group admin with app access, once", async () => {
    expect(await as(lead, () => scalar("redeem_school_lead_invite($1)", [created.token]))).toBe("ok");
    expect(await scalar("(SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2)", [created.group_id, lead])).toBe("admin");
    expect(await scalar("(SELECT granted_via FROM app_access WHERE user_id = $1)", [lead])).toBe("group");
    expect(await as(lead, () => scalar("redeem_school_lead_invite($1)", [created.token]))).toBe("ok");
    expect(await as(other, () => scalar("redeem_school_lead_invite($1)", [created.token]))).toBe("used");
  });

  it("promotes an existing member and rejects expired links", async () => {
    const token = await as(admin, () => scalar("ops_create_lead_invite($1, 'other@example.ch', 'fr')", [oldSchool])) as string;
    expect(await as(other, () => scalar("redeem_school_lead_invite($1)", [token]))).toBe("ok");
    expect(await scalar("(SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2)", [oldSchool, other])).toBe("admin");
    const late = await as(admin, () => scalar("ops_create_lead_invite($1, 'x@example.ch', 'de')", [created.group_id])) as string;
    await db.exec("UPDATE school_lead_invites SET expires_at = now() - interval '1 minute' WHERE redeemed_at IS NULL");
    expect(await as(other, () => scalar("redeem_school_lead_invite($1)", [late]))).toBe("expired");
  });

  it("keeps one open invitation per school and can withdraw it", async () => {
    await as(admin, () => db.query("SELECT ops_create_lead_invite($1, 'a@example.ch', 'de')", [created.group_id]));
    await as(admin, () => db.query("SELECT ops_create_lead_invite($1, 'b@example.ch', 'en')", [created.group_id]));
    expect(await scalar("(SELECT count(*) FROM school_lead_invites WHERE group_id = $1 AND redeemed_at IS NULL)", [created.group_id])).toBe(1);
    await as(admin, () => db.query("SELECT ops_revoke_lead_invite($1)", [created.group_id]));
    await expect(as(admin, () => db.query("SELECT ops_revoke_lead_invite($1)", [created.group_id]))).rejects.toThrow(/No open invitation/);
    await expect(as(admin, () => db.query("SELECT ops_create_lead_invite(gen_random_uuid(), 'a@example.ch', 'de')"))).rejects.toThrow(/Unknown school/);
  });
});

describe("schools list and leaving", () => {
  it("lists schools with leads, membership and open invitations", async () => {
    await as(admin, () => db.query("SELECT ops_create_lead_invite($1, 'c@example.ch', 'de')", [created.group_id]));
    const rows = await as(admin, () => scalar("ops_school_list()")) as Record<string, unknown>[];
    expect(rows.map((r) => r.name)).toEqual(["Flugschule Neu", "Vertical"]);
    expect(rows[0]).toMatchObject({ members: 1, team: 1, admins: ["Laura Leitung"], i_am_member: false, open_invite: { email: "c@example.ch" } });
    expect(rows[1]).toMatchObject({ members: 2, i_am_member: true, other_admins: 1, open_invite: null });
    await expect(as(lead, () => db.query("SELECT ops_school_list()"))).rejects.toThrow(/Flyary admin required/);
  });

  it("lets the admin leave only when another group admin remains", async () => {
    await db.exec(`UPDATE group_members SET role = 'member' WHERE group_id = '${oldSchool}' AND user_id = '${other}'`);
    await expect(as(admin, () => db.query("SELECT ops_leave_school($1)", [oldSchool]))).rejects.toThrow(/another group admin/);
    await db.exec(`UPDATE group_members SET role = 'admin' WHERE group_id = '${oldSchool}' AND user_id = '${other}'`);
    await as(admin, () => db.query("SELECT ops_leave_school($1)", [oldSchool]));
    expect(await scalar("(SELECT count(*) FROM group_members WHERE group_id = $1 AND user_id = $2)", [oldSchool, admin])).toBe(0);
  });

  it("logs every step", async () => {
    const actions = (await db.query<{ action: string }>("SELECT DISTINCT action FROM ops_admin_log ORDER BY action")).rows.map((r) => r.action);
    expect(actions).toEqual(["lead_invite_created", "lead_invite_redeemed", "lead_invite_revoked", "school_created", "school_left"]);
  });
});
