// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("applies the coaching migration and enforces staff access and valid flight slots", async () => {
  const db = new PGlite();
  const teacher = "00000000-0000-0000-0000-000000000001";
  const outsider = "00000000-0000-0000-0000-000000000002";
  const school = "10000000-0000-0000-0000-000000000001";
  const event = "20000000-0000-0000-0000-000000000001";
  try {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT current_setting('app.user_id')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE FUNCTION is_group_staff(u uuid, g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u='${teacher}'::uuid AND g='${school}'::uuid $$;
      CREATE TABLE flight_events(id uuid PRIMARY KEY, group_id uuid);
      CREATE TABLE student_day_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, flight_number integer CONSTRAINT flight_number_range CHECK(flight_number BETWEEN 1 AND 6));
      CREATE TABLE student_status_history(id uuid DEFAULT gen_random_uuid(), group_id uuid, student_id uuid, status text, changed_at timestamptz);
      ALTER TABLE student_day_notes ENABLE ROW LEVEL SECURITY;
      ALTER TABLE student_status_history ENABLE ROW LEVEL SECURITY;
      CREATE POLICY status_read ON student_status_history FOR SELECT TO authenticated USING(is_group_staff(auth.uid(),group_id));
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      INSERT INTO flight_events VALUES ('${event}', '${school}');
      INSERT INTO student_status_history(group_id,student_id,status,changed_at) VALUES
        ('${school}','${outsider}','active',now()-interval '1 day'),
        ('${school}','${outsider}','paused',now());
    `);
    await db.exec(readFileSync(new URL("../../drizzle/migrations/0016_role_journeys.sql", import.meta.url), "utf8"));
    await db.exec(`SET app.user_id='${teacher}'; SET ROLE authenticated;`);
    const result = await db.query<{ ids: string[] }>(`SELECT inactive_school_students('${school}') AS ids`);
    expect(result.rows[0].ids).toEqual([outsider]);
    await db.exec(`INSERT INTO student_day_notes(event_id,flight_number) VALUES ('${event}',-1),('${event}',NULL),('${event}',6);`);
    await expect(db.exec(`INSERT INTO student_day_notes(event_id,flight_number) VALUES ('${event}',7);`)).rejects.toThrow();
    await db.exec(`SET app.user_id='${outsider}';`);
    await expect(db.query(`SELECT inactive_school_students('${school}')`)).rejects.toThrow("School staff access required");
    await expect(db.exec(`INSERT INTO student_day_notes(event_id,flight_number) VALUES ('${event}',1);`)).rejects.toThrow();
    expect((await db.query("SELECT * FROM student_day_notes")).rows).toHaveLength(0);
  } finally {
    await db.close();
  }
}, 60_000);
