// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0082: backup runs report themselves; admins get a push on errors or when backups stop.
let db: PGlite;
const admin = "00000000-0000-0000-0000-000000000001";
const user = "00000000-0000-0000-0000-000000000002";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE user_roles(user_id uuid, role text);
    INSERT INTO user_roles VALUES ('${admin}', 'admin');
    CREATE FUNCTION has_role(u uuid, r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = u AND role = r) $$;
    CREATE TABLE pushes(user_id uuid, title text, body text, url text);
    CREATE FUNCTION send_push_notification(u uuid, t text, b text, l text) RETURNS void LANGUAGE sql AS $$ INSERT INTO pushes VALUES (u, t, b, l) $$;
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0082_backup_monitoring.sql", import.meta.url), "utf8"));
}, 60_000);
afterAll(async () => { await db?.close(); });

const report = (ok: boolean, message: string | null = null) =>
  db.query("SELECT report_backup_run($1, '2026-09-30_1230', 'PC', 'abc', 180, 5000, 40, 3, $2, $3)", [ok, ok ? 0 : 2, message]);
const pushes = async () => (await db.query<{ title: string }>("SELECT title FROM pushes ORDER BY title")).rows.map((r) => r.title);

describe("backup monitoring", () => {
  it("warns once a day when no successful backup arrived", async () => {
    await db.exec("SELECT check_backup_freshness(); SELECT check_backup_freshness();");
    expect(await pushes()).toEqual(["Sicherung fehlt"]);
  });

  it("records a good run silently and stops the warnings", async () => {
    await db.exec("DELETE FROM pushes; DELETE FROM ops_backup_alerts;");
    await report(true);
    await db.exec("SELECT check_backup_freshness()");
    expect(await pushes()).toEqual([]);
  });

  it("pushes right away when a run reports errors", async () => {
    await report(false, "2 Dateien fehlgeschlagen");
    expect(await pushes()).toEqual(["Sicherung mit Fehlern"]);
  });

  it("warns again after 48 hours without a successful run", async () => {
    await db.exec("DELETE FROM pushes; DELETE FROM ops_backup_alerts; UPDATE ops_backup_runs SET finished_at = now() - interval '49 hours';");
    await db.exec("SELECT check_backup_freshness()");
    expect(await pushes()).toEqual(["Sicherung fehlt"]);
  });

  it("is readable by admins only and not callable from the app", async () => {
    await db.exec(`SET app.user_id='${user}'; SET ROLE authenticated`);
    expect((await db.query("SELECT 1 FROM ops_backup_runs")).rows).toHaveLength(0);
    await expect(report(true)).rejects.toThrow(/permission denied/);
    await db.exec(`RESET ROLE; SET app.user_id='${admin}'; SET ROLE authenticated`);
    expect((await db.query("SELECT 1 FROM ops_backup_runs")).rows).toHaveLength(2);
    await db.exec("RESET ROLE");
  });
});
