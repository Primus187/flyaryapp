// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0069: students cannot set their own signup status; the waiting list still works.
let db: PGlite;
const instructor = "00000000-0000-0000-0000-000000000001";
const anna = "00000000-0000-0000-0000-000000000003";
const beat = "00000000-0000-0000-0000-000000000004";
const cora = "00000000-0000-0000-0000-000000000005";
const event = "20000000-0000-0000-0000-000000000001";

const read = (name: string) => readFileSync(new URL(`../../drizzle/migrations/${name}`, import.meta.url), "utf8");
// handle_signup_waitlist as live (defined in 0018, unchanged since).
const waitlistFunction = () => read("0018_prelaunch_audit_fixes.sql").match(/CREATE OR REPLACE FUNCTION public\.handle_signup_waitlist\(\)[\s\S]*?\$\$;/)![0];
const as = async <T>(user: string, fn: () => Promise<T>) => {
  await db.exec(`SET app.user_id='${user}'; SET ROLE authenticated;`);
  try { return await fn(); } finally { await db.exec("RESET ROLE;"); }
};
const signup = async (user: string) => (await db.query<{ status: string; waitlist_position: number | null; confirmed_by_school: boolean }>(
  "SELECT status, waitlist_position, confirmed_by_school FROM event_signups WHERE event_id=$1 AND user_id=$2", [event, user])).rows[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE flight_events(id uuid PRIMARY KEY, title text, max_participants integer, signup_deadline timestamptz);
    CREATE TABLE event_signups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, user_id uuid, signed_up boolean,
      status text DEFAULT 'confirmed', waitlist_position integer, confirmed_by_school boolean NOT NULL DEFAULT false,
      presence text NOT NULL DEFAULT 'expected', checked_in_at timestamptz, updated_at timestamptz DEFAULT now(), UNIQUE(event_id, user_id));
    ALTER TABLE event_signups ENABLE ROW LEVEL SECURITY;
    CREATE POLICY sel ON event_signups FOR SELECT USING (true);
    CREATE POLICY ins ON event_signups FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY upd ON event_signups FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = '${instructor}');
    GRANT SELECT, INSERT, UPDATE ON event_signups TO authenticated;
    GRANT SELECT ON flight_events TO authenticated;
    CREATE FUNCTION flight_day_role(u uuid, e uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT CASE WHEN u = '${instructor}' THEN 'instructor' END $$;
    CREATE FUNCTION send_push_notification(u uuid, t text, b text, url text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
    INSERT INTO flight_events VALUES ('${event}', 'Höhenflug', 1, NULL);
  `);
  await db.exec(waitlistFunction());
  await db.exec(`CREATE TRIGGER trg_signup_waitlist BEFORE INSERT OR UPDATE ON event_signups FOR EACH ROW EXECUTE FUNCTION handle_signup_waitlist();`);
  await db.exec(read("0069_signup_status_protection.sql"));
  await db.exec(`CREATE TRIGGER trg_signup_school_fields BEFORE INSERT OR UPDATE ON event_signups FOR EACH ROW EXECUTE FUNCTION protect_signup_school_fields();`);
}, 60_000);
afterAll(async () => { await db?.close(); });

describe("signup status", () => {
  it("puts the second student on the waiting list, even if she claims a place", async () => {
    await as(anna, () => db.query("INSERT INTO event_signups (event_id, user_id, signed_up) VALUES ($1,$2,true)", [event, anna]));
    await as(beat, () => db.query("INSERT INTO event_signups (event_id, user_id, signed_up, status) VALUES ($1,$2,true,'confirmed')", [event, beat]));
    expect(await signup(anna)).toMatchObject({ status: "confirmed" });
    expect(await signup(beat)).toMatchObject({ status: "waitlist", waitlist_position: 1 });
  });

  it("does not let a student move herself off the waiting list", async () => {
    await as(beat, () => db.query("UPDATE event_signups SET status='confirmed', waitlist_position=NULL, confirmed_by_school=true WHERE user_id=$1", [beat]));
    expect(await signup(beat)).toMatchObject({ status: "waitlist", waitlist_position: 1, confirmed_by_school: false });
  });

  it("still moves the next one up when a confirmed student signs off", async () => {
    await as(anna, () => db.query("UPDATE event_signups SET signed_up=false WHERE user_id=$1", [anna]));
    expect(await signup(anna)).toMatchObject({ status: "declined" });
    expect(await signup(beat)).toMatchObject({ status: "confirmed", waitlist_position: null });
  });

  it("lets the instructor change a signup's status", async () => {
    await as(cora, () => db.query("INSERT INTO event_signups (event_id, user_id, signed_up) VALUES ($1,$2,true)", [event, cora]));
    expect(await signup(cora)).toMatchObject({ status: "waitlist" });
    await as(instructor, () => db.query("UPDATE event_signups SET status='confirmed', waitlist_position=NULL WHERE user_id=$1", [cora]));
    expect(await signup(cora)).toMatchObject({ status: "confirmed" });
  });

  it("records a signup without a place as declined", async () => {
    await db.exec(`DELETE FROM event_signups WHERE user_id='${anna}'`);
    await as(anna, () => db.query("INSERT INTO event_signups (event_id, user_id, signed_up, status) VALUES ($1,$2,false,'confirmed')", [event, anna]));
    expect(await signup(anna)).toMatchObject({ status: "declined" });
  });
});
