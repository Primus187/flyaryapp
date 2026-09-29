// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0078: pilot sign-ups from the website, readable by Flyary admins only.
let db: PGlite;
const admin = "00000000-0000-0000-0000-000000000001";
const user = "00000000-0000-0000-0000-000000000002";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
    CREATE TABLE user_roles(user_id uuid, role text);
    INSERT INTO user_roles VALUES ('${admin}', 'admin');
    CREATE FUNCTION has_role(u uuid, r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = u AND role = r) $$;
    CREATE TABLE pushes(user_id uuid, title text, body text, url text);
    CREATE FUNCTION send_push_notification(u uuid, t text, b text, l text) RETURNS void LANGUAGE sql AS $$ INSERT INTO pushes VALUES (u, t, b, l) $$;
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0078_pilot_waitlist.sql", import.meta.url), "utf8"));
}, 60_000);
afterAll(async () => { await db?.close(); });

async function as(role: "service_role" | "authenticated" | "anon", uid?: string) {
  await db.exec(`RESET ROLE; ${uid ? `SET app.user_id='${uid}';` : "RESET app.user_id;"} SET ROLE ${role};`);
}
const join = async (email: string, extra: Partial<{ name: string; role: string; lang: string; disciplines: string[]; hash: string }> = {}) =>
  (await db.query<{ r: string }>("SELECT join_pilot_waitlist($1, $2, $3, $4, $5, $6, $7, $8) AS r",
    [extra.name ?? "Petra Pilotin", email, extra.lang ?? "de", extra.role ?? "pilot", extra.disciplines ?? ["paraglider"], "Flugschule Beispiel", "Ich fliege seit 2022.", extra.hash ?? "h1"])).rows[0].r;

describe("pilot waitlist", () => {
  it("stores a valid sign-up and notifies the admins", async () => {
    await as("service_role");
    expect(await join("Petra@Example.ch ")).toBe("ok");
    await db.exec("RESET ROLE");
    const row = (await db.query<{ email: string; consent_at: string | null }>("SELECT email, consent_at FROM pilot_waitlist")).rows[0];
    expect(row.email).toBe("petra@example.ch");
    expect(row.consent_at).not.toBeNull();
    expect((await db.query("SELECT user_id FROM pushes")).rows).toEqual([{ user_id: admin }]);
  });

  it("updates a repeated sign-up instead of duplicating it, without a second push", async () => {
    await as("service_role");
    expect(await join("petra@example.ch", { role: "tandem_pilot" })).toBe("ok");
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT role FROM pilot_waitlist")).rows).toEqual([{ role: "tandem_pilot" }]);
    expect((await db.query("SELECT 1 FROM pushes")).rows).toHaveLength(1);
  });

  it("rejects invalid input", async () => {
    await as("service_role");
    expect(await join("no-mail")).toBe("invalid");
    expect(await join("a@b.ch", { name: "X" })).toBe("invalid");
    expect(await join("a@b.ch", { role: "hacker" })).toBe("invalid");
    expect(await join("a@b.ch", { lang: "it" })).toBe("invalid");
    expect(await join("a@b.ch", { disciplines: ["rocket"] })).toBe("invalid");
  });

  it("limits sign-ups per requester and hour", async () => {
    await as("service_role");
    for (let i = 0; i < 4; i++) expect(await join(`p${i}@example.ch`, { hash: "spam" })).toBe("ok");
    expect(await join("p5@example.ch", { hash: "spam" })).toBe("ok");
    expect(await join("p6@example.ch", { hash: "spam" })).toBe("rate_limited");
  });

  it("is callable only with the service role and readable only by admins", async () => {
    await as("anon");
    await expect(join("x@example.ch")).rejects.toThrow(/permission denied/);
    await as("authenticated", user);
    await expect(join("x@example.ch")).rejects.toThrow(/permission denied/);
    expect((await db.query("SELECT 1 FROM pilot_waitlist")).rows).toHaveLength(0);
    await as("authenticated", admin);
    expect((await db.query("SELECT 1 FROM pilot_waitlist")).rows.length).toBeGreaterThan(0);
    await db.exec("UPDATE pilot_waitlist SET handled_at = now() WHERE email = 'petra@example.ch'");
    await expect(db.exec("UPDATE pilot_waitlist SET email = 'x@y.ch'")).rejects.toThrow(/permission denied/);
  });
});
