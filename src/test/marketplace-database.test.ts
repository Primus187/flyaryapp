// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Isolated PostgreSQL fixture with real RLS for migrations 0031–0038 (marketplace listings, photos, status functions, search, school shop, moderation).
// Only the tables and helper functions the migrations touch are represented.
let db: PGlite;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const owner = id(1), stranger = id(2), schoolAdmin = id(3), shop = id(4), instructor = id(5), student = id(6),
  otherShop = id(7), moderator = id(8), banned = id(9), flyaryAdmin = id(10), schoolMod = id(11);
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
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO authenticated;
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
    CREATE TABLE public.groups (id uuid PRIMARY KEY, name text, group_type public.group_type, created_at timestamptz DEFAULT now());
    CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, pilot_name text, avatar_url text, created_at timestamptz DEFAULT now());
    CREATE TABLE public.flights (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
    CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, actor_id uuid, type text,
      reference_id uuid, reference_type text, read boolean DEFAULT false, created_at timestamptz DEFAULT now());
    CREATE TABLE public.pushes (user_id uuid, title text);
    CREATE FUNCTION public.send_push_notification(u uuid, t text, b text, url text) RETURNS void LANGUAGE sql AS $$ INSERT INTO public.pushes VALUES (u, t) $$;
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

    INSERT INTO auth.users SELECT ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid FROM generate_series(1, 11) n;
    INSERT INTO public.groups VALUES ('${school}', 'Vertical', 'school'), ('${otherSchool}', 'Andere Schule', 'school'),
      ('${pilotGroup}', 'Freunde', 'pilot_group');
    INSERT INTO public.group_members VALUES ('${school}', '${schoolAdmin}', 'admin'), ('${school}', '${shop}', 'member'),
      ('${school}', '${instructor}', 'member'), ('${school}', '${student}', 'member'), ('${otherSchool}', '${otherShop}', 'member'),
      ('${pilotGroup}', '${owner}', 'admin'), ('${school}', '${schoolMod}', 'member');
    INSERT INTO public.group_member_functions VALUES ('${school}', '${instructor}', 'instructor'), ('${school}', '${student}', 'student');
    INSERT INTO public.user_roles VALUES ('${moderator}', 'moderator'), ('${flyaryAdmin}', 'admin');
  `);
  const migration = (name: string) => readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");
  await db.exec(migration("0031_marketplace_group_functions.sql"));
  // the new enum values exist only after 0031 is committed – same as on the real database
  await db.exec(`INSERT INTO public.group_member_functions VALUES ('${school}', '${shop}', 'shop'), ('${otherSchool}', '${otherShop}', 'shop');`);
  await db.exec(migration("0032_marketplace_listings.sql"));
  await db.exec(migration("0033_marketplace_photos.sql"));
  await db.exec(migration("0034_marketplace_listing_status.sql"));
  await db.exec(migration("0035_marketplace_search.sql"));
  await db.exec(migration("0037_school_shop.sql"));
  await db.exec(migration("0038_marketplace_moderation.sql"));
  await db.exec(`INSERT INTO public.marketplace_bans (user_id, reason) VALUES ('${banned}', 'Betrug');
    INSERT INTO public.school_shop_profiles (group_id, legal_name, street, postal_code, locality, email, warranty_text, active)
      VALUES ('${school}', 'Vertical GmbH', 'Hauptstrasse 1', '3800', 'Interlaken', 'shop@vertical.ch', 'Gewährleistung 2 Jahre', true);`);
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

describe("status functions", () => {
  // every listing here is titled "RPC …" and removed afterwards, so later tests see the same data as before
  afterAll(async () => {
    await asSystem();
    await db.exec(`DELETE FROM public.marketplace_listings WHERE title LIKE 'RPC %'`);
  });
  const call = async (uid: string, fn: string, listing: string, extra = "") => {
    await asUser(uid);
    return (await db.query<{ r: Record<string, unknown> }>(`SELECT public.${fn}('${listing}'${extra}) AS r`)).rows[0].r;
  };
  const edit = async (listing: string, set: string) => {
    await asSystem();
    await db.exec(`UPDATE public.marketplace_listings SET ${set} WHERE id = '${listing}'`);
  };
  const addPhoto = async (listing: string) => {
    await asSystem();
    await db.exec(`INSERT INTO public.marketplace_listing_photos (listing_id, path, thumb_path, position)
      VALUES ('${listing}', '${listing}/a.webp', '${listing}/a_thumb.webp', 0)`);
  };
  const row = async (listing: string) => {
    await asSystem();
    return (await db.query<{ status: string; quantity: number; days: number | null; bumped_recent: boolean }>(
      `SELECT status, quantity, round(extract(epoch FROM expires_at - now()) / 86400)::int AS days,
        bumped_at > now() - interval '1 minute' AS bumped_recent FROM public.marketplace_listings WHERE id = '${listing}'`)).rows[0];
  };

  it("publishing checks every required field, in order, and only for the seller", async () => {
    const l = (await insertAs(stranger, `('${stranger}', NULL, 'glider', 'RPC Schirm', 'all', 1, 'draft')`)).rows[0].id;
    await expect(call(owner, "marketplace_publish", l)).rejects.toThrow("marketplace:not_allowed");
    await expect(call(stranger, "marketplace_publish", l)).rejects.toThrow("marketplace:missing_place");
    await edit(l, `postal_code = '3800', locality = 'Interlaken'`);
    await expect(call(stranger, "marketplace_publish", l)).rejects.toThrow("marketplace:missing_price");
    await edit(l, `price_cents = 150000`);
    await expect(call(stranger, "marketplace_publish", l)).rejects.toThrow("marketplace:missing_condition");
    await edit(l, `condition = 'used'`);
    await expect(call(stranger, "marketplace_publish", l)).rejects.toThrow("marketplace:missing_attributes");
    await edit(l, `attributes = '{"certification": "b"}'`);
    await expect(call(stranger, "marketplace_publish", l)).rejects.toThrow("marketplace:missing_photo");
    await addPhoto(l);
    expect(await call(stranger, "marketplace_publish", l)).toMatchObject({ status: "active" });
    expect(await row(l)).toMatchObject({ status: "active", days: 60, bumped_recent: true });
    await expect(call(stranger, "marketplace_publish", l)).rejects.toThrow("marketplace:wrong_status");
  });

  it("a wanted listing needs only the place; more than 5 publications a day are refused", async () => {
    for (let n = 1; n <= 5; n++) {
      const l = (await insertAs(stranger, `('${stranger}', NULL, 'reserve', 'RPC Suche ${n}', 'all', 1, 'draft')`)).rows[0].id;
      await asUser(stranger);
      await db.exec(`UPDATE public.marketplace_listings SET listing_type = 'wanted', postal_code = '8000', locality = 'Zürich' WHERE id = '${l}'`);
      if (n < 5) await call(stranger, "marketplace_publish", l);
      else await expect(call(stranger, "marketplace_publish", l)).rejects.toThrow("marketplace:limit_daily");
    }
  });

  it("refuses an 11th live listing of a person", async () => {
    await asSystem();
    await db.exec(`INSERT INTO public.marketplace_listings (seller_user_id, created_by, category, title, status, published_at, bumped_at, expires_at)
      SELECT '${instructor}', '${instructor}', 'helmet', 'RPC Helm ' || n, 'active', now() - interval '3 days', now(), now() + interval '10 days'
      FROM generate_series(1, 10) n`);
    const l = (await insertAs(instructor, `('${instructor}', NULL, 'clothing', 'RPC Jacke', 'all', 1, 'draft')`)).rows[0].id;
    await edit(l, `listing_type = 'wanted', postal_code = '3800', locality = 'Interlaken'`);
    await expect(call(instructor, "marketplace_publish", l)).rejects.toThrow("marketplace:limit_active");
    await edit(l, `listing_type = 'offer'`);
    await db.exec(`UPDATE public.marketplace_listings SET status = 'expired' WHERE title = 'RPC Helm 1'`);
    await edit(l, `listing_type = 'wanted'`);
    await call(instructor, "marketplace_publish", l);
    const expired = (await db.query<{ id: string }>(`SELECT id FROM public.marketplace_listings WHERE title = 'RPC Helm 1'`)).rows[0].id;
    await expect(call(instructor, "marketplace_renew", expired)).rejects.toThrow("marketplace:limit_active");
  });

  it("reserve, sell, renew and bump", async () => {
    const l = (await insertAs(stranger, `('${stranger}', NULL, 'helmet', 'RPC Helm', 'all', 1, 'draft')`)).rows[0].id;
    await edit(l, `status = 'active', published_at = now() - interval '2 days', bumped_at = now() - interval '2 days', expires_at = now() + interval '5 days'`);
    expect(await call(stranger, "marketplace_reserve", l, ", true")).toMatchObject({ status: "reserved" });
    expect(await call(stranger, "marketplace_reserve", l, ", false")).toMatchObject({ status: "active" });
    await expect(call(stranger, "marketplace_bump", l)).rejects.toThrow("marketplace:bump_too_soon");
    await edit(l, `bumped_at = now() - interval '8 days'`);
    await call(stranger, "marketplace_bump", l);
    expect(await row(l)).toMatchObject({ bumped_recent: true, days: 5 });
    await edit(l, `bumped_at = now() - interval '3 days'`);
    await call(stranger, "marketplace_renew", l);
    expect(await row(l)).toMatchObject({ status: "active", days: 60, bumped_recent: false });
    await edit(l, `status = 'expired'`);
    await expect(call(stranger, "marketplace_reserve", l, ", true")).rejects.toThrow("marketplace:wrong_status");
    await call(stranger, "marketplace_renew", l);
    expect(await row(l)).toMatchObject({ status: "active", days: 60, bumped_recent: true });
    expect(await call(stranger, "marketplace_mark_sold", l)).toMatchObject({ status: "sold" });
    await expect(call(stranger, "marketplace_renew", l)).rejects.toThrow("marketplace:wrong_status");
    await expect(call(owner, "marketplace_reserve", l, ", true")).rejects.toThrow("marketplace:not_allowed");
  });

  it("school new goods do not expire and count down when sold", async () => {
    const l = (await insertAs(shop, `(NULL, '${school}', 'harness', 'RPC Gurtzeug neu', 'all', 3, 'draft')`)).rows[0].id;
    await edit(l, `postal_code = '3800', locality = 'Interlaken', price_cents = 90000, condition = 'new', attributes = '{"harness_type": "pod"}'`);
    await addPhoto(l);
    await call(shop, "marketplace_publish", l);
    expect(await row(l)).toMatchObject({ status: "active", days: null });
    expect(await call(schoolAdmin, "marketplace_mark_sold", l)).toMatchObject({ status: "active", quantity: 2 });
    await call(shop, "marketplace_mark_sold", l);
    expect(await call(shop, "marketplace_mark_sold", l)).toMatchObject({ status: "sold", quantity: 0 });
    await expect(call(instructor, "marketplace_mark_sold", l)).rejects.toThrow("marketplace:not_allowed");
  });

  it("the helper functions are not callable directly", async () => {
    await asUser(owner);
    await expect(db.query(`SELECT public.marketplace_locked_listing('${id(1)}')`)).rejects.toThrow(/permission denied/);
  });
});

describe("search and seller cards", () => {
  // listings here are titled "S …" and removed afterwards
  beforeAll(async () => {
    await asSystem();
    const rows: string[] = [
      `('${stranger}', NULL, 'glider', 'S Ozone Rush 6', '', 150000, 'fixed', 'used', 'M', 'BE', '{"certification": "b"}', 'offer', 'active', 'all', 1, 1)`,
      `('${stranger}', NULL, 'reserve', 'S Rogallo', 'Retter frisch gepackt', 40000, 'fixed', 'used', NULL, 'ZH', '{}', 'offer', 'reserved', 'all', 1, 2)`,
      `('${instructor}', NULL, 'harness', 'S Woody Valley', '', NULL, 'free', 'used', NULL, 'BE', '{}', 'offer', 'active', 'all', 1, 3)`,
      `(NULL, '${school}', 'glider', 'S Schulschirm', '', 90000, 'fixed', 'used', NULL, 'BE', '{"certification": "a"}', 'offer', 'active', 'school_students', 1, 4)`,
      `('${stranger}', NULL, 'tandem', 'S Suche Tandem', '', NULL, 'on_request', NULL, NULL, 'VS', '{}', 'wanted', 'active', 'all', 1, 5)`,
      `('${stranger}', NULL, 'helmet', 'S Helm abgelaufen', '', 5000, 'fixed', 'used', NULL, 'BE', '{}', 'offer', 'active', 'all', -1, 6)`,
      `('${stranger}', NULL, 'helmet', 'S Entwurf', '', 5000, 'fixed', 'used', NULL, 'BE', '{}', 'offer', 'draft', 'all', 1, 7)`,
      `('${stranger}', NULL, 'helmet', 'S Verkauft', '', 5000, 'fixed', 'used', NULL, 'BE', '{}', 'offer', 'sold', 'all', 1, 8)`,
    ];
    await db.exec(`
      INSERT INTO public.marketplace_listings (seller_user_id, seller_group_id, category, title, description, price_cents, price_type,
        condition, size, canton, attributes, listing_type, status, visibility, expires_at, bumped_at)
      SELECT v.su::uuid, v.sg::uuid, v.cat, v.title, v.descr, v.price::integer, v.pt, v.cond, v.size, v.canton, v.attrs::jsonb, v.lt, v.status, v.vis,
        now() + v.exp * interval '10 days', now() - v.age * interval '1 hour'
      FROM (VALUES ${rows.join(",\n")}) AS v(su, sg, cat, title, descr, price, pt, cond, size, canton, attrs, lt, status, vis, exp, age);
      INSERT INTO public.profiles (user_id, pilot_name) VALUES ('${stranger}', 'Sam');
      INSERT INTO public.flights (user_id) VALUES ('${stranger}'), ('${stranger}'), ('${stranger}');
    `);
  });
  afterAll(async () => {
    await asSystem();
    await db.exec(`DELETE FROM public.marketplace_listings WHERE title LIKE 'S %'`);
  });

  const search = async (uid: string, filters: object, cursor: object | null = null, limit = 24) => {
    await asUser(uid);
    const r = (await db.query<{ r: { items: { title: string }[]; next_cursor: object | null } }>(
      `SELECT public.marketplace_search($1::jsonb, $2::jsonb, $3) AS r`, [JSON.stringify(filters), cursor && JSON.stringify(cursor), limit])).rows[0].r;
    return r;
  };
  const titles = async (uid: string, filters: object = {}) =>
    (await search(uid, filters)).items.map((i) => i.title).filter((t) => t.startsWith("S "));

  it("lists only live listings the viewer may see, newest first", async () => {
    expect(await titles(otherShop)).toEqual(["S Ozone Rush 6", "S Rogallo", "S Woody Valley", "S Suche Tandem"]);
    expect(await titles(student)).toEqual(["S Ozone Rush 6", "S Rogallo", "S Woody Valley", "S Schulschirm", "S Suche Tandem"]);
  });

  it("finds word prefixes in title and description, and tolerates typos", async () => {
    expect(await titles(otherShop, { q: "rush" })).toEqual(["S Ozone Rush 6"]);
    expect(await titles(otherShop, { q: "retter gepa" })).toEqual(["S Rogallo"]);
    expect(await titles(otherShop, { q: "ozome" })).toEqual(["S Ozone Rush 6"]);
    expect(await titles(otherShop, { q: "&|!:*" })).toEqual([]);
    expect((await search(otherShop, { q: "alph" })).items.map((i) => i.title)).toEqual(["Advance Alpha 7 (26)"]);
  });

  it("filters by type, category, price, class, canton, size and schools", async () => {
    expect(await titles(otherShop, { categories: ["glider", "tandem"] })).toEqual(["S Ozone Rush 6", "S Suche Tandem"]);
    expect(await titles(otherShop, { type: "wanted" })).toEqual(["S Suche Tandem"]);
    expect(await titles(otherShop, { price_max: 50000 })).toEqual(["S Rogallo", "S Woody Valley"]);
    expect(await titles(otherShop, { price_min: 100000 })).toEqual(["S Ozone Rush 6"]);
    expect(await titles(otherShop, { certifications: ["b"] })).toEqual(["S Ozone Rush 6"]);
    expect(await titles(otherShop, { cantons: ["BE"] })).toEqual(["S Ozone Rush 6", "S Woody Valley"]);
    expect(await titles(otherShop, { size: " m " })).toEqual(["S Ozone Rush 6"]);
    expect(await titles(student, { schools_only: true })).toEqual(["S Schulschirm"]);
    expect(await titles(otherShop, { categories: [], conditions: ["used"] })).toEqual(["S Ozone Rush 6", "S Rogallo", "S Woody Valley"]);
  });

  it("pages through price sorting without gaps or repeats", async () => {
    const all = async (sort: string) => {
      const seen: string[] = [];
      let cursor: object | null = null;
      do {
        const page = await search(otherShop, { sort }, cursor, 2);
        seen.push(...page.items.map((i) => i.title));
        cursor = page.next_cursor;
      } while (cursor);
      return seen;
    };
    expect(await all("price_asc")).toEqual(["S Woody Valley", "S Rogallo", "S Ozone Rush 6", "Advance Alpha 7 (26)", "S Suche Tandem"]);
    expect(await all("price_desc")).toEqual(["Advance Alpha 7 (26)", "S Ozone Rush 6", "S Rogallo", "S Woody Valley", "S Suche Tandem"]);
    expect(await all("newest")).toEqual([...(await search(otherShop, {}, null, 50)).items.map((i) => i.title)]);
  });

  it("returns the seller card only for listings the viewer may see", async () => {
    await asSystem();
    const idOf = async (title: string) => (await db.query<{ id: string }>(`SELECT id FROM public.marketplace_listings WHERE title = $1`, [title])).rows[0].id;
    const [rush, school, draft] = [await idOf("S Ozone Rush 6"), await idOf("S Schulschirm"), await idOf("S Entwurf")];
    const cards = async (uid: string) => {
      await asUser(uid);
      return (await db.query(`SELECT seller_kind, name, flight_count FROM public.marketplace_seller_cards($1::uuid[]) ORDER BY name`,
        [`{${rush},${school},${draft}}`])).rows;
    };
    expect(await cards(otherShop)).toEqual([{ seller_kind: "person", name: "Sam", flight_count: 3 }]);
    expect(await cards(student)).toEqual([
      { seller_kind: "person", name: "Sam", flight_count: 3 },
      { seller_kind: "school", name: "Vertical", flight_count: null },
    ]);
  });
});

describe("school shop", () => {
  const profile = async (uid: string, sql: string) => { await asUser(uid); return db.query(sql); };
  const shops = async (uid: string) => {
    await asUser(uid);
    return (await db.query<{ name: string; ready: boolean; can_admin: boolean }>("SELECT name, ready, can_admin FROM public.marketplace_my_shops()")).rows;
  };

  it("only admins and school leads edit the legal details; active shops are public", async () => {
    await expect(profile(shop, `UPDATE public.school_shop_profiles SET phone = '033 000 00 00' WHERE group_id = '${school}' RETURNING group_id`))
      .resolves.toMatchObject({ rows: [] });
    await expect(profile(instructor, `UPDATE public.school_shop_profiles SET phone = '033 000 00 00' WHERE group_id = '${school}' RETURNING group_id`))
      .resolves.toMatchObject({ rows: [] });
    await expect(profile(schoolAdmin, `UPDATE public.school_shop_profiles SET phone = '033 000 00 00' WHERE group_id = '${school}' RETURNING group_id`))
      .resolves.toMatchObject({ rows: [{ group_id: school }] });
    await expect(profile(otherShop, `INSERT INTO public.school_shop_profiles (group_id) VALUES ('${otherSchool}')`)).rejects.toThrow();
    expect((await profile(stranger, "SELECT group_id FROM public.school_shop_profiles")).rows).toEqual([{ group_id: school }]);
    expect((await profile(shop, "SELECT phone FROM public.school_shop_profiles")).rows).toEqual([{ phone: "033 000 00 00" }]);
  });

  it("a shop can only be active with complete details; VAT needs a valid UID", async () => {
    await asSystem();
    await db.exec(`INSERT INTO public.group_members VALUES ('${otherSchool}', '${flyaryAdmin}', 'admin')`);
    await profile(flyaryAdmin, `INSERT INTO public.school_shop_profiles (group_id, legal_name) VALUES ('${otherSchool}', 'Andere GmbH')`);
    await expect(profile(flyaryAdmin, `UPDATE public.school_shop_profiles SET active = true WHERE group_id = '${otherSchool}'`)).rejects.toThrow(/complete/);
    await expect(profile(flyaryAdmin, `UPDATE public.school_shop_profiles SET vat_registered = true WHERE group_id = '${otherSchool}'`)).rejects.toThrow(/vat_uid/);
    await expect(profile(flyaryAdmin, `UPDATE public.school_shop_profiles SET uid_number = 'CHE-123' WHERE group_id = '${otherSchool}'`)).rejects.toThrow();
    await profile(flyaryAdmin, `UPDATE public.school_shop_profiles SET street = 'Weg 1', postal_code = '3800', locality = 'Interlaken',
      email = 'shop@andere.ch', warranty_text = 'Gewährleistung 2 Jahre', uid_number = 'CHE-123.456.789', vat_registered = true, active = true
      WHERE group_id = '${otherSchool}'`);
    expect((await shops(otherShop))).toEqual([{ name: "Andere Schule", ready: true, can_admin: false }]);
    await expect(profile(owner, `INSERT INTO public.school_shop_profiles (group_id) VALUES ('${pilotGroup}')`)).rejects.toThrow();
  });

  it("lists the schools a person sells for", async () => {
    expect(await shops(shop)).toEqual([{ name: "Vertical", ready: true, can_admin: false }]);
    expect(await shops(schoolAdmin)).toEqual([{ name: "Vertical", ready: true, can_admin: true }]);
    expect(await shops(instructor)).toEqual([]);
    expect(await shops(stranger)).toEqual([]);
  });

  it("without an active shop, school listings are hidden and cannot be published or renewed", async () => {
    const l = (await insertAs(shop, `(NULL, '${school}', 'helmet', 'Shop Helm', 'all', 2, 'draft')`)).rows[0].id;
    await asSystem();
    await db.exec(`UPDATE public.marketplace_listings SET postal_code = '3800', locality = 'Interlaken', price_cents = 9000, condition = 'new'
      WHERE id = '${l}';
      INSERT INTO public.marketplace_listing_photos (listing_id, path, thumb_path, position) VALUES ('${l}', '${l}/a.webp', '${l}/a_thumb.webp', 0);`);
    await profile(schoolAdmin, `UPDATE public.school_shop_profiles SET active = false WHERE group_id = '${school}'`);
    await asUser(shop);
    await expect(db.query(`SELECT public.marketplace_publish('${l}')`)).rejects.toThrow("marketplace:shop_not_ready");
    await profile(schoolAdmin, `UPDATE public.school_shop_profiles SET active = true WHERE group_id = '${school}'`);
    await asUser(shop);
    await db.query(`SELECT public.marketplace_publish('${l}')`);
    expect(await visibleTitles(stranger)).toContain("Shop Helm");
    await profile(schoolAdmin, `UPDATE public.school_shop_profiles SET active = false WHERE group_id = '${school}'`);
    expect(await visibleTitles(stranger)).not.toContain("Shop Helm");
    expect(await visibleTitles(shop)).toContain("Shop Helm");
    await asUser(shop);
    await expect(db.query(`SELECT public.marketplace_renew('${l}')`)).rejects.toThrow("marketplace:shop_not_ready");
    await profile(schoolAdmin, `UPDATE public.school_shop_profiles SET active = true WHERE group_id = '${school}'`);
    await asSystem();
    await db.exec(`DELETE FROM public.marketplace_listings WHERE id = '${l}'`);
  });
});

describe("reports and moderation", () => {
  // listings here are titled "M …" and removed afterwards; the owner's "Advance Alpha 7 (26)" ends active again
  let alpha: string, schoolHelmet: string;
  const report = async (uid: string, listing: string, reason = "scam", note: string | null = null) => {
    await asUser(uid);
    await db.query(`SELECT public.marketplace_report($1, $2, $3)`, [listing, reason, note]);
  };
  const moderate = async (uid: string, listing: string, action: string, reason: string | null = null) => {
    await asUser(uid);
    return db.query(`SELECT public.marketplace_moderate($1, $2, $3)`, [listing, action, reason]);
  };
  const queue = async (uid: string) => {
    await asUser(uid);
    return (await db.query<{ q: { title: string; open_reports: number }[] }>("SELECT public.marketplace_moderation_queue() AS q")).rows[0].q;
  };
  const statusOf = async (listing: string) => {
    await asSystem();
    return (await db.query<{ status: string }>(`SELECT status FROM public.marketplace_listings WHERE id = $1`, [listing])).rows[0].status;
  };
  const mListing = async (seller: string | null, group: string | null, title: string, status = "active") => {
    await asSystem();
    return (await db.query<{ id: string }>(`INSERT INTO public.marketplace_listings (seller_user_id, seller_group_id, created_by, category, title,
      status, published_at, bumped_at, expires_at) VALUES ($1, $2, $3, 'helmet', $4, $5, now(), now(), now() + interval '30 days') RETURNING id`,
      [seller, group, seller ?? shop, title, status])).rows[0].id;
  };

  beforeAll(async () => {
    await asSystem();
    alpha = (await db.query<{ id: string }>(`SELECT id FROM public.marketplace_listings WHERE seller_user_id = '${owner}' AND status = 'active'`)).rows[0].id;
    schoolHelmet = await mListing(null, school, "M Schulhelm");
    await db.exec(`INSERT INTO public.group_member_functions VALUES ('${school}', '${schoolMod}', 'market_moderator');
      DELETE FROM public.pushes; DELETE FROM public.notifications;`);
  });
  afterAll(async () => {
    await asSystem();
    await db.exec(`DELETE FROM public.marketplace_listings WHERE title LIKE 'M %';
      UPDATE public.marketplace_listings SET status = 'active', removed_reason = NULL, removed_at = NULL, removed_from_status = NULL WHERE id = '${alpha}';`);
  });

  it("anyone who sees a listing reports it once; not one's own and not invisible ones", async () => {
    await report(stranger, alpha, "unsafe", "Retter über 10 Jahre alt");
    await expect(report(stranger, alpha)).rejects.toThrow("marketplace:already_reported");
    await expect(report(owner, alpha)).rejects.toThrow("marketplace:own_listing");
    const draft = await mListing(owner, null, "M Entwurf", "draft");
    await expect(report(stranger, draft)).rejects.toThrow("marketplace:not_found");
    await asUser(stranger);
    await expect(db.exec(`INSERT INTO public.marketplace_reports (listing_id, reporter_id, reason) VALUES ('${alpha}', '${stranger}', 'other')`)).rejects.toThrow();
  });

  it("school moderators see reports on private listings only; school listings go to Flyary staff", async () => {
    await report(stranger, schoolHelmet, "wrong_category");
    const reportsSeenBy = async (uid: string) => {
      await asUser(uid);
      return (await db.query("SELECT 1 FROM public.marketplace_reports")).rows.length;
    };
    expect(await reportsSeenBy(stranger)).toBe(2);
    expect(await reportsSeenBy(owner)).toBe(0);
    expect(await reportsSeenBy(schoolMod)).toBe(1);
    expect(await reportsSeenBy(moderator)).toBe(2);
    expect((await queue(schoolMod)).map((q) => q.title)).toEqual(["Advance Alpha 7 (26)"]);
    expect((await queue(moderator)).map((q) => q.title).sort()).toEqual(["Advance Alpha 7 (26)", "M Schulhelm"]);
    expect(await queue(shop)).toEqual([]);
    await expect(moderate(schoolMod, schoolHelmet, "hide", "Falsche Kategorie")).rejects.toThrow("marketplace:not_allowed");
    await expect(moderate(shop, alpha, "dismiss")).rejects.toThrow("marketplace:not_allowed");
  });

  it("hiding needs a reason, tells the seller and hides the listing; restoring brings it back", async () => {
    await expect(moderate(schoolMod, alpha, "hide", " ")).rejects.toThrow("marketplace:reason_required");
    await moderate(schoolMod, alpha, "hide", "Nicht flugtauglich, ohne Kennzeichnung");
    expect(await statusOf(alpha)).toBe("removed");
    expect(await visibleTitles(stranger)).not.toContain("Advance Alpha 7 (26)");
    expect(await visibleTitles(schoolMod)).toContain("Advance Alpha 7 (26)");
    expect(await visibleTitles(owner)).toContain("Advance Alpha 7 (26)");
    await asSystem();
    expect((await db.query(`SELECT type, reference_type FROM public.notifications WHERE user_id = '${owner}'`)).rows)
      .toEqual([{ type: "market_removed", reference_type: "listing" }]);
    expect((await db.query(`SELECT title FROM public.pushes WHERE user_id = '${owner}'`)).rows).toEqual([{ title: "Anzeige ausgeblendet" }]);
    expect((await db.query(`SELECT status FROM public.marketplace_reports WHERE listing_id = '${alpha}'`)).rows).toEqual([{ status: "actioned" }]);
    await moderate(moderator, alpha, "restore");
    expect(await statusOf(alpha)).toBe("active");
    expect(await visibleTitles(stranger)).toContain("Advance Alpha 7 (26)");
    await asSystem();
    expect((await db.query<{ action: string }>(`SELECT action FROM public.marketplace_moderation_log WHERE listing_id = '${alpha}' ORDER BY created_at, action`))
      .rows.map((r) => r.action).sort()).toEqual(["hide", "restore"]);
  });

  it("three reports hide a listing automatically; moderators get at most one push per hour", async () => {
    const auto = await mListing(instructor, null, "M Auto");
    await asSystem();
    await db.exec("DELETE FROM public.pushes; DELETE FROM public.marketplace_moderator_push;");
    await report(stranger, auto);
    await report(student, auto);
    expect(await statusOf(auto)).toBe("active");
    await report(otherShop, auto);
    expect(await statusOf(auto)).toBe("removed");
    await asSystem();
    expect((await db.query(`SELECT action FROM public.marketplace_moderation_log WHERE listing_id = '${auto}'`)).rows).toEqual([{ action: "auto_hide" }]);
    expect((await db.query(`SELECT 1 FROM public.pushes WHERE user_id = '${moderator}'`)).rows).toHaveLength(1);
    expect((await db.query(`SELECT 1 FROM public.pushes WHERE user_id = '${schoolMod}'`)).rows).toHaveLength(1);
    await moderate(schoolMod, auto, "dismiss");
    expect(await statusOf(auto)).toBe("removed");
    expect(await queue(schoolMod)).toEqual([]);
    await moderate(schoolMod, auto, "restore");
    expect(await statusOf(auto)).toBe("active");
  });

  it("school moderators lose the role while their school has no active shop", async () => {
    const other = await mListing(instructor, null, "M Weiterer Helm");
    await report(stranger, other);
    await asSystem();
    await db.exec(`UPDATE public.school_shop_profiles SET active = false WHERE group_id = '${school}'`);
    expect(await queue(schoolMod)).toEqual([]);
    await expect(moderate(schoolMod, other, "dismiss")).rejects.toThrow("marketplace:not_allowed");
    await asSystem();
    await db.exec(`UPDATE public.school_shop_profiles SET active = true WHERE group_id = '${school}'`);
    await moderate(schoolMod, other, "dismiss");
  });

  it("only admins ban and delete listings of others, both logged", async () => {
    await asUser(moderator);
    await expect(db.query(`SELECT public.marketplace_set_ban('${student}', true)`)).rejects.toThrow("marketplace:not_allowed");
    await asUser(flyaryAdmin);
    await db.query(`SELECT public.marketplace_set_ban('${student}', true, NULL, 'Betrugsversuch')`);
    await expect(insertAs(student, `('${student}', NULL, 'helmet', 'M Gesperrt', 'all', 1, 'draft')`)).rejects.toThrow();
    await asUser(flyaryAdmin);
    await db.query(`SELECT public.marketplace_set_ban('${student}', false)`);
    const victim = await mListing(instructor, null, "M Löschen");
    await asUser(moderator);
    expect((await db.query(`DELETE FROM public.marketplace_listings WHERE id = '${victim}' RETURNING id`)).rows).toHaveLength(0);
    await asUser(flyaryAdmin);
    expect((await db.query(`DELETE FROM public.marketplace_listings WHERE id = '${victim}' RETURNING id`)).rows).toHaveLength(1);
    await asSystem();
    expect((await db.query<{ action: string }>(`SELECT action FROM public.marketplace_moderation_log WHERE target_user_id IN ('${student}', '${instructor}')
      AND action IN ('ban', 'unban', 'delete') ORDER BY action`)).rows.map((r) => r.action)).toEqual(["ban", "delete", "unban"]);
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
