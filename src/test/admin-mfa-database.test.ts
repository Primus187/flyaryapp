// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0088: Flyary admin rights (is_ops_admin) need a session confirmed with the second factor (aal2).
let db: PGlite;
const admin = "00000000-0000-0000-0000-000000000001";
const pilot = "00000000-0000-0000-0000-000000000002";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT COALESCE(nullif(current_setting('app.jwt',true),''), '{}')::jsonb $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE user_roles(user_id uuid, role text);
    INSERT INTO user_roles VALUES ('${admin}', 'admin');
    CREATE FUNCTION has_role(u uuid, r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = u AND role = r) $$;
    -- an operator table as in 0083: readable by Flyary admins only
    CREATE TABLE client_errors(message text);
    INSERT INTO client_errors VALUES ('boom');
    ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON client_errors TO authenticated;
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0088_admin_mfa.sql", import.meta.url), "utf8"));
  await db.exec(`CREATE POLICY "Admins read error reports" ON client_errors FOR SELECT TO authenticated USING (public.is_ops_admin())`);
}, 60_000);
afterAll(async () => { await db?.close(); });

async function as<T>(uid: string, aal: "aal1" | "aal2" | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET app.user_id='${uid}'; SET app.jwt='${aal ? JSON.stringify({ aal }) : ""}'; SET ROLE authenticated`);
  try { return await fn(); } finally { await db.exec("RESET ROLE; RESET app.user_id; RESET app.jwt"); }
}
const scalar = async (sql: string) => (await db.query<{ v: unknown }>(`SELECT ${sql} AS v`)).rows[0].v;

describe("admin rights need the second factor", () => {
  it("grants admin rights only with aal2", async () => {
    expect(await as(admin, "aal2", () => scalar("is_ops_admin()"))).toBe(true);
    expect(await as(admin, "aal1", () => scalar("is_ops_admin()"))).toBe(false);
    expect(await as(admin, null, () => scalar("is_ops_admin()"))).toBe(false);
    expect(await as(pilot, "aal2", () => scalar("is_ops_admin()"))).toBe(false);
  });

  it("still tells the app that the account is an admin", async () => {
    expect(await as(admin, "aal1", () => scalar("is_admin_role()"))).toBe(true);
    expect(await as(pilot, "aal2", () => scalar("is_admin_role()"))).toBe(false);
  });

  it("keeps operator data closed until the code is confirmed", async () => {
    expect(await as(admin, "aal1", () => scalar("(SELECT count(*) FROM client_errors)"))).toBe(0);
    expect(await as(admin, "aal2", () => scalar("(SELECT count(*) FROM client_errors)"))).toBe(1);
  });
});
