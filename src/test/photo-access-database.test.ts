// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const owner = "00000000-0000-0000-0000-000000000001";
const member = "00000000-0000-0000-0000-000000000002";
const follower = "00000000-0000-0000-0000-000000000003";
const stranger = "00000000-0000-0000-0000-000000000004";
const helper = "00000000-0000-0000-0000-000000000005";
const eventHelper = "00000000-0000-0000-0000-000000000006";
const group = "10000000-0000-0000-0000-000000000001";
const event = "20000000-0000-0000-0000-000000000001";
const groupFlight = "30000000-0000-0000-0000-000000000001";
const privateFlight = "30000000-0000-0000-0000-000000000002";
const publishedFlight = "30000000-0000-0000-0000-000000000003";

const migration = (name: string) => readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");
const file = (name: string) => `${owner}/${name}`;

beforeAll(async () => {
  db = new PGlite();
  // Tables and policies as live (2026-09-25), reduced to what the storage policies read.
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth, storage TO authenticated, anon;
    CREATE TABLE storage.objects(bucket_id text, name text);
    CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
      SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON storage.objects TO authenticated;
    CREATE POLICY "Users can view own photos" ON storage.objects FOR SELECT
      USING (bucket_id = 'flight-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

    CREATE TABLE group_members(group_id uuid, user_id uuid);
    CREATE TABLE follows(follower_id uuid, following_id uuid);
    CREATE TABLE profiles(user_id uuid PRIMARY KEY, avatar_url text);
    CREATE TABLE flights(id uuid PRIMARY KEY, user_id uuid, group_id uuid, published_to_feed boolean DEFAULT false);
    CREATE TABLE flight_photos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flight_id uuid, storage_path text);
    CREATE TABLE flight_events(id uuid PRIMARY KEY, group_id uuid, event_date timestamptz);
    CREATE TABLE event_photos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, storage_path text);
    CREATE TABLE event_staff(event_id uuid, user_id uuid, role text);
    CREATE TABLE student_status_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid, student_id uuid, status text, changed_at timestamptz);
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    CREATE FUNCTION is_owner_of_flight(f uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM flights WHERE id = f AND user_id = auth.uid()) $$;
    CREATE FUNCTION is_group_team_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u = '${helper}' $$;
    ALTER TABLE flight_photos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own ON flight_photos FOR SELECT USING (is_owner_of_flight(flight_id));
    CREATE POLICY grp ON flight_photos FOR SELECT USING (EXISTS (SELECT 1 FROM flights f JOIN group_members gm ON gm.group_id = f.group_id WHERE f.id = flight_id AND gm.user_id = auth.uid()));
    CREATE POLICY fol ON flight_photos FOR SELECT USING (EXISTS (SELECT 1 FROM flights f JOIN follows fo ON fo.following_id = f.user_id WHERE f.id = flight_id AND f.published_to_feed AND fo.follower_id = auth.uid()));
    ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY grp ON event_photos FOR SELECT USING (EXISTS (SELECT 1 FROM flight_events fe JOIN group_members gm ON gm.group_id = fe.group_id WHERE fe.id = event_id AND gm.user_id = auth.uid()));
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own ON profiles FOR SELECT USING (user_id = auth.uid());

    INSERT INTO group_members VALUES ('${group}','${owner}'),('${group}','${member}');
    INSERT INTO follows VALUES ('${follower}','${owner}');
    INSERT INTO profiles VALUES ('${owner}','${file("avatar.jpg")}');
    INSERT INTO flights VALUES ('${groupFlight}','${owner}','${group}',false),('${privateFlight}','${owner}',NULL,false),('${publishedFlight}','${owner}',NULL,true);
    INSERT INTO flight_photos(flight_id, storage_path) VALUES ('${groupFlight}','${file("group.webp")}'),('${privateFlight}','${file("private.webp")}'),('${publishedFlight}','${file("published.webp")}');
    INSERT INTO flight_events VALUES ('${event}','${group}',now());
    INSERT INTO event_photos(event_id, storage_path) VALUES ('${event}','${file(`events/${event}/1.webp`)}');
    INSERT INTO event_staff VALUES ('${event}','${eventHelper}','launch_helper');
    INSERT INTO student_status_history(group_id, student_id, status, changed_at) VALUES ('${group}','${member}','paused',now()),('${group}','${owner}','active',now());
    INSERT INTO storage.objects VALUES ('flight-photos','${file("avatar.jpg")}'),('flight-photos','${file("group.webp")}'),('flight-photos','${file("private.webp")}'),
      ('flight-photos','${file("published.webp")}'),('flight-photos','${file(`events/${event}/1.webp`)}'),('flight-photos','${file("loose.webp")}');
  `);
  await db.exec(migration("0061_flight_photo_access.sql"));
  // Original inactive_school_students (staff only) before 0062 replaces it.
  await db.exec(`CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;`);
  await db.exec(migration("0062_inactive_students_for_helpers.sql"));
}, 60_000);
afterAll(async () => { await db?.close(); });

async function readable(user: string) {
  await db.exec(`RESET ROLE; SET app.user_id='${user}'; SET ROLE authenticated;`);
  const rows = (await db.query<{ name: string }>("SELECT name FROM storage.objects ORDER BY name")).rows;
  return rows.map((r) => r.name.slice(owner.length + 1));
}

describe("photos in the flight-photos bucket", () => {
  it("lets the owner read everything in the own folder", async () => {
    expect(await readable(owner)).toHaveLength(6);
  });

  it("lets group members read group flight and event photos and avatars", async () => {
    expect(await readable(member)).toEqual(["avatar.jpg", `events/${event}/1.webp`, "group.webp"]);
  });

  it("lets followers read published flights and avatars, not private ones", async () => {
    expect(await readable(follower)).toEqual(["avatar.jpg", "published.webp"]);
  });

  it("lets strangers read avatars only; files without a row stay private", async () => {
    expect(await readable(stranger)).toEqual(["avatar.jpg"]);
  });
});

describe("inactive students", () => {
  it("are visible to launch helpers and staff of the school's events, as IDs only", async () => {
    for (const user of [helper, eventHelper]) {
      await db.exec(`RESET ROLE; SET app.user_id='${user}'; SET ROLE authenticated;`);
      expect((await db.query<{ ids: string[] }>("SELECT inactive_school_students($1) AS ids", [group])).rows[0].ids).toEqual([member]);
    }
  });

  it("stay hidden from students and strangers", async () => {
    for (const user of [member, stranger]) {
      await db.exec(`RESET ROLE; SET app.user_id='${user}'; SET ROLE authenticated;`);
      await expect(db.query("SELECT inactive_school_students($1)", [group])).rejects.toThrow("School staff access required");
    }
  });
});
