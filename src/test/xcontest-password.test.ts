// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decryptPassword, encryptPassword, isEncryptedPassword } from "../../supabase/functions/_shared/xcontest-crypto";

const secret = "test-secret";
const user = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";

describe("XContest password encryption", () => {
  it("round-trips and does not contain the plaintext", async () => {
    const stored = await encryptPassword("Gleitschirm-Pässwort!", user, secret);
    expect(isEncryptedPassword(stored)).toBe(true);
    expect(stored).not.toContain(btoa("Gleitschirm"));
    expect(await decryptPassword(stored, user, secret)).toBe("Gleitschirm-Pässwort!");
  });

  it("uses a fresh IV per value", async () => {
    expect(await encryptPassword("same", user, secret)).not.toBe(await encryptPassword("same", user, secret));
  });

  it("rejects another user id or key", async () => {
    const stored = await encryptPassword("secret", user, secret);
    await expect(decryptPassword(stored, other, secret)).rejects.toThrow();
    await expect(decryptPassword(stored, user, "other-key")).rejects.toThrow();
  });

  it("reads legacy Base64 values from the former client", async () => {
    expect(isEncryptedPassword(btoa("old-pass"))).toBe(false);
    expect(await decryptPassword(btoa("old-pass"), user, secret)).toBe("old-pass");
  });

  it("requires the server key", async () => {
    await expect(encryptPassword("x", user, "")).rejects.toThrow("XCONTEST_ENCRYPTION_KEY");
  });
});

it("migration 0072 blocks client writes of the password and hides it from the owner RPC", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
      CREATE TABLE profiles(user_id uuid PRIMARY KEY, pilot_name text, blood_type text, medical_notes text, allergies text,
        emergency_contact_name text, emergency_contact_phone text, xcontest_username text, xcontest_password_encrypted text,
        shv_number text, health_data_consent_at timestamptz, exam_theory_date date, exam_practical_date date);
      GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated, anon, service_role;
      INSERT INTO profiles(user_id, xcontest_username, xcontest_password_encrypted) VALUES ('${user}', 'alex', 'djE6legacy');
      INSERT INTO profiles(user_id) VALUES ('${other}');
    `);
    await db.exec(readFileSync(new URL("../../drizzle/migrations/0072_xcontest_password_protection.sql", import.meta.url), "utf8"));

    await db.exec(`SET app.user_id='${user}'; SET ROLE authenticated;`);
    const own = await db.query<Record<string, unknown>>("SELECT * FROM get_own_profile_private()");
    expect(own.rows[0]).toMatchObject({ xcontest_username: "alex", has_xcontest_password: true });
    expect(own.rows[0]).not.toHaveProperty("xcontest_password_encrypted");

    await expect(db.exec(`UPDATE profiles SET xcontest_password_encrypted = 'YWJj' WHERE user_id = '${user}'`)).rejects.toThrow("app server");
    await expect(db.exec(`INSERT INTO profiles(user_id, xcontest_password_encrypted) VALUES (gen_random_uuid(), 'YWJj')`)).rejects.toThrow("app server");
    // Other fields stay editable; clearing the password is allowed.
    await db.exec(`UPDATE profiles SET pilot_name = 'Alex', xcontest_username = 'alex2' WHERE user_id = '${user}'`);
    await db.exec(`UPDATE profiles SET xcontest_password_encrypted = NULL WHERE user_id = '${user}'`);

    await db.exec(`RESET ROLE; SET ROLE anon;`);
    await expect(db.query("SELECT * FROM get_own_profile_private()")).rejects.toThrow();

    await db.exec(`RESET ROLE; SET app.user_id=''; SET ROLE service_role;`);
    await db.exec(`UPDATE profiles SET xcontest_password_encrypted = 'v1:abc' WHERE user_id = '${other}'`);
    await db.exec("RESET ROLE;");
    const rows = await db.query<{ p: string | null }>("SELECT xcontest_password_encrypted AS p FROM profiles ORDER BY user_id");
    expect(rows.rows.map((r) => r.p)).toEqual([null, "v1:abc"]);
  } finally {
    await db.close();
  }
}, 60_000);
