// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Isolated PostgreSQL fixture with real RLS for migrations 0031–0033 (marketplace listings and photos).
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
    CREATE SCHEMA storage; GRANT USAGE ON SCHEMA storage TO authenticated;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;
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
  await db.exec(migration("0033_marketplace_photos.sql"));
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

describe("photos", () => {
  let listingId: string;
  const file = (listing: string, n: number) => `${listing}/${id(900 + n)}.webp`;
  async function uploadAs(uid: string, name: string) {
    await asUser(uid);
    await db.exec(`INSERT INTO storage.objects (bucket_id, name) VALUES ('marketplace-photos', '${name}')`);
  }
  async function visibleFiles(uid: string, listing: string) {
    await asUser(uid);
    return (await db.query(`SELECT name FROM storage.objects WHERE name LIKE '${listing}/%'`)).rows.length;
  }

  beforeAll(async () => {
    await asSystem();
    listingId = (await db.query<{ id: string }>(`SELECT id FROM public.marketplace_listings WHERE seller_user_id = '${owner}'`)).rows[0].id;
  });

  it("creates a private bucket for compressed images only", async () => {
    await asSystem();
    const bucket = (await db.query("SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'marketplace-photos'")).rows[0];
    expect(bucket).toEqual({ public: false, file_size_limit: 2097152, allowed_mime_types: ["image/webp", "image/jpeg"] });
  });

  it("only the seller uploads; files follow the listing's visibility", async () => {
    await uploadAs(owner, file(listingId, 1));
    await expect(uploadAs(stranger, file(listingId, 2))).rejects.toThrow();
    await expect(uploadAs(owner, `not-a-uuid/${id(999)}.webp`)).rejects.toThrow();
    expect(await visibleFiles(stranger, listingId)).toBe(1);

    const draft = (await insertAs(stranger, `('${stranger}', NULL, 'helmet', 'Entwurf Helm', 'all', 1, 'draft')`)).rows[0].id;
    await uploadAs(stranger, file(draft, 1));
    expect(await visibleFiles(stranger, draft)).toBe(1);
    expect(await visibleFiles(owner, draft)).toBe(0);
    await asSystem();
    await db.exec(`DELETE FROM storage.objects WHERE name LIKE '${draft}/%'; DELETE FROM public.marketplace_listings WHERE id = '${draft}'`);
  });

  it("stops at 12 files (6 photos with thumbnails)", async () => {
    for (let n = 2; n <= 12; n++) await uploadAs(owner, file(listingId, n));
    await expect(uploadAs(owner, file(listingId, 13))).rejects.toThrow();
  });

  it("the seller and the moderation delete files, others cannot", async () => {
    await asUser(stranger);
    expect((await db.query(`DELETE FROM storage.objects WHERE name = '${file(listingId, 12)}' RETURNING id`)).rows).toHaveLength(0);
    await asUser(moderator);
    expect((await db.query(`DELETE FROM storage.objects WHERE name = '${file(listingId, 12)}' RETURNING id`)).rows).toHaveLength(1);
    await asUser(owner);
    expect((await db.query(`DELETE FROM storage.objects WHERE name LIKE '${listingId}/%' RETURNING id`)).rows).toHaveLength(11);
  });

  it("records at most 6 photos with paths inside the listing folder", async () => {
    await asUser(owner);
    const row = (n: number) => `('${id(800 + n)}', '${listingId}', '${listingId}/p${n}.webp', '${listingId}/p${n}_thumb.webp', ${n})`;
    await db.exec(`INSERT INTO public.marketplace_listing_photos (id, listing_id, path, thumb_path, position) VALUES
      ${[0, 1, 2, 3, 4, 5].map(row).join(", ")}`);
    await expect(db.exec(`INSERT INTO public.marketplace_listing_photos (listing_id, path, thumb_path, position)
      VALUES ('${listingId}', '${listingId}/x.webp', '${listingId}/x_thumb.webp', 5)`)).rejects.toThrow(/at most 6 photos/);
    await asSystem();
    await db.exec(`DELETE FROM public.marketplace_listing_photos WHERE id = '${id(805)}'`);
    await asUser(owner);
    await expect(db.exec(`INSERT INTO public.marketplace_listing_photos (listing_id, path, thumb_path, position)
      VALUES ('${listingId}', 'other/x.webp', '${listingId}/x_thumb.webp', 5)`)).rejects.toThrow();
    await asUser(stranger);
    await expect(db.exec(`INSERT INTO public.marketplace_listing_photos (listing_id, path, thumb_path, position)
      VALUES ('${listingId}', '${listingId}/y.webp', '${listingId}/y_thumb.webp', 5)`)).rejects.toThrow();
    expect((await db.query(`SELECT id FROM public.marketplace_listing_photos WHERE listing_id = '${listingId}'`)).rows).toHaveLength(5);
  });

  it("reorders all photos at once, only for the seller and only with the complete list", async () => {
    const ids = [4, 3, 2, 1, 0].map((n) => id(800 + n));
    const call = (list: string[]) => db.query(`SELECT public.marketplace_reorder_photos('${listingId}', ARRAY[${list.map((x) => `'${x}'`).join(",")}]::uuid[])`);
    await asUser(stranger);
    await expect(call(ids)).rejects.toThrow(/not allowed/);
    await asUser(owner);
    await expect(call(ids.slice(1))).rejects.toThrow(/exactly once/);
    await call(ids);
    const order = (await db.query<{ id: string }>(`SELECT id FROM public.marketplace_listing_photos WHERE listing_id = '${listingId}' ORDER BY position`)).rows;
    expect(order.map((r) => r.id)).toEqual(ids);
  });

  it("sold listings take no new photos", async () => {
    await asSystem();
    await db.exec(`UPDATE public.marketplace_listings SET status = 'sold' WHERE id = '${listingId}'`);
    await expect(uploadAs(owner, file(listingId, 20))).rejects.toThrow();
    await asSystem();
    await db.exec(`UPDATE public.marketplace_listings SET status = 'active' WHERE id = '${listingId}'`);
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
