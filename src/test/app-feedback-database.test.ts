// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0086: feedback with up to three screenshots in a private bucket, admin list and cleanup.
let db: PGlite;
const admin = "00000000-0000-0000-0000-000000000001";
const tester = "00000000-0000-0000-0000-000000000002";
const other = "00000000-0000-0000-0000-000000000003";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth, storage TO authenticated;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    INSERT INTO auth.users VALUES ('${admin}', 'admin@example.ch'), ('${tester}', 'petra@example.ch'), ('${other}', 'other@example.ch');
    CREATE TABLE profiles(user_id uuid, pilot_name text);
    INSERT INTO profiles VALUES ('${tester}', 'Petra Pilotin');
    CREATE TABLE user_roles(user_id uuid, role text);
    INSERT INTO user_roles VALUES ('${admin}', 'admin');
    CREATE FUNCTION has_role(u uuid, r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = u AND role = r) $$;
    CREATE FUNCTION is_ops_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin') $$;
    GRANT EXECUTE ON FUNCTION is_ops_admin() TO authenticated;
    CREATE TABLE pushes(user_id uuid, title text, body text, url text);
    CREATE FUNCTION send_push_notification(u uuid, t text, b text, l text) RETURNS void LANGUAGE sql AS $$ INSERT INTO pushes VALUES (u, t, b, l) $$;
    CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, created_at timestamptz NOT NULL DEFAULT now(), metadata jsonb DEFAULT '{}');
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT ON storage.objects TO authenticated;
    CREATE TABLE ops_backup_runs(id serial, finished_at timestamptz NOT NULL DEFAULT now(), ok boolean NOT NULL);
    CREATE TABLE pilot_waitlist(handled_at timestamptz);
    CREATE TABLE client_errors(resolved_at timestamptz, created_at timestamptz DEFAULT now());
    CREATE TABLE marketplace_listings(id uuid PRIMARY KEY);
    CREATE TABLE marketplace_reports(listing_id uuid, status text);
    CREATE FUNCTION market_can_moderate(u uuid, l marketplace_listings) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0086_app_feedback.sql", import.meta.url), "utf8"));
}, 60_000);
afterAll(async () => { await db?.close(); });

