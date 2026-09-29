// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0075: training status against the SHV directives, licences, evidence, solo confirmation.
let db: PGlite;
const anna = "00000000-0000-0000-0000-000000000001";  // paragliding student
const iris = "00000000-0000-0000-0000-000000000002";  // instructor (paraglider + hang glider)
const pia = "00000000-0000-0000-0000-000000000003";   // licensed pilot, Biplace 1 candidate
const otto = "00000000-0000-0000-0000-000000000004";  // stranger
const school = "10000000-0000-0000-0000-000000000001";
const site = "20000000-0000-0000-0000-000000000001";  // official site
const place = (n: number) => `30000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const migration = (name: string) => readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE groups(id uuid PRIMARY KEY, name text, group_type text);
    CREATE TABLE group_members(group_id uuid, user_id uuid, role text DEFAULT 'member');
    CREATE TABLE group_member_functions(group_id uuid, user_id uuid, function text);
    CREATE TABLE instructor_certifications(group_id uuid, user_id uuid, cert_type text, valid_until date);
    CREATE TABLE profiles(user_id uuid PRIMARY KEY, pilot_name text);
    CREATE FUNCTION is_group_member(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM group_members WHERE user_id = u AND group_id = g) $$;
    CREATE FUNCTION is_group_admin(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT false $$;
    CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS (SELECT 1 FROM group_member_functions WHERE user_id = u AND group_id = g AND function IN ('instructor','school_lead')) $$;
    CREATE TABLE locations(id uuid PRIMARY KEY, user_id uuid, name text, custom_name text, altitude integer, official_site_id uuid);
    CREATE TABLE pilot_gliders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, manufacturer text, model text, size text);
    CREATE TABLE flights(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, date date DEFAULT current_date,
      takeoff_location_id uuid REFERENCES locations(id) ON DELETE SET NULL, landing_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
      duration_minutes integer, distance_km numeric, glider text, comments text, is_solo_shv boolean NOT NULL DEFAULT false, group_id uuid,
      school_flight_id uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE igc_tracks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flight_id uuid NOT NULL REFERENCES flights(id) ON DELETE CASCADE, storage_path text NOT NULL);
    GRANT SELECT, INSERT, UPDATE, DELETE ON flights TO authenticated;
    GRANT SELECT ON locations, profiles, groups TO authenticated;
    ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own ON flights USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    INSERT INTO groups VALUES ('${school}','Vertical','school');
    INSERT INTO group_members(group_id,user_id) VALUES ('${school}','${anna}'),('${school}','${iris}'),('${school}','${pia}');
    INSERT INTO group_member_functions VALUES ('${school}','${iris}','instructor');
    INSERT INTO instructor_certifications VALUES ('${school}','${iris}','instructor', current_date + 365),('${school}','${iris}','instructor_hg', current_date + 365);
    INSERT INTO profiles VALUES ('${anna}','Anna'),('${iris}','Iris');
  `);
  // Places 1–6: 1 and 2 are two own names for the same official site.
  for (let n = 1; n <= 6; n++) {
    await db.exec(`INSERT INTO locations(id,user_id,name,altitude,official_site_id) VALUES ('${place(n)}','${anna}','Ort ${n}',${1000 + n},${n <= 2 ? `'${site}'` : "NULL"})`);
  }
  for (const m of ["0073_flight_proof_data.sql", "0074_flight_confirmations.sql", "0075_training_status.sql"]) await db.exec(migration(m));
}, 60_000);
afterAll(async () => { await db?.close(); });

async function asUser(user: string) { await db.exec(`RESET ROLE; SET app.user_id='${user}'; SET ROLE authenticated;`); }
async function asOwner() { await db.exec(`RESET ROLE; RESET app.user_id;`); }
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

async function flight(user: string, opts: { takeoff?: number; landing?: number; kind?: string | null; solo?: boolean; minutes?: number; km?: number; date?: string; discipline?: string } = {}) {
  await asUser(user);
  return (await one<{ id: string }>(
    `INSERT INTO flights(user_id, takeoff_location_id, landing_location_id, flight_kind, is_solo_shv, duration_minutes, distance_km, date, discipline)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::date, current_date), COALESCE($9, 'paraglider')) RETURNING id`,
    [user, opts.takeoff ? place(opts.takeoff) : null, opts.landing ? place(opts.landing) : null, opts.kind === undefined ? "altitude" : opts.kind,
      opts.solo ?? false, opts.minutes ?? 10, opts.km ?? null, opts.date ?? null, opts.discipline ?? null])).id;
}
async function submitAndConfirm(ids: string[], setKind: string | null = null) {
  const owner = (await asOwner(), await one<{ user_id: string }>(`SELECT user_id FROM flights WHERE id = $1`, [ids[0]])).user_id;
  await asUser(owner);
  await db.query("SELECT submit_flights_for_confirmation($1::uuid[], $2)", [ids, school]);
  await asUser(iris);
  return (await one<{ r: { confirmed: number; skipped: { reason: string }[] } }>("SELECT confirm_flights($1::uuid[], $2, $3) AS r", [ids, school, setKind])).r;
}
type Req = { rule: string; value: number | null; threshold: number; met: boolean };
async function status(user: string, discipline = "paraglider", licence = "pilot", as = user) {
  await asUser(as);
  const r = (await one<{ r: { requirements: Req[]; confirmedWithoutKind: number } }>("SELECT training_status($1, $2, $3) AS r", [user, discipline, licence])).r;
  return { ...r, by: Object.fromEntries(r.requirements.map((x) => [x.rule, x])) as Record<string, Req> };
}

