// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0074: instructors confirm training flights (flightbook replacement, step 3).
let db: PGlite;
const anna = "00000000-0000-0000-0000-000000000001";   // student
const iris = "00000000-0000-0000-0000-000000000002";   // paragliding instructor, valid certificate
const hans = "00000000-0000-0000-0000-000000000003";   // instructor, certificate expired
const adele = "00000000-0000-0000-0000-000000000004";  // school admin only
const luca = "00000000-0000-0000-0000-000000000005";   // launch helper
const dora = "00000000-0000-0000-0000-000000000006";   // hang glider instructor
const otto = "00000000-0000-0000-0000-000000000007";   // instructor of another school
const school = "10000000-0000-0000-0000-000000000001";
const other = "10000000-0000-0000-0000-000000000002";
const club = "10000000-0000-0000-0000-000000000003";
const bergbo = "30000000-0000-0000-0000-000000000001";
const lehn = "30000000-0000-0000-0000-000000000002";

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
    CREATE FUNCTION is_group_admin(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM group_members WHERE user_id = u AND group_id = g AND role = 'admin') $$;
    CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT is_group_admin(u, g) OR EXISTS (SELECT 1 FROM group_member_functions WHERE user_id = u AND group_id = g AND function IN ('instructor','school_lead')) $$;
    CREATE TABLE locations(id uuid PRIMARY KEY, user_id uuid, name text, custom_name text, altitude integer, official_site_id uuid);
    CREATE TABLE pilot_gliders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, manufacturer text, model text, size text);
    CREATE TABLE flights(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, date date DEFAULT current_date,
      takeoff_location_id uuid REFERENCES locations(id) ON DELETE SET NULL, landing_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
      duration_minutes integer, glider text, comments text, is_solo_shv boolean NOT NULL DEFAULT false, group_id uuid,
      school_flight_id uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE igc_tracks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flight_id uuid NOT NULL REFERENCES flights(id) ON DELETE CASCADE, storage_path text NOT NULL);
    GRANT SELECT, INSERT, UPDATE, DELETE ON flights TO authenticated;
    GRANT SELECT ON locations, profiles, groups TO authenticated;
    ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own ON flights USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

    INSERT INTO groups VALUES ('${school}','Vertical','school'),('${other}','Andere Schule','school'),('${club}','Club','pilot_group');
    INSERT INTO group_members(group_id,user_id,role) VALUES ('${school}','${anna}','member'),('${school}','${iris}','member'),
      ('${school}','${hans}','member'),('${school}','${adele}','admin'),('${school}','${luca}','member'),('${school}','${dora}','member'),
      ('${other}','${otto}','member'),('${club}','${anna}','member');
    INSERT INTO group_member_functions VALUES ('${school}','${anna}','student'),('${school}','${iris}','instructor'),
      ('${school}','${hans}','instructor'),('${school}','${luca}','launch_helper'),('${school}','${dora}','instructor'),('${other}','${otto}','instructor');
    INSERT INTO instructor_certifications VALUES ('${school}','${iris}','instructor', current_date + 365),
      ('${school}','${hans}','instructor', current_date - 1),('${school}','${adele}','instructor', current_date + 365),
      ('${school}','${dora}','instructor_hg', current_date + 365),('${other}','${otto}','instructor', current_date + 365);
    INSERT INTO profiles VALUES ('${anna}','Anna'),('${iris}','Iris Instruktor'),('${dora}','Dora');
    INSERT INTO locations(id,user_id,name,altitude) VALUES ('${bergbo}','${anna}','SP Bergbo',1289),('${lehn}','${anna}','LP Lehn',565);
  `);
  await db.exec(migration("0073_flight_proof_data.sql"));
  await db.exec(migration("0074_flight_confirmations.sql"));
}, 60_000);
afterAll(async () => { await db?.close(); });

async function asUser(user: string) { await db.exec(`RESET ROLE; SET app.user_id='${user}'; SET ROLE authenticated;`); }
async function asOwner() { await db.exec(`RESET ROLE; RESET app.user_id;`); }
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
async function newFlight(extra = "") {
  await asUser(anna);
  const cols = extra ? `, ${extra.split("=")[0]}` : "";
  const vals = extra ? `, ${extra.split("=")[1]}` : "";
  return (await one<{ id: string }>(`INSERT INTO flights(user_id, takeoff_location_id, landing_location_id, duration_minutes${cols})
    VALUES ('${anna}','${bergbo}','${lehn}',10${vals}) RETURNING id`)).id;
}
const submit = async (ids: string[], group = school) =>
  (await one<{ r: { submitted: number; skipped: { id: string; reason: string }[] } }>(
    "SELECT submit_flights_for_confirmation($1::uuid[], $2) AS r", [ids, group])).r;
const confirm = async (ids: string[], group = school) =>
  (await one<{ r: { confirmed: number; skipped: { id: string; reason: string }[] } }>(
    "SELECT confirm_flights($1::uuid[], $2) AS r", [ids, group])).r;
const status = async (flight: string) => {
  await asOwner();
  return one<{ status: string; instructor_name: string | null; reason: string | null; confirmed_data: Record<string, unknown> | null; school_name: string }>(
    `SELECT status, instructor_name, reason, confirmed_data, school_name FROM flight_confirmations WHERE flight_id = '${flight}'`);
};

describe("submitting", () => {
  it("lets the student submit own flights to a school they belong to", async () => {
    const f = await newFlight();
    await asUser(anna);
    expect(await submit([f])).toEqual({ submitted: 1, skipped: [] });
    expect((await status(f)).status).toBe("submitted");
  });

  it("refuses schools the student is not in, and pilot groups", async () => {
    const f = await newFlight();
    await asUser(anna);
    await expect(submit([f], other)).rejects.toThrow(/Not a member/);
    await expect(submit([f], club)).rejects.toThrow(/Not a member/);
  });

  it("skips flights of others, cancelled and already submitted flights", async () => {
    const f = await newFlight();
    const cancelled = await newFlight(`cancelled_at,cancel_reason=now(),'Doppelt erfasst'`);
    await asUser(anna);
    await submit([f]);
    await asUser(iris);
    const foreign = (await one<{ id: string }>(`INSERT INTO flights(user_id) VALUES ('${iris}') RETURNING id`)).id;
    await asUser(anna);
    const r = await submit([f, cancelled, foreign]);
    expect(r.submitted).toBe(0);
    expect(r.skipped.map((s) => s.reason)).toEqual(["already_submitted", "cancelled", "not_own"]);
  });
});

describe("who may confirm", () => {
  it("confirms for a qualified instructor of the school and keeps the flight as confirmed", async () => {
    const f = await newFlight();
    await asUser(anna); await submit([f]);
    await asUser(iris);
    expect(await confirm([f])).toEqual({ confirmed: 1, skipped: [] });
    const c = await status(f);
    expect(c).toMatchObject({ status: "confirmed", instructor_name: "Iris Instruktor", school_name: "Vertical" });
    expect(c.confirmed_data).toMatchObject({ takeoff: { name: "SP Bergbo", altitude: 1289 }, durationMinutes: 10, discipline: "paraglider" });
  });

  it("refuses an expired certificate, admin rights alone, launch helpers and other schools", async () => {
    const f = await newFlight();
    await asUser(anna); await submit([f]);
    await asUser(hans);
    expect((await confirm([f])).skipped[0].reason).toBe("not_qualified");
    await asUser(adele); // admin with a certificate but no instructor function
    expect((await confirm([f])).skipped[0].reason).toBe("not_qualified");
    await asUser(luca);
    await expect(confirm([f])).rejects.toThrow(/staff access/);
    await asUser(otto);
    await expect(confirm([f])).rejects.toThrow(/staff access/);
    expect((await status(f)).status).toBe("submitted");
  });

  it("checks the discipline: a hang glider flight needs a hang glider instructor", async () => {
    const f = await newFlight(`discipline='hangglider'`);
    await asUser(anna); await submit([f]);
    await asUser(iris);
    expect((await confirm([f])).skipped[0].reason).toBe("not_qualified");
    await asUser(dora);
    expect((await confirm([f])).confirmed).toBe(1);
  });

  it("never lets instructors confirm their own flights", async () => {
    await asOwner();
    await db.exec(`INSERT INTO group_member_functions VALUES ('${school}','${iris}','student')`);
    await asUser(iris);
    const own = (await one<{ id: string }>(`INSERT INTO flights(user_id) VALUES ('${iris}') RETURNING id`)).id;
    await submit([own]);
    expect((await confirm([own])).skipped[0].reason).toBe("own_flight");
  });

  it("confirms several flights at once with one record and one event per flight, skipping the rest", async () => {
    const a = await newFlight(), b = await newFlight(), c = await newFlight();
    await asUser(anna); await submit([a, b]);
    await asUser(iris);
    const r = await confirm([a, b, c]);
    expect(r.confirmed).toBe(2);
    expect(r.skipped).toEqual([{ id: c, reason: "not_submitted" }]);
    await asOwner();
    const events = (await db.query<{ flight_id: string; action: string; actor_id: string }>(
      `SELECT flight_id, action, actor_id FROM flight_confirmation_events WHERE flight_id IN ('${a}','${b}') AND action = 'confirmed'`)).rows;
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.actor_id === iris)).toBe(true);
  });
});

describe("returning, revoking, withdrawing", () => {
  it("returns a flight with a reason; the student corrects and submits again", async () => {
    const f = await newFlight();
    await asUser(anna); await submit([f]);
    await asUser(iris);
    await expect(db.query("SELECT return_flight_for_correction($1, $2)", [f, " "])).rejects.toThrow(/reason/);
    await db.query("SELECT return_flight_for_correction($1, $2)", [f, "Landeplatz fehlt"]);
    expect(await status(f)).toMatchObject({ status: "returned", reason: "Landeplatz fehlt" });
    await asUser(anna);
    expect((await submit([f])).submitted).toBe(1);
    expect((await status(f)).reason).toBeNull();
  });

  it("revokes only with a reason and the qualification, keeping the history", async () => {
    const f = await newFlight();
    await asUser(anna); await submit([f]);
    await asUser(iris); await confirm([f]);
    await asUser(hans);
    await expect(db.query("SELECT revoke_flight_confirmation($1, $2)", [f, "Irrtum"])).rejects.toThrow(/Qualified/);
    await asUser(iris);
    await db.query("SELECT revoke_flight_confirmation($1, $2)", [f, "Falscher Schüler"]);
    expect(await status(f)).toMatchObject({ status: "revoked", reason: "Falscher Schüler" });
    await asOwner();
    const actions = (await db.query<{ action: string }>(`SELECT action FROM flight_confirmation_events WHERE flight_id = '${f}' ORDER BY id`)).rows;
    expect(actions.map((a) => a.action)).toEqual(["submitted", "confirmed", "revoked"]);
  });

  it("lets the student withdraw an open submission but not a confirmation", async () => {
    const f = await newFlight(), g = await newFlight();
    await asUser(anna); await submit([f, g]);
    await db.query("SELECT withdraw_flight_submission($1)", [f]);
    expect((await status(f)).status).toBe("withdrawn");
    await asUser(iris); await confirm([g]);
    await asUser(anna);
    await expect(db.query("SELECT withdraw_flight_submission($1)", [g])).rejects.toThrow(/open submissions/);
  });
});

describe("after the confirmation", () => {
  it("keeps the confirmation when the flight changes; the change is logged and flagged for the school", async () => {
    const f = await newFlight();
    await asUser(anna); await submit([f]);
    await asUser(iris); await confirm([f]);
    await asOwner();
    await db.exec(`UPDATE flight_confirmations SET decided_at = now() - interval '1 minute' WHERE flight_id = '${f}'`);
    await asUser(anna);
    await db.exec(`UPDATE flights SET duration_minutes = 12 WHERE id = '${f}'`);
    expect((await status(f)).status).toBe("confirmed");
    await asUser(iris);
    const list = (await one<{ r: { flightId: string; changedAfterConfirmation: boolean }[] }>(
      "SELECT school_flight_confirmations($1, 'confirmed') AS r", [school])).r;
    expect(list.find((x) => x.flightId === f)?.changedAfterConfirmation).toBe(true);
    const changes = (await db.query(`SELECT field FROM flight_changes WHERE flight_id = '${f}'`)).rows;
    expect(changes).toEqual([{ field: "duration_minutes" }]);
  });

  it("cannot delete a confirmed flight but can cancel it with a reason; an open one can still be deleted", async () => {
    const f = await newFlight(), open = await newFlight();
    await asUser(anna); await submit([f, open]);
    await asUser(iris); await confirm([f]);
    await asUser(anna);
    await expect(db.exec(`DELETE FROM flights WHERE id = '${f}'`)).rejects.toThrow(/cancel them instead/);
    await expect(db.exec(`UPDATE flights SET cancelled_at = now() WHERE id = '${f}'`)).rejects.toThrow(/cancel_reason/);
    await db.exec(`UPDATE flights SET cancelled_at = now(), cancel_reason = 'Flug doppelt erfasst' WHERE id = '${f}'`);
    const logged = await one<{ new_value: { reason: string } }>(`SELECT new_value FROM flight_changes WHERE flight_id = '${f}' AND field = 'cancelled'`);
    expect(logged.new_value.reason).toBe("Flug doppelt erfasst");
    await db.exec(`DELETE FROM flights WHERE id = '${open}'`);
  });

  it("lets account deletion (no session) remove confirmed flights", async () => {
    const f = await newFlight();
    await asUser(anna); await submit([f]);
    await asUser(iris); await confirm([f]);
    await asOwner();
    await db.exec(`DELETE FROM flights WHERE id = '${f}'`);
    expect((await db.query(`SELECT 1 FROM flight_confirmations WHERE flight_id = '${f}'`)).rows).toHaveLength(0);
  });

  it("keeps school and instructor names when the school is deleted", async () => {
    await asOwner();
    await db.exec(`INSERT INTO groups VALUES ('10000000-0000-0000-0000-000000000009','Schule die schliesst','school');
      INSERT INTO group_members(group_id,user_id) VALUES ('10000000-0000-0000-0000-000000000009','${anna}'),('10000000-0000-0000-0000-000000000009','${iris}');
      INSERT INTO group_member_functions VALUES ('10000000-0000-0000-0000-000000000009','${iris}','instructor');
      INSERT INTO instructor_certifications VALUES ('10000000-0000-0000-0000-000000000009','${iris}','instructor', current_date + 30);`);
    const f = await newFlight();
    await asUser(anna); await submit([f], "10000000-0000-0000-0000-000000000009");
    await asUser(iris); await confirm([f], "10000000-0000-0000-0000-000000000009");
    await asOwner();
    await db.exec(`ALTER TABLE flight_confirmations DROP CONSTRAINT IF EXISTS flight_confirmations_group_id_fkey;
      UPDATE flight_confirmations SET group_id = NULL WHERE group_id = '10000000-0000-0000-0000-000000000009';`);
    await asUser(anna);
    const c = await one<{ status: string; school_name: string; instructor_name: string }>(
      `SELECT status, school_name, instructor_name FROM flight_confirmations WHERE flight_id = '${f}'`);
    expect(c).toEqual({ status: "confirmed", school_name: "Schule die schliesst", instructor_name: "Iris Instruktor" });
  });
});

describe("visibility", () => {
  it("shows confirmations to the student and the school staff only; nobody writes them directly", async () => {
    await asUser(anna);
    expect((await db.query("SELECT 1 FROM flight_confirmations")).rows.length).toBeGreaterThan(0);
    await asUser(iris);
    expect((await db.query(`SELECT 1 FROM flight_confirmations WHERE group_id = '${school}'`)).rows.length).toBeGreaterThan(0);
    await asUser(otto);
    expect((await db.query("SELECT 1 FROM flight_confirmations")).rows).toHaveLength(0);
    await asUser(anna);
    await expect(db.exec(`UPDATE flight_confirmations SET status = 'confirmed'`)).rejects.toThrow(/permission denied/);
    await expect(db.exec(`INSERT INTO flight_confirmation_events(flight_id, student_id, action) SELECT id, user_id, 'confirmed' FROM flights LIMIT 1`)).rejects.toThrow(/permission denied/);
  });

  it("lists the school's open flights only for staff, with the caller's right to confirm each", async () => {
    const hg = await newFlight(`discipline='hangglider'`);
    await asUser(anna); await submit([hg]);
    await asUser(iris);
    const list = (await one<{ r: { flightId: string; canConfirm: boolean; studentName: string }[] }>(
      "SELECT school_flight_confirmations($1) AS r", [school])).r;
    const row = list.find((x) => x.flightId === hg)!;
    expect(row).toMatchObject({ canConfirm: false, studentName: "Anna" });
    await asUser(anna);
    await expect(db.query("SELECT school_flight_confirmations($1)", [school])).rejects.toThrow(/staff access/);
  });
});