async function as<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET app.user_id='${uid ?? ""}'; SET ROLE authenticated`);
  try { return await fn(); } finally { await db.exec("RESET ROLE; RESET app.user_id"); }
}
const scalar = async (sql: string, params: unknown[] = []) => (await db.query<{ v: unknown }>(`SELECT ${sql} AS v`, params)).rows[0].v;
const submit = (uid: string, message = "Karte lädt nicht") =>
  as(uid, () => scalar("submit_feedback('problem', $1, '/map', '2026-09-30', 'Pixel')", [message])) as Promise<string>;
const upload = (uid: string, name: string) =>
  as(uid, () => db.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('feedback-screenshots', $1)", [name]));

let feedback: string;

describe("submitting feedback", () => {
  it("creates a private bucket with a 1 MB limit", async () => {
    expect((await db.query("SELECT public, file_size_limit FROM storage.buckets WHERE id = 'feedback-screenshots'")).rows[0])
      .toEqual({ public: false, file_size_limit: 1048576 });
  });

  it("uploads up to three screenshots into the own folder of an open submission", async () => {
    feedback = await submit(tester);
    for (const n of [0, 1, 2]) await upload(tester, `${tester}/${feedback}/${n}.webp`);
    await expect(upload(tester, `${tester}/${feedback}/3.webp`)).rejects.toThrow(/row-level security/);
    await expect(upload(other, `${tester}/${feedback}/0.webp`)).rejects.toThrow(/row-level security/);
    await expect(upload(other, `${other}/${feedback}/0.webp`)).rejects.toThrow(/row-level security/);
    await expect(upload(tester, `${tester}/${feedback}/x.png`)).rejects.toThrow(/row-level security/);
  });

  it("records the files, notifies the admins and closes the submission", async () => {
    await as(tester, () => db.query("SELECT finish_feedback($1)", [feedback]));
    expect(await scalar("(SELECT cardinality(screenshot_paths) FROM app_feedback WHERE id = $1)", [feedback])).toBe(3);
    expect((await db.query("SELECT user_id, title, url FROM pushes")).rows).toEqual([{ user_id: admin, title: "Feedback: Problem", url: "/admin/feedback" }]);
    await expect(upload(tester, `${tester}/${feedback}/0.jpg`)).rejects.toThrow(/row-level security/);
    await expect(as(tester, () => db.query("SELECT finish_feedback($1)", [feedback]))).rejects.toThrow(/Unknown or finished/);
    await expect(as(other, () => db.query("SELECT finish_feedback($1)", [feedback]))).rejects.toThrow(/Unknown or finished/);
  });

  it("limits submissions per hour and checks the kind", async () => {
    await expect(as(tester, () => db.query("SELECT submit_feedback('rant', 'x', NULL, NULL, NULL)"))).rejects.toThrow(/check constraint/);
    await db.exec(`INSERT INTO app_feedback (user_id, kind, message) SELECT '${other}', 'idea', 'x' FROM generate_series(1, 10)`);
    await expect(submit(other)).rejects.toThrow(/rate_limited/);
  });
});

describe("reading and handling", () => {
  it("shows screenshots only to the author and admins", async () => {
    expect(await as(tester, () => scalar("(SELECT count(*) FROM storage.objects)"))).toBe(3);
    expect(await as(other, () => scalar("(SELECT count(*) FROM storage.objects)"))).toBe(0);
    expect(await as(admin, () => scalar("(SELECT count(*) FROM storage.objects)"))).toBe(3);
  });

  it("lists finished feedback with the author for admins only", async () => {
    const rows = await as(admin, () => scalar("ops_feedback_list()")) as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: feedback, name: "Petra Pilotin", email: "petra@example.ch", status: "new", path: "/map" });
    await expect(as(tester, () => db.query("SELECT ops_feedback_list()"))).rejects.toThrow(/Flyary admin required/);
    expect(await as(admin, () => scalar("ops_overview()->'feedback_open'"))).toBe(1);
  });

  it("sets status and note; done records when", async () => {
    await as(admin, () => db.query("SELECT ops_set_feedback($1, 'done', ' Behoben in 1.2 ')", [feedback]));
    expect((await db.query("SELECT status, admin_note, handled_at IS NOT NULL AS handled FROM app_feedback WHERE id = $1", [feedback])).rows[0])
      .toEqual({ status: "done", admin_note: "Behoben in 1.2", handled: true });
    await expect(as(tester, () => db.query("SELECT ops_set_feedback($1, 'new', NULL)", [feedback]))).rejects.toThrow(/Flyary admin required/);
    expect(await as(admin, () => scalar("ops_overview()->'feedback_open'"))).toBe(0);
  });
});

describe("cleanup", () => {
  it("keeps fresh files and removes old screenshots, abandoned submissions and orphans", async () => {
    const fresh = await submit(admin, "neu");
    await upload(admin, `${admin}/${fresh}/0.webp`);
    const abandoned = (await db.query<{ id: string }>(`INSERT INTO app_feedback (user_id, kind, message, created_at) VALUES ('${other}', 'idea', 'x', now() - interval '2 days') RETURNING id`)).rows[0].id;
    await db.exec(`INSERT INTO storage.objects (bucket_id, name, created_at) VALUES ('feedback-screenshots', '${other}/${abandoned}/0.webp', now() - interval '2 days')`);

    let result = await scalar("feedback_daily_cleanup()") as { paths: string[]; abandoned: number; expired_screenshots: number };
    expect(result).toMatchObject({ abandoned: 1, expired_screenshots: 0, paths: [`${other}/${abandoned}/0.webp`] });

    await db.exec(`UPDATE app_feedback SET handled_at = now() - interval '91 days' WHERE id = '${feedback}';
      UPDATE storage.objects SET created_at = now() - interval '91 days' WHERE name LIKE '${tester}/%'`);
    result = await scalar("feedback_daily_cleanup()") as typeof result;
    expect(result.expired_screenshots).toBe(1);
    expect(result.paths.filter((p) => p.startsWith(tester))).toHaveLength(3);
    expect(result.paths.some((p) => p.startsWith(admin))).toBe(false);
    expect(await scalar("(SELECT message FROM app_feedback WHERE id = $1)", [feedback])).toBe("Karte lädt nicht");
    await expect(as(admin, () => db.query("SELECT feedback_daily_cleanup()"))).rejects.toThrow(/permission denied/);
  });
});
