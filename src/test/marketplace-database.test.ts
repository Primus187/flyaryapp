// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Isolated PostgreSQL fixture with real RLS for migrations 0031/0032 (marketplace listings).
// Only the tables and helper functions the migrations touch are represented.
let db: PGlite;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const owner = id(1), stranger = id(2), schoolAdmin = id(3), shop = id(4), instructor = id(5), student = id(6),
  otherShop = id(7), moderator = id(8), banned = id(9), flyaryAdmin = id(10);
const school = id(101), otherSchool = id(102), pilotGroup = id(103);

async function asUser(uid: string) {
  await db.exec(`RESET ROLE; SET app.user_id = '${uid}'; SET ROLE authenticated;`);
}
async function asSystem() { await db.exec("RESET ROLE"); }
async function visibleTitles(uid: string) {
  await asUser(uid);
  const rows = (await db.query<{ title: string }>("SELECT title FROM public.marketplace_listings ORDER BY title")).rows;
  return rows.map((r) => r.title);
}
async function insertAs(uid: string, values: string) {
  await asUser(uid);
  return db.query<{ id: string }>(`INSERT INTO public.marketplace_listings
    (seller_user_id, seller_group_id, category, title, visibility, quantity, status) VALUES ${values} RETURNING id`);
}
async function publish(listingId: string, expires = "now() + interval '60 days'") {
  // stands in for the publish RPC of plan 4.4
  await asSystem();
  await db.exec(`UPDATE public.marketplace_listings SET status = 'active', published_at = now(), bumped_at = now(),
    expires_at = ${expires} WHERE id = '${listingId}'`);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TYPE public.group_type AS ENUM ('school', 'pilot_group');
    CREATE TYPE public.group_function AS ENUM ('student', 'licensed', 'launch_helper', 'instructor', 'school_lead');
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
    CREATE TABLE public.groups (id uuid PRIMARY KEY, name text, group_type public.group_type);
    CREATE TABLE public.group_members (group_id uuid, user_id uuid, role text);
    CREATE TABLE public.group_member_functions (group_id uuid, user_id uuid, function public.group_function);
    CREATE TABLE public.user_roles (user_id uuid, role public.app_role);
    CREATE FUNCTION public.is_group_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS (SELECT 1 FROM public.group_members WHERE user_id = u AND group_id = g) $$;
    CREATE FUNCTION public.is_group_admin(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS (SELECT 1 FROM public.group_members WHERE user_id = u AND group_id = g AND role = 'admin') $$;
    CREATE FUNCTION public.has_group_function(_user_id uuid, _group_id uuid, _function public.group_function)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS (SELECT 1 FROM public.group_member_functions WHERE user_id = _user_id AND group_id = _group_id AND function = _function) $$;
    CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

    INSERT INTO auth.users SELECT ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid FROM generate_series(1, 10) n;
    INSERT INTO public.groups VALUES ('${school}', 'Vertical', 'school'), ('${otherSchool}', 'Andere Schule', 'school'),
      ('${pilotGroup}', 'Freunde', 'pilot_group');
    INSERT INTO public.group_members VALUES ('${school}', '${schoolAdmin}', 'admin'), ('${school}', '${shop}', 'member'),
      ('${school}', '${instructor}', 'member'), ('${school}', '${student}', 'member'), ('${otherSchool}', '${otherShop}', 'member'),
      ('${pilotGroup}', '${owner}', 'admin');
    INSERT INTO public.group_member_functions VALUES ('${school}', '${instructor}', 'instructor'), ('${school}', '${student}', 'student');
    INSERT INTO public.user_roles VALUES ('${moderator}', 'moderator'), ('${flyaryAdmin}', 'admin');
  `);
  const migration = (name: string) => readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");
  await db.exec(migration("0031_marketplace_group_functions.sql"));
  // the new enum values exist only after 0031 is committed – same as on the real database
  await db.exec(`INSERT INTO public.group_member_functions VALUES ('${school}', '${shop}', 'shop'), ('${otherSchool}', '${otherShop}', 'shop');`);
  await db.exec(migration("0032_marketplace_listings.sql"));
  await db.exec(`INSERT INTO public.marketplace_bans (user_id, reason) VALUES ('${banned}', 'Betrug');`);
}, 60_000);
afterAll(async () => { await db?.close(); });

describe("private listings", () => {
  let draftId: string;

  it("owners create drafts that nobody else sees except the moderation", async () => {
    draftId = (await insertAs(owner, `('${owner}', NULL, 'glider', 'Advance Alpha 7', 'all', 1, 'draft')`)).rows[0].id;
    expect(await visibleTitles(owner)).toEqual(["Advance Alpha 7"]);
    expect(await visibleTitles(stranger)).toEqual([]);
    expect(await visibleTitles(moderator)).toEqual(["Advance Alpha 7"]);
  });

  it("refuses listings that start published, belong to someone else or come from banned people", async () => {
    await expect(insertAs(owner, `('${owner}', NULL, 'glider', 'Direkt aktiv', 'all', 1, 'active')`)).rejects.toThrow();
    await expect(insertAs(stranger, `('${owner}', NULL, 'glider', 'Fremd', 'all', 1, 'draft')`)).rejects.toThrow();
    await expect(insertAs(banned, `('${banned}', NULL, 'glider', 'Gesperrt', 'all', 1, 'draft')`)).rejects.toThrow();
  });

  it("private sellers cannot sell several pieces or restrict to students", async () => {
    await expect(insertAs(owner, `('${owner}', NULL, 'helmet', 'Zwei Helme', 'all', 2, 'draft')`)).rejects.toThrow();
    await expect(insertAs(owner, `('${owner}', NULL, 'helmet', 'Nur Schüler', 'school_students', 1, 'draft')`)).rejects.toThrow();
  });

  it("published listings are visible to everyone signed in until they expire, never to anon", async () => {
    await publish(draftId);
    expect(await visibleTitles(stranger)).toEqual(["Advance Alpha 7"]);
    await db.exec(`RESET ROLE; SET ROLE anon;`);
    await expect(db.query("SELECT * FROM public.marketplace_listings")).rejects.toThrow(/permission denied/);
    await publish(draftId, "now() - interval '1 minute'");
    expect(await visibleTitles(stranger)).toEqual([]);
    expect(await visibleTitles(owner)).toEqual(["Advance Alpha 7"]);
    await publish(draftId);
  });

  it("owners edit content but not status or dates; others change nothing", async () => {
    await asUser(owner);
    await db.exec(`UPDATE public.marketplace_listings SET title = 'Advance Alpha 7 (26)', price_cents = 180000 WHERE id = '${draftId}'`);
    await expect(db.exec(`UPDATE public.marketplace_listings SET status = 'sold' WHERE id = '${draftId}'`)).rejects.toThrow(/permission denied/);
    await expect(db.exec(`UPDATE public.marketplace_listings SET bumped_at = now() WHERE id = '${draftId}'`)).rejects.toThrow(/permission denied/);
    await expect(db.exec(`UPDATE public.marketplace_listings SET seller_user_id = '${stranger}' WHERE id = '${draftId}'`)).rejects.toThrow(/permission denied/);
    await asUser(stranger);
    const res = await db.query(`UPDATE public.marketplace_listings SET title = 'Gehackt' WHERE id = '${draftId}' RETURNING id`);
    expect(res.rows).toHaveLength(0);
    await expect(db.query(`DELETE FROM public.marketplace_listings WHERE id = '${draftId}' RETURNING id`)).resolves.toMatchObject({ rows: [] });
    expect(await visibleTitles(stranger)).toEqual(["Advance Alpha 7 (26)"]);
  });

  it("a free listing cannot carry a price", async () => {
    await asUser(owner);
    await expect(db.exec(`UPDATE public.marketplace_listings SET price_type = 'free' WHERE id = '${draftId}'`)).rejects.toThrow();
  });
});

describe("school listings", () => {
  it("admins, school leads and the shop team sell for the school; instructors and other schools cannot", async () => {
    await insertAs(shop, `(NULL, '${school}', 'harness', 'Schul-Gurtzeug neu', 'all', 5, 'draft')`);
    await insertAs(schoolAdmin, `(NULL, '${school}', 'glider', 'Schulungsschirm Occasion', 'school_students', 1, 'draft')`);
    await expect(insertAs(instructor, `(NULL, '${school}', 'helmet', 'Instruktor', 'all', 1, 'draft')`)).rejects.toThrow();
    await expect(insertAs(otherShop, `(NULL, '${school}', 'helmet', 'Konkurrenz', 'all', 1, 'draft')`)).rejects.toThrow();
    await expect(insertAs(owner, `(NULL, '${pilotGroup}', 'helmet', 'Pilotengruppe', 'all', 1, 'draft')`)).rejects.toThrow(/only flight schools/);
    expect(await visibleTitles(shop)).toEqual(["Advance Alpha 7 (26)", "Schul-Gurtzeug neu", "Schulungsschirm Occasion"]);
    expect(await visibleTitles(instructor)).toEqual(["Advance Alpha 7 (26)"]);
  });

  it("'school_students' listings reach only members of the selling school", async () => {
    await asSystem();
    const rows = (await db.query<{ id: string }>(`SELECT id FROM public.marketplace_listings WHERE seller_group_id = '${school}'`)).rows;
    for (const r of rows) await publish(r.id);
    expect(await visibleTitles(student)).toEqual(["Advance Alpha 7 (26)", "Schul-Gurtzeug neu", "Schulungsschirm Occasion"]);
    expect(await visibleTitles(stranger)).toEqual(["Advance Alpha 7 (26)", "Schul-Gurtzeug neu"]);
    expect(await visibleTitles(otherShop)).toEqual(["Advance Alpha 7 (26)", "Schul-Gurtzeug neu"]);
  });

  it("account deletion removes private listings but keeps the school's", async () => {
    await asSystem();
    await db.exec(`DELETE FROM auth.users WHERE id IN ('${owner}', '${shop}')`);
    const rows = (await db.query<{ title: string; created_by: string | null }>(
      "SELECT title, created_by FROM public.marketplace_listings ORDER BY title")).rows;
    expect(rows).toEqual([
      { title: "Schul-Gurtzeug neu", created_by: null },
      { title: "Schulungsschirm Occasion", created_by: schoolAdmin },
    ]);
  });
});

describe("bans", () => {
  it("only the admin manages bans; people see only their own", async () => {
    await asUser(stranger);
    expect((await db.query("SELECT * FROM public.marketplace_bans")).rows).toHaveLength(0);
    await expect(db.exec(`INSERT INTO public.marketplace_bans (user_id) VALUES ('${student}')`)).rejects.toThrow();
    await asUser(banned);
    expect((await db.query("SELECT * FROM public.marketplace_bans")).rows).toHaveLength(1);
    await asUser(moderator);
    await expect(db.exec(`INSERT INTO public.marketplace_bans (user_id) VALUES ('${student}')`)).rejects.toThrow();
    await asUser(flyaryAdmin);
    await db.exec(`INSERT INTO public.marketplace_bans (user_id, until) VALUES ('${student}', now() - interval '1 day')`);
    await expect(insertAs(student, `('${student}', NULL, 'helmet', 'Nach Ablauf der Sperre', 'all', 1, 'draft')`)).resolves.toBeTruthy();
  });
});
