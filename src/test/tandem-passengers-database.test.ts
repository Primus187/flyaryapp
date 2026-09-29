// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0076: tandem flights, passenger confirmation (app and single-use link), tandem requirements.
let db: PGlite;
const pia = "00000000-0000-0000-0000-000000000001";   // tandem pilot (Biplace 1 holder)
const paul = "00000000-0000-0000-0000-000000000002";  // passenger with an account
const otto = "00000000-0000-0000-0000-000000000003";  // stranger
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
    CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT false $$;
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
    INSERT INTO profiles VALUES ('${pia}','Pia Pilotin'),('${paul}','Paul');
  `);
  for (let n = 1; n <= 6; n++) await db.exec(`INSERT INTO locations(id,user_id,name,altitude) VALUES ('${place(n)}','${pia}','Ort ${n}',${1000 + n})`);
  for (const m of ["0073_flight_proof_data.sql", "0074_flight_confirmations.sql", "0075_training_status.sql", "0076_tandem_passengers.sql"]) await db.exec(migration(m));
  await db.exec(`INSERT INTO pilot_licences(user_id, discipline, level, issued_at) VALUES ('${pia}','paraglider','biplace_1', current_date - 400)`);
}, 60_000);
afterAll(async () => { await db?.close(); });

async function asUser(user: string) { await db.exec(`RESET ROLE; SET app.user_id='${user}'; SET ROLE authenticated;`); }
async function asAnon() { await db.exec(`RESET ROLE; RESET app.user_id; SET ROLE anon;`); }
async function asOwner() { await db.exec(`RESET ROLE; RESET app.user_id;`); }
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
async function tandem(opts: { kind?: string; takeoff?: number; landing?: number; date?: string } = {}) {
  await asUser(pia);
  return (await one<{ id: string }>(
    `INSERT INTO flights(user_id, is_tandem, tandem_kind, takeoff_location_id, landing_location_id, date)
     VALUES ($1, true, $2, $3, $4, COALESCE($5::date, current_date)) RETURNING id`,
    [pia, opts.kind ?? "practice", place(opts.takeoff ?? 1), place(opts.landing ?? 2), opts.date ?? null])).id;
}
const passenger = async (flight: string) => {
  await asOwner();
  return one<{ status: string; passenger_user_id: string | null; token_hash: string | null; confirmed_data: unknown }>(
    `SELECT status, passenger_user_id, token_hash, confirmed_data FROM flight_passengers WHERE flight_id = $1`, [flight]);
};
async function status(licence: string) {
  await asUser(pia);
  const r = (await one<{ r: { requirements: { rule: string; value: number | null; met: boolean; params: { label?: string } }[] } }>(
    "SELECT training_status($1, 'paraglider', $2) AS r", [pia, licence])).r;
  return r.requirements;
}

describe("passenger confirmation", () => {
  it("lets the pilot name the passenger and a registered passenger confirm in the app", async () => {
    const f = await tandem();
    await db.query("SELECT set_flight_passenger($1, 'Paul', $2)", [f, paul]);
    await asUser(paul);
    const open = (await one<{ r: { flightId: string; pilotName: string }[] }>("SELECT my_open_passenger_confirmations() AS r")).r;
    expect(open).toEqual([expect.objectContaining({ flightId: f, pilotName: "Pia Pilotin" })]);
    await db.query("SELECT confirm_passenger_flight($1)", [f]);
    expect((await passenger(f)).status).toBe("confirmed");
  });

  it("confirms through a single-use link without an account, showing only the minimum", async () => {
    const f = await tandem();
    await db.query("SELECT set_flight_passenger($1, 'Gast Müller')", [f]);
    const token = (await one<{ t: string }>("SELECT create_passenger_token($1) AS t", [f])).t;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect((await passenger(f)).token_hash).not.toBe(token);
    await asAnon();
    const info = (await one<{ i: Record<string, unknown> }>("SELECT passenger_confirmation_info($1) AS i", [token])).i;
    expect(Object.keys(info).sort()).toEqual(["date", "discipline", "durationMinutes", "expired", "landing", "passengerName", "pilotName", "takeoff"]);
    expect(info).toMatchObject({ pilotName: "Pia Pilotin", passengerName: "Gast Müller", takeoff: "Ort 1", expired: false });
    expect((await one<{ ok: boolean }>("SELECT confirm_as_passenger($1) AS ok", [token])).ok).toBe(true);
    expect((await one<{ ok: boolean }>("SELECT confirm_as_passenger($1) AS ok", [token])).ok).toBe(false);  // spent
    const p = await passenger(f);
    expect(p).toMatchObject({ status: "confirmed", token_hash: null });
    expect(p.confirmed_data).toMatchObject({ isTandem: true });
  });

  it("refuses wrong and expired tokens, and the pilot as passenger", async () => {
    const f = await tandem();
    await db.query("SELECT set_flight_passenger($1, 'Gast')", [f]);
    const token = (await one<{ t: string }>("SELECT create_passenger_token($1) AS t", [f])).t;
    await asAnon();
    expect((await one<{ ok: boolean }>("SELECT confirm_as_passenger('nonsense') AS ok")).ok).toBe(false);
    expect((await one<{ i: unknown }>("SELECT passenger_confirmation_info('nonsense') AS i")).i).toBeNull();
    await asUser(pia);
    await expect(db.query("SELECT confirm_as_passenger($1)", [token])).rejects.toThrow(/pilot cannot/);
    await expect(db.query("SELECT set_flight_passenger($1, 'Ich', $2)", [f, pia])).rejects.toThrow(/pilot cannot/);
    await asOwner();
    await db.exec(`UPDATE flight_passengers SET token_expires_at = now() - interval '1 minute' WHERE flight_id = '${f}'`);
    await asAnon();
    expect((await one<{ ok: boolean }>("SELECT confirm_as_passenger($1) AS ok", [token])).ok).toBe(false);
  });

  it("resets the confirmation when the passenger changes, and logs it", async () => {
    const f = await tandem();
    await db.query("SELECT set_flight_passenger($1, 'Paul', $2)", [f, paul]);
    await asUser(paul); await db.query("SELECT confirm_passenger_flight($1)", [f]);
    await asUser(pia);
    await db.query("SELECT set_flight_passenger($1, 'Paul', $2)", [f, paul]);  // unchanged: nothing happens
    expect((await passenger(f)).status).toBe("confirmed");
    await asUser(pia);
    await db.query("SELECT set_flight_passenger($1, 'Petra')", [f]);
    expect(await passenger(f)).toMatchObject({ status: "pending", passenger_user_id: null });
    const log = (await db.query<{ old_value: { name: string; confirmed: boolean } }>(
      `SELECT old_value FROM flight_changes WHERE flight_id = '${f}' AND field = 'passenger' ORDER BY id`)).rows;
    expect(log.at(-1)!.old_value).toEqual({ name: "Paul", confirmed: true });
  });

  it("keeps passengers private and the token hash unreadable", async () => {
    await asUser(otto);
    expect((await db.query("SELECT id FROM flight_passengers")).rows).toHaveLength(0);
    await asUser(pia);
    await expect(db.query("SELECT token_hash FROM flight_passengers")).rejects.toThrow(/permission denied/);
    await expect(db.exec(`UPDATE flight_passengers SET status = 'confirmed'`)).rejects.toThrow(/permission denied/);
  });
});

describe("tandem requirements", () => {
  it("Biplace 3 counts practice flights since Biplace 1 only with the passenger's confirmation, sites and passengers", async () => {
    await asOwner();
    await db.exec(`DELETE FROM flights`);
    const names = ["Anna", "Beat", "anna ", "Carla"];
    for (let i = 0; i < 4; i++) {
      const f = await tandem({ takeoff: i + 1, landing: 6 - i });
      await db.query("SELECT set_flight_passenger($1, $2)", [f, names[i]]);
      if (i < 3) {
        const token = (await one<{ t: string }>("SELECT create_passenger_token($1) AS t", [f])).t;
        await asAnon(); await db.query("SELECT confirm_as_passenger($1)", [token]);
      }
    }
    await tandem({ date: "2000-01-01" });  // before Biplace 1
    const reqs = await status("biplace_3");
    const by = (rule: string) => reqs.find((r) => r.rule === rule)!;
    expect(by("tandem_flights")).toMatchObject({ value: 3, met: false });
    expect(by("tandem_distinct_takeoff_sites").value).toBe(3);
    expect(by("tandem_distinct_passengers").value).toBe(2);  // "Anna" and "anna " are one person
    expect(by("evidence_present")).toMatchObject({ value: 0, met: false });
  });

  it("Biplace 1 lists instruction and practice flights as separate lines", async () => {
    await tandem({ kind: "instruction" });
    const reqs = (await status("biplace_1")).filter((r) => r.rule === "tandem_flights");
    expect(reqs.map((r) => [r.params.label, r.value])).toEqual([["tandem_instruction", 1], ["tandem_practice", 5]]);
  });

  it("renewal needs the total of the last three years and a minimum in each of them", async () => {
    await asOwner();
    await db.exec(`DELETE FROM flights`);
    for (let i = 0; i < 12; i++) await tandem({ kind: "passenger", date: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10) });
    for (let i = 0; i < 12; i++) await tandem({ kind: "passenger", date: new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10) });
    let reqs = await status("biplace_3_renewal");
    expect(reqs.find((r) => r.rule === "tandem_flights")).toMatchObject({ value: 24, met: false });
    expect(reqs.find((r) => r.rule === "tandem_flights_per_year")).toMatchObject({ value: 0, met: false });
    for (let i = 0; i < 26; i++) await tandem({ kind: "passenger", date: new Date(Date.now() - 800 * 86400000).toISOString().slice(0, 10) });
    reqs = await status("biplace_3_renewal");
    expect(reqs.every((r) => r.met)).toBe(true);
  });
});
