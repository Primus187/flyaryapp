// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0084: pause and restore app access, withdraw invitations, operator log.
let db: PGlite;
const admin = "00000000-0000-0000-0000-000000000001";
const pilot = "00000000-0000-0000-0000-000000000002";
const newbie = "00000000-0000-0000-0000-000000000003";
const otherAdmin = "00000000-0000-0000-0000-000000000004";
const school = "10000000-0000-0000-0000-000000000001";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}', created_at timestamptz DEFAULT now(), last_sign_in_at timestamptz);
    INSERT INTO auth.users (id, email, created_at) VALUES
      ('${admin}', 'admin@example.ch', now() - interval '3 days'), ('${pilot}', 'pilot@example.ch', now() - interval '2 days'),
      ('${newbie}', 'newbie@example.ch', now() - interval '1 day'), ('${otherAdmin}', 'second@example.ch', now() - interval '4 days');
    CREATE TABLE profiles(user_id uuid, pilot_name text);
    INSERT INTO profiles VALUES ('${admin}', 'Tobias'), ('${pilot}', 'Petra Pilotin');
    CREATE TABLE user_roles(user_id uuid, role text);
    INSERT INTO user_roles VALUES ('${admin}', 'admin'), ('${otherAdmin}', 'admin');
    CREATE FUNCTION has_role(u uuid, r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = u AND role = r) $$;
    CREATE FUNCTION is_ops_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin') $$;
    CREATE TABLE groups(id uuid PRIMARY KEY, name text, group_type text);
    INSERT INTO groups VALUES ('${school}', 'Vertical', 'school'), ('10000000-0000-0000-0000-000000000002', 'Stammtisch', 'pilot_group');
    CREATE TABLE group_members(group_id uuid, user_id uuid);
    INSERT INTO group_members VALUES ('${school}', '${pilot}'), ('10000000-0000-0000-0000-000000000002', '${pilot}');
    CREATE TABLE app_settings(key text PRIMARY KEY, value text);
    INSERT INTO app_settings VALUES ('signup_mode', 'invite');
    CREATE TABLE app_access(user_id uuid PRIMARY KEY, granted_via text NOT NULL, granted_by uuid, granted_at timestamptz NOT NULL DEFAULT now());
    INSERT INTO app_access (user_id, granted_via) VALUES ('${admin}', 'existing'), ('${pilot}', 'group'), ('${otherAdmin}', 'existing');
    CREATE TABLE pilot_waitlist(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, email text, user_id uuid, handled_at timestamptz, invited_at timestamptz);
    CREATE TABLE access_invites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text UNIQUE, waitlist_id uuid, created_by uuid,
      created_at timestamptz DEFAULT now(), expires_at timestamptz DEFAULT now() + interval '14 days', redeemed_at timestamptz, redeemed_by uuid);
    CREATE FUNCTION access_invite_hash(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT md5(t) $$;
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0084_access_revoke.sql", import.meta.url), "utf8"));
}, 60_000);
afterAll(async () => { await db?.close(); });