describe("paragliding pilot (50 altitude flights, 5 take-off and 5 landing sites, 1 solo)", () => {
  it("counts only confirmed altitude flights, sites separately, an official site once", async () => {
    const confirmed = [
      await flight(anna, { takeoff: 1, landing: 3 }), await flight(anna, { takeoff: 2, landing: 4 }),
      await flight(anna, { takeoff: 5, landing: 5 }), await flight(anna, { takeoff: 6, landing: 3 }),
    ];
    await submitAndConfirm(confirmed);
    await flight(anna, { takeoff: 4, landing: 6 });                  // not confirmed
    const practice = await flight(anna, { takeoff: 3, landing: 1, kind: "practice_slope" });
    await submitAndConfirm([practice]);                              // confirmed, but practice slope
    const s = await status(anna);
    expect(s.by.confirmed_altitude_flights).toMatchObject({ value: 4, threshold: 50, met: false });
    expect(s.by.distinct_takeoff_sites.value).toBe(3);  // site (places 1+2), 5, 6
    expect(s.by.distinct_landing_sites.value).toBe(3);  // 3, 4, 5
    expect(s.requirements.map((r) => r.rule)).toEqual(["confirmed_altitude_flights", "distinct_takeoff_sites", "distinct_landing_sites", "confirmed_solo_flights"]);
  });

  it("leaves cancelled flights out", async () => {
    const f = await flight(anna, { takeoff: 4, landing: 6 });
    await submitAndConfirm([f]);
    expect((await status(anna)).by.confirmed_altitude_flights.value).toBe(5);
    await asUser(anna);
    await db.exec(`UPDATE flights SET cancelled_at = now(), cancel_reason = 'doppelt' WHERE id = '${f}'`);
    expect((await status(anna)).by.confirmed_altitude_flights.value).toBe(4);
  });

  it("lets the instructor set the kind of flights without one while confirming, logged as such", async () => {
    const f = await flight(anna, { takeoff: 3, landing: 4, kind: null });
    const p = await flight(anna, { takeoff: 3, landing: 4, kind: "practice_slope" });
    await submitAndConfirm([f, p], "altitude");
    await asOwner();
    expect((await one<{ flight_kind: string }>(`SELECT flight_kind FROM flights WHERE id = $1`, [f])).flight_kind).toBe("altitude");
    expect((await one<{ flight_kind: string }>(`SELECT flight_kind FROM flights WHERE id = $1`, [p])).flight_kind).toBe("practice_slope");
    const log = await one<{ changed_by: string; origin: string }>(`SELECT changed_by, origin FROM flight_changes WHERE flight_id = $1 AND field = 'flight_kind'`, [f]);
    expect(log).toEqual({ changed_by: iris, origin: "confirmation" });
  });

  it("confirms the solo flight only on its own and with the complete checklist", async () => {
    const solo = await flight(anna, { takeoff: 5, landing: 3, solo: true, kind: null });
    const r = await submitAndConfirm([solo]);
    expect(r.skipped[0].reason).toBe("solo_separately");
    await expect(db.query("SELECT confirm_solo_flight($1, $2, true, false, true)", [solo, school])).rejects.toThrow(/checklist/);
    expect((await status(anna)).by.confirmed_solo_flights.value).toBe(0);
    await asUser(iris);
    await db.query("SELECT confirm_solo_flight($1, $2, true, true, true, 'Funk Kanal 1')", [solo, school]);
    const s = await status(anna);
    expect(s.by.confirmed_solo_flights).toMatchObject({ value: 1, met: true });
    await asOwner();
    const c = await one<{ solo_checklist: Record<string, unknown>; flight_kind: string }>(
      `SELECT c.solo_checklist, f.flight_kind FROM flight_confirmations c JOIN flights f ON f.id = c.flight_id WHERE c.flight_id = $1`, [solo]);
    expect(c.solo_checklist).toMatchObject({ briefing: true, contact: true, readiness: true, note: "Funk Kanal 1" });
    expect(c.flight_kind).toBe("altitude");
  });

  it("is met at 50 flights with 5 and 5 sites", async () => {
    const need = 50 - (await status(anna)).by.confirmed_altitude_flights.value!;
    const ids: string[] = [];
    for (let i = 0; i < need; i++) ids.push(await flight(anna, { takeoff: 3 + (i % 4), landing: 1 + (i % 6) }));
    const before = ids.pop()!;
    await submitAndConfirm(ids);
    expect((await status(anna)).by.confirmed_altitude_flights.met).toBe(false); // 49
    await submitAndConfirm([before]);
    const s = await status(anna);
    expect(s.requirements.every((r) => r.met)).toBe(true);
  });
});

