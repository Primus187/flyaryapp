// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { DossierData, DossierSection } from "../lib/student-dossier";

let db: PGlite;
const teacher = "00000000-0000-0000-0000-000000000001";
const student = "00000000-0000-0000-0000-000000000002";
const helper = "00000000-0000-0000-0000-000000000003";
const school = "10000000-0000-0000-0000-000000000001";
const other = "10000000-0000-0000-0000-000000000002";
const event = "20000000-0000-0000-0000-000000000001";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    CREATE TABLE groups(id uuid PRIMARY KEY, group_type text);
    CREATE TABLE group_members(group_id uuid, user_id uuid, role text);
    CREATE FUNCTION is_group_staff(u uuid,g uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT u='${teacher}'::uuid AND g='${school}'::uuid $$;
    CREATE TABLE profiles(user_id uuid PRIMARY KEY, pilot_name text, training_level text, shv_number text, exam_theory_date date, exam_practical_date date, glider_info text, medical_notes text);
    CREATE TABLE locations(id uuid PRIMARY KEY,name text);
    CREATE TABLE flights(id uuid PRIMARY KEY, user_id uuid, group_id uuid, date date, glider text, duration_minutes integer, altitude_gain integer, comments text, takeoff_location_id uuid, landing_location_id uuid);
    CREATE TABLE flight_coach_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flight_id uuid, coach_id uuid, note text, visible_to_student boolean, updated_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now());
    CREATE TABLE training_categories(id uuid PRIMARY KEY,name text,sort_order integer,training_level text);
    CREATE TABLE training_items(id uuid PRIMARY KEY,category_id uuid,name text,sort_order integer,is_exam_maneuver boolean);
    CREATE TABLE training_progress(user_id uuid,item_id uuid,rating integer,notes text,updated_at timestamptz);
    CREATE TABLE student_status_history(id uuid DEFAULT gen_random_uuid(),group_id uuid,student_id uuid,status text,reason text,changed_at timestamptz);
    CREATE TABLE flight_events(id uuid PRIMARY KEY,group_id uuid,title text,event_date timestamptz,status text);
    CREATE TABLE student_day_notes(id uuid DEFAULT gen_random_uuid(),event_id uuid,student_user_id uuid,instructor_id uuid,note text,flight_number integer,visible_to_student boolean,is_next_step boolean);
    CREATE TABLE event_signups(event_id uuid,user_id uuid,signed_up boolean,status text);
    CREATE TABLE school_equipment(id uuid PRIMARY KEY,group_id uuid,name text,equipment_type text,inventory_number text,size text,next_check_date date);
    CREATE TABLE equipment_assignments(id uuid DEFAULT gen_random_uuid(),group_id uuid,user_id uuid,equipment_id uuid,assigned_on date,due_on date,returned_on date,note text);
    CREATE TABLE pilot_gliders(id uuid DEFAULT gen_random_uuid(),user_id uuid,manufacturer text,model text,size text,is_default boolean,last_check_date date,next_check_date date,reserve_repack_date date);
    CREATE TABLE billing_items(id uuid DEFAULT gen_random_uuid(),group_id uuid,user_id uuid,description text,item_type text,quantity numeric,unit_amount numeric,amount numeric,billing_date date,paid_at timestamptz,note text);
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    REVOKE SELECT ON profiles FROM authenticated;
    GRANT SELECT(user_id,pilot_name,training_level,glider_info) ON profiles TO authenticated;
    ALTER TABLE training_progress ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_progress ON training_progress FOR SELECT TO authenticated USING(user_id=auth.uid());
    ALTER TABLE flight_coach_notes ENABLE ROW LEVEL SECURITY;
    INSERT INTO groups VALUES ('${school}','school'),('${other}','school');
    INSERT INTO group_members VALUES ('${school}','${student}','member'),('${school}','${helper}','member'),('${school}','${teacher}','member');
    INSERT INTO profiles VALUES ('${student}','Alex','altitude','123','2026-01-01',NULL,'My wing','PRIVATE MEDICAL'),('${teacher}','Instructor','licensed',NULL,NULL,NULL,NULL,NULL);
    INSERT INTO flights(id,user_id,group_id,date,glider) SELECT md5(i::text)::uuid,'${student}','${school}','2026-09-01','Wing' FROM generate_series(1,35) i;
    INSERT INTO flights(id,user_id,group_id,date,glider) VALUES (md5('private')::uuid,'${student}',NULL,'2026-09-02','Private'),(md5('other')::uuid,'${student}','${other}','2026-09-03','Other school');
    INSERT INTO flight_coach_notes(flight_id,coach_id,note,visible_to_student) SELECT id,'${teacher}','Coaching',false FROM flights;
    INSERT INTO training_categories VALUES (md5('category')::uuid,'Landing',1,'brevetkurs');
    INSERT INTO training_items VALUES (md5('item')::uuid,md5('category')::uuid,'Approach',1,true);
    INSERT INTO training_progress VALUES ('${student}',md5('item')::uuid,3,'Good',now());
    INSERT INTO student_status_history(group_id,student_id,status,reason,changed_at) VALUES ('${school}','${student}','active',NULL,now()-interval '2 days'),('${school}','${student}','paused','Pause reason',now()),('${other}','${student}','cancelled','OTHER SECRET',now());
    INSERT INTO flight_events VALUES ('${event}','${school}','School day',now()+interval '1 day','confirmed'),(md5('other event')::uuid,'${other}','Other day',now(),'confirmed');
    INSERT INTO student_day_notes(event_id,student_user_id,instructor_id,note,flight_number,visible_to_student,is_next_step) VALUES ('${event}','${student}','${teacher}','Next task',NULL,false,true),(md5('other event')::uuid,'${student}','${teacher}','OTHER SECRET',NULL,false,true);
    INSERT INTO event_signups VALUES ('${event}','${student}',true,'waitlist');
    INSERT INTO school_equipment VALUES (md5('gear')::uuid,'${school}','School wing','glider','G1','M','2027-01-01');
    INSERT INTO equipment_assignments(group_id,user_id,equipment_id,assigned_on) VALUES ('${school}','${student}',md5('gear')::uuid,'2026-09-01');
    INSERT INTO pilot_gliders(user_id,manufacturer,model,is_default) VALUES ('${student}','Own','Wing',true);
    INSERT INTO billing_items(group_id,user_id,description,amount,billing_date,paid_at) VALUES ('${school}','${student}','Open',50,'2026-09-01',NULL),('${school}','${student}','Paid',20,'2026-09-02',now()),('${other}','${student}','OTHER SECRET',999,'2026-09-02',NULL);
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0017_student_dossier.sql", import.meta.url), "utf8"));
}, 60_000);
afterAll(async () => { await db?.close(); });
async function asUser(user = teacher) { await db.exec(`RESET ROLE; SET app.user_id='${user}'; SET ROLE authenticated;`); }
async function dossier<S extends DossierSection>(section: S, offset = 0): Promise<DossierData[S]> {
  return (await db.query<{ data: DossierData[S] }>("SELECT school_student_dossier($1,$2,$3,$4) AS data", [school,student,section,offset])).rows[0].data;
}
it("returns only school-relevant profile fields and the latest school status", async () => {
  await asUser();
  const data = await dossier("overview");
  expect(data.name).toBe("Alex");
  expect(data.status.status).toBe("paused");
  expect(data.flightCount).toBe(35);
  expect(data.examDone).toBe(1);
  expect(data.nextStep?.note).toBe("Next task");
  expect(data.upcoming[0].status).toBe("waitlist");
  expect(data.theoryDate).toBe("2026-01-01");
  expect(JSON.stringify(data)).not.toContain("PRIVATE MEDICAL");
  expect(JSON.stringify(data)).not.toContain("OTHER SECRET");
});
it("paginates all school flights without duplicates or private/other-school flights", async () => {
  await asUser();
  const first = await dossier("flights");
  const second = await dossier("flights",30);
  expect(first.total).toBe(35);
  expect(first.rows).toHaveLength(30);
  expect(second.rows).toHaveLength(5);
  expect(new Set([...first.rows,...second.rows].map(row => row.id)).size).toBe(35);
  expect(first.rows.every(row => row.notes[0].note === "Coaching")).toBe(true);
});
it("loads training, day notes, loans, own equipment and scoped billing", async () => {
  await asUser();
  expect((await dossier("training")).rows[0].rating).toBe(3);
  const notes = await dossier("notes");
  expect(notes.rows).toHaveLength(1);
  expect(notes.rows[0].visible).toBe(false);
  expect((await dossier("equipment")).loans[0].name).toBe("School wing");
  expect((await dossier("equipment")).own[0].manufacturer).toBe("Own");
  const billing = await dossier("billing");
  expect(billing.open).toBe(50);
  expect(billing.paid).toBe(20);
  expect(billing.total).toBe(2);
});
it("rejects helpers, students, anonymous users and foreign-school dossier URLs", async () => {
  for (const user of [helper,student,""]) {
    await asUser(user);
    await expect(dossier("overview")).rejects.toThrow("School student access required");
    await expect(db.query("SELECT school_student_training_profile($1,$2)",[school,student])).rejects.toThrow("School student access required");
    expect((await db.query("SELECT * FROM flight_coach_notes")).rows).toHaveLength(0);
  }
  await asUser();
  await expect(db.query("SELECT school_student_dossier($1,$2)",[other,student])).rejects.toThrow("School student access required");
  await expect(db.query("SELECT school_student_dossier($1,$2)",[school,other])).rejects.toThrow("School student access required");
  await expect(dossier("flights",-1)).rejects.toThrow("Invalid offset");
  await expect(db.query("SELECT school_student_dossier($1,$2,'invalid')",[school,student])).rejects.toThrow("Unknown dossier section");
});
