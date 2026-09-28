// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0070: only admins and the school team read or renew a group's invite code.
let db: PGlite;
const admin = "00000000-0000-0000-0000-000000000001";
const student = "00000000-0000-0000-0000-000000000003";
const group = "10000000-0000-0000-0000-000000000001";
const code = "90000000-0000-0000-0000-000000000001";

const as = async <T>(user: string, fn: () => Promise<T>) => {
  await db.exec(`SET app.user_id='${user}'; SET ROLE authenticated;`);
  try { return await fn(); } finally { await db.exec("RESET ROLE;"); }
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, invite_code uuid DEFAULT gen_random_uuid(),
      created_by uuid, created_at timestamptz DEFAULT now(), group_type text DEFAULT 'pilot_group');
    CREATE TABLE group_members(group_id uuid, user_id uuid, role text);
    ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
    CREATE POLICY members_view ON groups FOR SELECT USING (EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = id AND m.user_id = auth.uid()));
    CREATE POLICY creators_insert ON groups FOR INSERT WITH CHECK (auth.uid() = created_by);
    CREATE POLICY creators_view ON groups FOR SELECT USING (created_by = auth.uid());
    GRANT SELECT, INSERT, UPDATE, DELETE ON groups TO authenticated, anon;
    GRANT SELECT ON group_members TO authenticated;
    CREATE FUNCTION is_group_admin(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM group_members WHERE user_id=u AND group_id=g AND role='admin') $$;
    CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    INSERT INTO groups (id, name, invite_code, created_by, group_type) VALUES ('${group}', 'Vertical', '${code}', '${admin}', 'school');
    INSERT INTO group_members VALUES ('${group}','${admin}','admin'),('${group}','${student}','member');
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0070_invite_code_protection.sql", import.meta.url), "utf8"));
}, 60_000);
afterAll(async () => { await db?.close(); });

describe("invite codes", () => {
  it("members still read the group, but not its code", async () => {
    await as(student, async () => {
      expect((await db.query("SELECT id, name, description, created_by, created_at, group_type FROM groups")).rows).toHaveLength(1);
      await expect(db.query("SELECT invite_code FROM groups")).rejects.toThrow(/permission denied/);
      await expect(db.query("SELECT * FROM groups")).rejects.toThrow(/permission denied/);
      await expect(db.query("SELECT group_invite_code($1)", [group])).rejects.toThrow("Group admin required");
      await expect(db.query("SELECT regenerate_group_invite_code($1)", [group])).rejects.toThrow("Group admin required");
    });
  });

  it("the admin reads the code and a renewed one replaces it", async () => {
    const before = await as(admin, async () => (await db.query<{ c: string }>("SELECT group_invite_code($1) AS c", [group])).rows[0].c);
    expect(before).toBe(code);
    const renewed = await as(admin, async () => (await db.query<{ c: string }>("SELECT regenerate_group_invite_code($1) AS c", [group])).rows[0].c);
    expect(renewed).not.toBe(code);
    expect((await db.query<{ invite_code: string }>("SELECT invite_code FROM groups")).rows[0].invite_code).toBe(renewed);
  });

  it("a new group can still be created and read back by id", async () => {
    await as(student, async () => {
      const { rows } = await db.query<{ id: string }>("INSERT INTO groups (name, created_by) VALUES ('Meine Gruppe', $1) RETURNING id", [student]);
      expect(rows[0].id).toBeTruthy();
    });
  });
});