describe("hang glider pilot (30 flights, 3 and 3 sites, a flight of at least one hour)", () => {
  it("checks the long flight and counts only hang glider flights", async () => {
    const short = await flight(anna, { takeoff: 3, landing: 4, discipline: "hangglider", minutes: 59 });
    await submitAndConfirm([short]);
    let s = await status(anna, "hangglider");
    expect(s.by.confirmed_altitude_flights.value).toBe(1);
    expect(s.by.confirmed_long_flight_minutes).toMatchObject({ value: 59, threshold: 60, met: false });
    const long = await flight(anna, { takeoff: 3, landing: 4, discipline: "hangglider", minutes: 60 });
    await submitAndConfirm([long]);
    s = await status(anna, "hangglider");
    expect(s.by.confirmed_long_flight_minutes.met).toBe(true);
  });
});

describe("paragliding Biplace 1 (licence 2 years, 200 flights since, 50 km, safety training)", () => {
  it("is not evaluable without a licence and counts logged flights after the licence date", async () => {
    let s = await status(pia, "paraglider", "biplace_1");
    expect(s.by.licence_held_years).toMatchObject({ value: null, met: false });
    await asUser(pia);
    await db.exec(`INSERT INTO pilot_licences(user_id, discipline, level, issued_at) VALUES ('${pia}','paraglider','pilot', current_date - interval '2 years 1 month')`);
    await flight(pia, { date: "2000-01-01" });                           // before the licence
    await flight(pia, { km: 51.2 });
    await flight(pia, { kind: null });
    await flight(pia, { kind: "practice_slope" });
    s = await status(pia, "paraglider", "biplace_1");
    expect(s.by.licence_held_years).toMatchObject({ value: 2, met: true });
    expect(s.by.altitude_flights_since_licence.value).toBe(2);
    expect(s.by.longest_flight_km_since_licence).toMatchObject({ value: 51.2, met: true });
    expect(s.by.evidence_within_years).toMatchObject({ value: null, met: false });
  });

  it("accepts a safety training younger than three years, not an older one", async () => {
    await asUser(pia);
    await db.exec(`INSERT INTO pilot_evidence(user_id, kind, completed_at) VALUES ('${pia}','safety_training', current_date - interval '3 years 2 days')`);
    expect((await status(pia, "paraglider", "biplace_1")).by.evidence_within_years.met).toBe(false);
    await db.exec(`INSERT INTO pilot_evidence(user_id, kind, completed_at) VALUES ('${pia}','safety_training', current_date - interval '2 years 11 months')`);
    expect((await status(pia, "paraglider", "biplace_1")).by.evidence_within_years).toMatchObject({ value: 2, met: true });
  });
});

describe("access", () => {
  it("shows the status to the pilot and the staff of the pilot's school only", async () => {
    await expect(status(anna, "paraglider", "pilot", iris)).resolves.toBeTruthy();
    await asUser(otto);
    await expect(db.query("SELECT training_status($1, 'paraglider', 'pilot')", [anna])).rejects.toThrow(/No access/);
  });

  it("keeps licences and evidence private to the pilot and the school staff", async () => {
    await asUser(iris);
    expect((await db.query(`SELECT 1 FROM pilot_licences WHERE user_id = '${pia}'`)).rows).toHaveLength(1);
    await expect(db.exec(`UPDATE pilot_licences SET issued_at = '1990-01-01' WHERE user_id = '${pia}'`)).resolves.toBeDefined();
    await asOwner();
    expect((await one<{ issued_at: string }>(`SELECT issued_at::text FROM pilot_licences WHERE user_id = '${pia}'`)).issued_at).not.toBe("1990-01-01");
    await asUser(otto);
    expect((await db.query(`SELECT 1 FROM pilot_evidence`)).rows).toHaveLength(0);
  });
});
