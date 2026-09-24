// Applies pending database migrations to the Supabase project via the Management API
// (replaces the former Lovable rollout). Usage:
//   node scripts/db-migrate.mjs            -> list pending migrations (dry run)
//   node scripts/db-migrate.mjs --apply    -> apply them, one transaction per migration
// Credentials: SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from the environment or from
// docs/.env.deploy.local (git-ignored). Order: legacy supabase/migrations (by file name), then
// drizzle/migrations in _journal.json order. Applied files are recorded in
// supabase_migrations.schema_migrations (legacy) and drizzle.__drizzle_migrations (drizzle),
// so re-running only applies what is new.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const fileEnv = existsSync("docs/.env.deploy.local")
  ? Object.fromEntries(readFileSync("docs/.env.deploy.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }))
  : {};
const token = process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || fileEnv.SUPABASE_PROJECT_REF;
if (!token || !ref) throw new Error("SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF missing");
const apply = process.argv.includes("--apply");

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 1500)}`);
  return JSON.parse(text);
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const normalize = (s) => s.replace(/\r\n/g, "\n");

await sql(`CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);`);
const doneLegacy = new Set((await sql("select version from supabase_migrations.schema_migrations")).map((r) => r.version));
const doneDrizzle = new Set((await sql("select hash from drizzle.__drizzle_migrations")).map((r) => r.hash));

// Legacy files that only seeded demo data of the old Lovable project (fake students with a
// known password, events of a group id that exists only there). Recorded as applied, never run.
const SKIP_SEED_DATA = new Set(["20260327072955"]);

const legacy = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort().map((file) => {
  const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
  const skipped = SKIP_SEED_DATA.has(version);
  const body = skipped ? "-- skipped: demo seed data of the old Lovable project"
    : normalize(readFileSync(`supabase/migrations/${file}`, "utf8"));
  return { label: `supabase/${file}${skipped ? " (Testdaten, übersprungen)" : ""}`, done: doneLegacy.has(version), body,
    record: `INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES (${lit(version)}, ${lit(rest.join("_"))}, ARRAY[${lit(body)}]);` };
});
// Drizzle files whose content an earlier legacy file already created: 0002 and
// supabase/20260921113000_flight_school_phase1.sql build the same five phase-1 tables and
// triggers, and 0004 unifies their policies whichever ran. Running both would duplicate triggers.
const SKIP_SUPERSEDED = new Set(["0002_school_phase1_shv_compliance"]);

const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
const drizzle = journal.entries.map((e) => {
  const source = normalize(readFileSync(`drizzle/migrations/${e.tag}.sql`, "utf8"));
  const hash = createHash("sha256").update(source).digest("hex");
  const skipped = SKIP_SUPERSEDED.has(e.tag);
  const body = skipped ? "-- skipped: superseded by supabase/20260921113000_flight_school_phase1.sql + 0004" : source;
  return { label: `drizzle/${e.tag}${skipped ? " (durch Altmigration abgedeckt, übersprungen)" : ""}`, done: doneDrizzle.has(hash), body,
    record: `INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES (${lit(hash)}, ${e.when});` };
});

const pending = [...legacy, ...drizzle].filter((m) => !m.done);
console.log(`${legacy.length + drizzle.length} migrations, ${pending.length} pending${apply ? "" : " (dry run, use --apply)"}`);
for (const m of pending) {
  if (!apply) { console.log("  pending", m.label); continue; }
  process.stdout.write(`  applying ${m.label} … `);
  try {
    await sql(`BEGIN;\n${m.body}\n;\n${m.record}\nCOMMIT;`);
    console.log("ok");
  } catch (e) {
    console.log("FAILED");
    console.error(e.message);
    process.exit(1);
  }
}
if (apply && pending.length) await sql("NOTIFY pgrst, 'reload schema';");