async function as<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET app.user_id='${uid ?? ""}'; SET ROLE authenticated`);
  try { return await fn(); } finally { await db.exec("RESET ROLE; RESET app.user_id"); }
}
const scalar = async (sql: string, params: unknown[] = []) => (await db.query<{ v: unknown }>(`SELECT ${sql} AS v`, params)).rows[0].v;
const logActions = async () => (await db.query<{ action: string }>("SELECT action FROM ops_admin_log ORDER BY created_at, action")).rows.map((r) => r.action);

describe("pausing access", () => {
  it("needs a reason and spares admins", async () => {
    await expect(as(admin, () => db.query(`SELECT revoke_app_access('${pilot}', '  ')`))).rejects.toThrow(/reason/);
    await expect(as(admin, () => db.query(`SELECT revoke_app_access('${otherAdmin}', 'Test')`))).rejects.toThrow(/cannot be paused/);
    await expect(as(admin, () => db.query(`SELECT revoke_app_access('${admin}', 'Test')`))).rejects.toThrow(/cannot be paused/);
    await expect(as(pilot, () => db.query(`SELECT revoke_app_access('${pilot}', 'Test')`))).rejects.toThrow(/Flyary admin required/);
  });

  it("takes access away, keeps memberships and survives a new group join", async () => {
    await as(admin, () => db.query(`SELECT revoke_app_access('${pilot}', 'Testphase beendet')`));
    expect(await scalar(`has_app_access('${pilot}')`)).toBe(false);
    expect(await scalar(`(SELECT count(*) FROM group_members WHERE user_id = '${pilot}')`)).toBe(2);
    await db.exec(`INSERT INTO app_access (user_id, granted_via) VALUES ('${pilot}', 'group') ON CONFLICT (user_id) DO NOTHING`);
    expect(await scalar(`has_app_access('${pilot}')`)).toBe(false);
    expect(await as(pilot, () => scalar("my_access()"))).toMatchObject({ has_access: false, revoked: true });
  });

  it("stays paused when the pilot phase opens", async () => {
    await db.exec("UPDATE app_settings SET value = 'open'");
    expect(await scalar(`has_app_access('${pilot}')`)).toBe(false);
    expect(await scalar(`has_app_access('${newbie}')`)).toBe(true);
    await db.exec("UPDATE app_settings SET value = 'invite'");
  });

  it("does not let a paused account use up a personal link", async () => {
    await db.exec(`INSERT INTO pilot_waitlist (id, name, email) VALUES ('20000000-0000-0000-0000-000000000001', 'Petra', 'petra@example.ch');
      INSERT INTO access_invites (token_hash, waitlist_id, created_by) VALUES (md5('tok'), '20000000-0000-0000-0000-000000000001', '${admin}')`);
    expect(await as(pilot, () => scalar("redeem_access_invite('tok')"))).toBe("revoked");
    expect(await scalar("(SELECT redeemed_at FROM access_invites WHERE token_hash = md5('tok'))")).toBeNull();
  });

  it("restores access and logs both steps", async () => {
    await as(admin, () => db.query(`SELECT restore_app_access('${pilot}')`));
    expect(await scalar(`has_app_access('${pilot}')`)).toBe(true);
    await expect(as(admin, () => db.query(`SELECT restore_app_access('${pilot}')`))).rejects.toThrow(/not paused/);
    expect(await logActions()).toEqual(["access_revoked", "access_restored"]);
  });
});

describe("invitations and grants", () => {
  it("withdraws an open invitation", async () => {
    await db.exec("DELETE FROM ops_admin_log");
    const token = await as(admin, () => scalar("create_access_invite('20000000-0000-0000-0000-000000000001')"));
    expect(typeof token).toBe("string");
    await as(admin, () => db.query("SELECT revoke_access_invite('20000000-0000-0000-0000-000000000001')"));
    expect(await scalar("(SELECT count(*) FROM access_invites WHERE redeemed_at IS NULL)")).toBe(0);
    expect(await scalar("(SELECT invited_at FROM pilot_waitlist WHERE id = '20000000-0000-0000-0000-000000000001')")).toBeNull();
    await expect(as(admin, () => db.query("SELECT revoke_access_invite('20000000-0000-0000-0000-000000000001')"))).rejects.toThrow(/No open invitation/);
    expect(await logActions()).toEqual(["invite_created", "invite_revoked"]);
  });

  it("logs a grant only when it gives access", async () => {
    await db.exec("DELETE FROM ops_admin_log");
    await as(admin, () => db.query(`SELECT grant_app_access('${newbie}')`));
    await as(admin, () => db.query(`SELECT grant_app_access('${newbie}')`));
    expect(await logActions()).toEqual(["access_granted"]);
  });
});

describe("lists for the admin", () => {
  it("lists all accounts with access, schools and e-mail", async () => {
    const rows = await as(admin, () => scalar("ops_access_list()")) as Record<string, unknown>[];
    expect(rows.map((r) => r.email)).toEqual(["newbie@example.ch", "pilot@example.ch", "admin@example.ch", "second@example.ch"]);
    expect(rows[1]).toMatchObject({ name: "Petra Pilotin", granted_via: "group", revoked_at: null, schools: ["Vertical"], is_admin: false });
    expect(rows[2]).toMatchObject({ is_admin: true });
  });

  it("shows the log with names", async () => {
    const entries = await as(admin, () => scalar("ops_log_entries(10)")) as Record<string, unknown>[];
    expect(entries[0]).toMatchObject({ action: "access_granted", actor_name: "Tobias", target_name: "newbie@example.ch" });
  });

  it("keeps lists and log away from other accounts", async () => {
    await expect(as(pilot, () => db.query("SELECT ops_access_list()"))).rejects.toThrow(/Flyary admin required/);
    await expect(as(pilot, () => db.query("SELECT ops_log_entries(10)"))).rejects.toThrow(/Flyary admin required/);
    expect(await as(pilot, () => scalar("(SELECT count(*) FROM ops_admin_log)"))).toBe(0);
    await expect(as(pilot, () => db.query("SELECT ops_log('access_granted', NULL, NULL, '{}')"))).rejects.toThrow(/permission denied/);
  });
});
