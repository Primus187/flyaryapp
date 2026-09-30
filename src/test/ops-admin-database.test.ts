// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0083: one admin check (is_ops_admin) for all operator functions, counters for /admin.
let db: PGlite;
const admin = "00000000-0000-0000-0000-000000000001";
const user = "00000000-0000-0000-0000-000000000002";
const otherAdmin = "00000000-0000-0000-0000-000000000003";
const moderator = "00000000-0000-0000-0000-000000000004";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth, storage TO authenticated;
    CREATE TABLE user_roles(user_id uuid, role text);
    INSERT INTO user_roles VALUES ('${admin}', 'admin'), ('${otherAdmin}', 'admin'), ('${moderator}', 'moderator');
    CREATE FUNCTION has_role(u uuid, r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = u AND role = r) $$;
    CREATE TABLE pushes(user_id uuid, title text, body text, url text);
    CREATE FUNCTION send_push_notification(u uuid, t text, b text, l text) RETURNS void LANGUAGE sql AS $$ INSERT INTO pushes VALUES (u, t, b, l) $$;
    CREATE TABLE pilot_waitlist(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, handled_at timestamptz, invited_at timestamptz);
    CREATE TABLE access_invites(token_hash text, waitlist_id uuid, created_by uuid, redeemed_at timestamptz);
    CREATE FUNCTION access_invite_hash(t text) RETURNS text LANGUAGE sql AS $$ SELECT md5(t) $$;
    CREATE TABLE app_access(user_id uuid PRIMARY KEY, granted_via text, granted_by uuid);
    CREATE TABLE app_settings(key text PRIMARY KEY, value text);
    CREATE TABLE client_errors(id serial, resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE marketplace_bans(user_id uuid PRIMARY KEY, until timestamptz, reason text, created_by uuid, created_at timestamptz);
    CREATE TABLE marketplace_listings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, seller_user_id uuid, seller_group_id uuid, created_by uuid);
    CREATE TABLE marketplace_reports(listing_id uuid, status text);
    CREATE TABLE marketplace_moderation_log(listing_title text, target_user_id uuid, actor_id uuid, action text, reason text);
    CREATE FUNCTION market_can_moderate(u uuid, l marketplace_listings) RETURNS boolean LANGUAGE sql AS $$ SELECT has_role(u, 'admin') $$;
    CREATE FUNCTION market_can_manage(u uuid, s uuid, g uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u = s $$;
    CREATE TABLE ops_backup_runs(id serial, finished_at timestamptz NOT NULL DEFAULT now(), ok boolean NOT NULL);
    CREATE TABLE ops_backup_alerts(kind text);
    CREATE TABLE official_sites(id uuid PRIMARY KEY, name_override text, updated_at timestamptz);
    CREATE TABLE storage.objects(bucket_id text, metadata jsonb);
    DO $$ DECLARE t text; BEGIN
      FOREACH t IN ARRAY ARRAY['pilot_waitlist','access_invites','app_access','app_settings','client_errors','marketplace_bans','marketplace_listings','ops_backup_runs'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY; GRANT SELECT, UPDATE, DELETE ON %I TO authenticated', t, t);
      END LOOP;
    END $$;
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0083_ops_admin.sql", import.meta.url), "utf8"));
  await db.exec(`
    INSERT INTO pilot_waitlist (handled_at) VALUES (NULL), (NULL), (now());
    INSERT INTO client_errors (resolved_at, created_at) VALUES (NULL, now()), (NULL, now() - interval '3 days'), (now(), now());
    INSERT INTO marketplace_listings (id, title) VALUES ('10000000-0000-0000-0000-000000000001', 'Schirm'), ('10000000-0000-0000-0000-000000000002', 'Gurtzeug');
    INSERT INTO marketplace_reports VALUES ('10000000-0000-0000-0000-000000000001', 'open'), ('10000000-0000-0000-0000-000000000001', 'open'),
      ('10000000-0000-0000-0000-000000000002', 'dismissed');
    INSERT INTO ops_backup_runs (finished_at, ok) VALUES (now() - interval '2 days', true), (now() - interval '1 day', false);
    INSERT INTO storage.objects VALUES ('avatars', '{"size": 1000}'), ('flight-photos', '{"size": 2500}');
  `);
}, 60_000);
afterAll(async () => { await db?.close(); });

async function as<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET app.user_id='${uid ?? ""}'; SET ROLE authenticated`);
  try { return await fn(); } finally { await db.exec("RESET ROLE; RESET app.user_id"); }
}
const scalar = async (sql: string) => (await db.query<{ v: unknown }>(`SELECT ${sql} AS v`)).rows[0].v;

describe("is_ops_admin", () => {
  it("is true only for a signed-in Flyary admin", async () => {
    expect(await as(admin, () => scalar("is_ops_admin()"))).toBe(true);
    expect(await as(user, () => scalar("is_ops_admin()"))).toBe(false);
    expect(await as(moderator, () => scalar("is_ops_admin()"))).toBe(false);
    expect(await as(null, () => scalar("is_ops_admin()"))).toBe(false);
  });

  it("keeps marketplace staff for the own and for other accounts", async () => {
    expect(await as(admin, () => scalar(`is_market_staff('${admin}')`))).toBe(true);
    expect(await as(user, () => scalar(`is_market_staff('${otherAdmin}')`))).toBe(true);
    expect(await as(user, () => scalar(`is_market_staff('${moderator}')`))).toBe(true);
    expect(await as(user, () => scalar(`is_market_staff('${user}')`))).toBe(false);
  });
});

describe("admin policies and functions", () => {
  it("let admins read the test list and error log, nobody else", async () => {
    expect(await as(admin, () => scalar("(SELECT count(*) FROM pilot_waitlist)"))).toBe(3);
    expect(await as(admin, () => scalar("(SELECT count(*) FROM client_errors)"))).toBe(3);
    expect(await as(user, () => scalar("(SELECT count(*) FROM pilot_waitlist)"))).toBe(0);
    expect(await as(user, () => scalar("(SELECT count(*) FROM client_errors)"))).toBe(0);
  });

  it("refuses admin functions to other accounts", async () => {
    await expect(as(user, () => db.query(`SELECT grant_app_access('${user}')`))).rejects.toThrow(/Flyary admin required/);
    await expect(as(user, () => db.query("SELECT marketplace_storage_usage()"))).rejects.toThrow(/not_allowed/);
    await as(admin, () => db.query(`SELECT grant_app_access('${user}')`));
    expect(await scalar(`(SELECT granted_via FROM app_access WHERE user_id = '${user}')`)).toBe("admin");
  });

  it("sends backup pushes to the backup page", async () => {
    await db.query("SELECT notify_admins_backup('missing', 'Seit 2 Tagen keine Sicherung')");
    const urls = (await db.query<{ url: string }>("SELECT DISTINCT url FROM pushes")).rows.map((r) => r.url);
    expect(urls).toEqual(["/admin/backups"]);
  });
});

describe("ops_overview", () => {
  it("counts the open items for the admin", async () => {
    const o = await as(admin, () => scalar("ops_overview()")) as Record<string, unknown>;
    expect(o).toMatchObject({
      waitlist_open: 2, errors_open: 2, errors_new_24h: 1, market_reports_open: 1,
      backup_last_ok: false, storage_bytes: 3500,
    });
    expect(new Date(o.backup_last_success_at as string).getTime()).toBeLessThan(new Date(o.backup_last_at as string).getTime());
  });

  it("is not available to other accounts", async () => {
    await expect(as(user, () => db.query("SELECT ops_overview()"))).rejects.toThrow(/Flyary admin required/);
  });
});
