// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0071: who may follow whom, and who sees it.
let db: PGlite;
const student = "00000000-0000-0000-0000-000000000001";
const classmate = "00000000-0000-0000-0000-000000000002";
const stranger = "00000000-0000-0000-0000-000000000003";
const pilot = "00000000-0000-0000-0000-000000000004";
const school = "10000000-0000-0000-0000-000000000001";

const as = async <T>(user: string, fn: () => Promise<T>) => {
  await db.exec(`SET app.user_id='${user}'; SET ROLE authenticated;`);
  try { return await fn(); } finally { await db.exec("RESET ROLE;"); }
};
const follow = (from: string, to: string) => as(from, () => db.query("INSERT INTO follows (follower_id, following_id) VALUES ($1,$2)", [from, to]));
const info = (viewer: string, target: string) =>
  as(viewer, async () => (await db.query<{ i: Record<string, unknown> }>("SELECT follow_info($1) AS i", [target])).rows[0].i);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE, pilot_name text);
    CREATE TABLE group_members(group_id uuid, user_id uuid);
    CREATE TABLE follows(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), follower_id uuid, following_id uuid, UNIQUE(follower_id, following_id));
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own ON profiles FOR ALL USING (auth.uid() = user_id);
    ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can follow others" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
    CREATE POLICY "Authenticated can view follows" ON follows FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);
    GRANT SELECT (id, user_id, pilot_name) ON profiles TO authenticated;
    GRANT UPDATE ON profiles TO authenticated;
    GRANT SELECT, INSERT, DELETE ON follows TO authenticated;
    INSERT INTO profiles (user_id, pilot_name) VALUES ('${student}','Schülerin'),('${classmate}','Klassenkamerad'),('${stranger}','Fremder'),('${pilot}','Pilot');
    INSERT INTO group_members VALUES ('${school}','${student}'),('${school}','${classmate}');
  `);
  const sql = readFileSync(new URL("../../drizzle/migrations/0071_follow_permission.sql", import.meta.url), "utf8");
  await db.exec(sql);
  await db.exec(sql); // re-runnable
}, 60_000);
afterAll(async () => { await db?.close(); });

describe("following", () => {
  it("by default only members of a shared group may follow", async () => {
    await follow(classmate, student);
    await expect(follow(stranger, student)).rejects.toThrow(/row-level security/);
    expect(await info(stranger, student)).toMatchObject({ followers: 1, canFollow: false, isFollowing: false });
    expect(await info(classmate, student)).toMatchObject({ followers: 1, isFollowing: true });
  });

  it("anyone may follow a pilot who allows it", async () => {
    await as(pilot, () => db.query("UPDATE profiles SET follow_permission='everyone' WHERE user_id=$1", [pilot]));
    await follow(stranger, pilot);
    expect(await info(student, pilot)).toMatchObject({ followers: 1, canFollow: true });
  });

  it("nobody sees who follows whom unless involved", async () => {
    const seen = (viewer: string) => as(viewer, async () => (await db.query("SELECT follower_id, following_id FROM follows")).rows.length);
    expect(await seen(student)).toBe(1);   // the classmate following her
    expect(await seen(classmate)).toBe(1); // his own follow
    expect(await seen(stranger)).toBe(1);  // his follow of the pilot
    await as(student, async () => { await expect(db.query("SELECT follow_permission FROM profiles WHERE user_id=$1", [student])).resolves.toBeTruthy(); });
  });

  it("switching back to group members removes the other followers", async () => {
    await as(pilot, () => db.query("UPDATE profiles SET follow_permission='groups' WHERE user_id=$1", [pilot]));
    expect((await db.query("SELECT count(*)::int AS n FROM follows WHERE following_id=$1", [pilot])).rows[0]).toEqual({ n: 0 });
    expect((await db.query("SELECT count(*)::int AS n FROM follows WHERE following_id=$1", [student])).rows[0]).toEqual({ n: 1 });
  });

  it("refuses a setting that does not exist and following oneself", async () => {
    await expect(as(pilot, () => db.query("UPDATE profiles SET follow_permission='nobody' WHERE user_id=$1", [pilot]))).rejects.toThrow(/follow_permission/);
    await expect(follow(student, student)).rejects.toThrow(/row-level security/);
  });
});
