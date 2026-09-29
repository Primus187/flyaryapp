// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0073: stable flight numbers, proof data and the change history of flights.
let db: PGlite;
const anna = "00000000-0000-0000-0000-000000000001";
const beat = "00000000-0000-0000-0000-000000000002";
const iris = "00000000-0000-0000-0000-000000000003"; // instructor of the school
const stranger = "00000000-0000-0000-0000-000000000004";
const school = "10000000-0000-0000-0000-000000000001";
const bergbo = "30000000-0000-0000-0000-000000000001";
const lehn = "30000000-0000-0000-0000-000000000002";
const beatenberg = "30000000-0000-0000-0000-000000000003";
const pi3 = "40000000-0000-0000-0000-000000000001";
const alpha = "40000000-0000-0000-0000-000000000002";
const beatsWing = "40000000-0000-0000-0000-000000000003";
const late = "70000000-0000-0000-0000-000000000001";
const early = "70000000-0000-0000-0000-000000000002";
const middle = "70000000-0000-0000-0000-000000000003";

const migration = readFileSync(new URL("../../drizzle/migrations/0073_flight_proof_data.sql", import.meta.url), "utf8");

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u = '${iris}' $$;
    CREATE TABLE locations(id uuid PRIMARY KEY, user_id uuid, name text, custom_name text);
    CREATE TABLE pilot_gliders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, manufacturer text, model text, size text);
    CREATE TABLE flights(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, date date DEFAULT current_date,
      takeoff_location_id uuid REFERENCES locations(id) ON DELETE SET NULL, landing_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
      duration_minutes integer, glider text, comments text, is_solo_shv boolean NOT NULL DEFAULT false, group_id uuid,
      school_flight_id uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE igc_tracks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flight_id uuid NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
      storage_path text NOT NULL);
    GRANT SELECT, INSERT, UPDATE, DELETE ON flights, pilot_gliders, igc_tracks TO authenticated;
    GRANT SELECT ON locations TO authenticated;
    ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own ON flights USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    CREATE POLICY staff ON flights FOR SELECT USING (group_id IS NOT NULL AND is_group_staff(auth.uid(), group_id));
    INSERT INTO locations VALUES ('${bergbo}','${anna}','Bergbo',NULL),('${lehn}','${anna}','Lehn',NULL),('${beatenberg}','${anna}','Beatenberg','LP Beatenberg');
    INSERT INTO pilot_gliders VALUES ('${pi3}','${anna}','Advance','Pi3','21'),('${alpha}','${anna}','Advance','Alpha 7',NULL),
      ('${beatsWing}','${beat}','Advance','Pi3','21');
    INSERT INTO flights(id,user_id,date,glider,created_at,group_id) VALUES
      ('${late}','${anna}','2025-01-19','Advance Pi3 (21)',now(),'${school}'),
      ('${early}','${anna}','2024-08-05','advance alpha 7',now(),NULL),
      ('${middle}','${anna}','2024-09-07','Some borrowed wing',now(),NULL);
    INSERT INTO flights(user_id,date) VALUES ('${beat}','2025-03-01');
  `);
  await db.exec(migration);
}, 60_000);
afterAll(async () => { await db?.close(); });

async function asUser(user: string) { await db.exec(`RESET ROLE; SET app.user_id='${user}'; SET ROLE authenticated;`); }
async function asOwner() { await db.exec(`RESET ROLE; RESET app.user_id;`); }
const one = async <T>(sql: string) => (await db.query<T>(sql)).rows[0];
const changes = async (flight: string) =>
  (await db.query<{ field: string; old_value: unknown; new_value: unknown; changed_by: string | null; origin: string }>(
    `SELECT field, old_value, new_value, changed_by, origin FROM flight_changes WHERE flight_id = '${flight}' ORDER BY id`)).rows;

describe("backfill of existing flights", () => {
  it("numbers each pilot's flights by date", async () => {
    await asOwner();
    const rows = (await db.query<{ id: string; flight_no: number }>(
      `SELECT id, flight_no FROM flights WHERE user_id = '${anna}' ORDER BY flight_no`)).rows;
    expect(rows.map((r) => r.id)).toEqual([early, middle, late]);
    expect(rows.map((r) => r.flight_no)).toEqual([1, 2, 3]);
    expect((await one<{ flight_no: number }>(`SELECT flight_no FROM flights WHERE user_id = '${beat}'`)).flight_no).toBe(1);
  });

  it("links the free-text glider only where exactly one of the pilot's gliders matches", async () => {
    const rows = (await db.query<{ id: string; glider_id: string | null; glider: string }>(
      `SELECT id, glider_id, glider FROM flights WHERE user_id = '${anna}'`)).rows;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[late].glider_id).toBe(pi3);
    expect(byId[early].glider_id).toBe(alpha);
    expect(byId[middle].glider_id).toBeNull();
    expect(byId[middle].glider).toBe("Some borrowed wing");
  });

  it("does not log the backfill as changes", async () => {
    expect((await one<{ n: number }>("SELECT count(*)::int AS n FROM flight_changes")).n).toBe(0);
  });
});

describe("flight numbers and origin", () => {
  it("gives new flights the next number, also for multi-row inserts, and ignores a number sent by the client", async () => {
    await asUser(anna);
    const rows = (await db.query<{ flight_no: number }>(
      `INSERT INTO flights(user_id, date, flight_no) VALUES ('${anna}','2020-01-01', 1), ('${anna}','2020-01-02', 1) RETURNING flight_no`)).rows;
    expect(rows.map((r) => r.flight_no)).toEqual([4, 5]);
  });

  it("keeps number and origin when the pilot edits the flight", async () => {
    await asUser(anna);
    await db.exec(`UPDATE flights SET flight_no = 99, source = 'flightbook', source_ref = 'x' WHERE id = '${late}'`);
    const row = await one<{ flight_no: number; source: string; source_ref: string | null }>(
      `SELECT flight_no, source, source_ref FROM flights WHERE id = '${late}'`);
    expect(row).toEqual({ flight_no: 3, source: "manual", source_ref: null });
  });

  it("keeps the Flightbook origin of imported flights and never lets the client claim a school flight", async () => {
    await asUser(anna);
    const imported = await one<{ source: string; source_ref: string }>(
      `INSERT INTO flights(user_id, source, source_ref) VALUES ('${anna}','flightbook','78') RETURNING source, source_ref`);
    expect(imported).toEqual({ source: "flightbook", source_ref: "78" });
    const claimed = await one<{ source: string }>(`INSERT INTO flights(user_id, source) VALUES ('${anna}','school') RETURNING source`);
    expect(claimed.source).toBe("manual");
  });

  it("refuses a glider of another pilot", async () => {
    await asUser(anna);
    await expect(db.exec(`UPDATE flights SET glider_id = '${beatsWing}' WHERE id = '${middle}'`)).rejects.toThrow(/does not belong/);
  });
});

describe("change history", () => {
  it("logs changed proof data with old and new value, the place names and the pilot as actor", async () => {
    await asUser(anna);
    await db.exec(`UPDATE flights SET takeoff_location_id = '${bergbo}', landing_location_id = '${lehn}', duration_minutes = 10 WHERE id = '${late}'`);
    await db.exec(`UPDATE flights SET landing_location_id = '${beatenberg}', comments = 'Thermik am Nachmittag' WHERE id = '${late}'`);
    const log = await changes(late);
    expect(log.map((c) => c.field)).toEqual(["duration_minutes", "takeoff_location", "landing_location", "landing_location"]);
    expect(log[3].old_value).toEqual({ id: lehn, name: "Lehn" });
    expect(log[3].new_value).toEqual({ id: beatenberg, name: "LP Beatenberg" });
    expect(log.every((c) => c.changed_by === anna && c.origin === "app")).toBe(true);
  });

  it("does not log a description change alone", async () => {
    await asUser(anna);
    const before = (await changes(late)).length;
    await db.exec(`UPDATE flights SET comments = 'Nur Notiz' WHERE id = '${late}'`);
    expect(await changes(late)).toHaveLength(before);
  });

  it("logs a changed glider label but not a glider removed from the profile", async () => {
    await asUser(anna);
    await db.exec(`UPDATE flights SET glider = 'Advance Pi3 (21) Fire' WHERE id = '${late}'`);
    let glider = (await changes(late)).filter((c) => c.field === "glider");
    expect(glider).toHaveLength(1);
    expect(glider[0].old_value).toEqual({ id: pi3, label: "Advance Pi3 (21)" });
    await asOwner();
    await db.exec(`DELETE FROM pilot_gliders WHERE id = '${pi3}'`);
    glider = (await changes(late)).filter((c) => c.field === "glider");
    expect(glider).toHaveLength(1);
    expect((await one<{ glider: string }>(`SELECT glider FROM flights WHERE id = '${late}'`)).glider).toBe("Advance Pi3 (21) Fire");
  });

  it("logs changes by other tools with their origin", async () => {
    await asOwner();
    await db.exec(`SET flyary.change_origin = 'site_merge'; UPDATE flights SET takeoff_location_id = '${lehn}' WHERE id = '${late}'; RESET flyary.change_origin;`);
    const last = (await changes(late)).at(-1)!;
    expect(last).toMatchObject({ field: "takeoff_location", origin: "site_merge", changed_by: null });
  });

  it("logs IGC tracks added and removed, and still lets the pilot delete the flight", async () => {
    await asOwner();
    const flight = (await one<{ id: string }>(`INSERT INTO flights(user_id) VALUES ('${anna}') RETURNING id`)).id;
    await db.exec(`INSERT INTO igc_tracks(flight_id, storage_path) VALUES ('${flight}', '${anna}/${flight}/1-track.igc')`);
    await db.exec(`DELETE FROM igc_tracks WHERE flight_id = '${flight}'`);
    await db.exec(`INSERT INTO igc_tracks(flight_id, storage_path) VALUES ('${flight}', '${anna}/${flight}/2-better.igc')`);
    const log = await changes(flight);
    expect(log.map((c) => [c.old_value, c.new_value])).toEqual([[null, "1-track.igc"], ["1-track.igc", null], [null, "2-better.igc"]]);
    expect(log.every((c) => c.changed_by === anna && c.origin === "igc")).toBe(true);
    await asUser(anna);
    await db.exec(`DELETE FROM flights WHERE id = '${flight}'`);
    await asOwner();
    expect((await one<{ n: number }>(`SELECT count(*)::int AS n FROM flight_changes WHERE flight_id = '${flight}'`)).n).toBe(0);
  });

  it("is readable by the pilot and the school staff of the flight, not by others", async () => {
    await asUser(anna);
    expect((await changes(late)).length).toBeGreaterThan(0);
    await asUser(iris);
    expect((await changes(late)).length).toBeGreaterThan(0);
    expect(await changes(early)).toHaveLength(0);
    await asUser(stranger);
    expect(await changes(late)).toHaveLength(0);
  });

  it("cannot be written or erased by app users", async () => {
    await asUser(anna);
    await expect(db.exec(`INSERT INTO flight_changes(flight_id, user_id, field) VALUES ('${late}','${anna}','date')`)).rejects.toThrow(/permission denied/);
    await expect(db.exec(`UPDATE flight_changes SET new_value = 'null' WHERE flight_id = '${late}'`)).rejects.toThrow(/permission denied/);
    await expect(db.exec(`DELETE FROM flight_changes WHERE flight_id = '${late}'`)).rejects.toThrow(/permission denied/);
  });
});
