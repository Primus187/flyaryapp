import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Prepare the reviewed 0003–0015 rollout for the existing database at 0002.
// This script only emits SQL; it does not connect to a database.
const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
const entries = journal.entries.filter((entry) => entry.idx >= 3 && entry.idx <= 15);
const migrations = entries.map((entry) => {
  const sql = readFileSync(`drizzle/migrations/${entry.tag}.sql`, "utf8").replace(/\r\n/g, "\n");
  return { ...entry, sql, hash: createHash("sha256").update(sql).digest("hex") };
});
const sql = `BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  IF (SELECT max(created_at) FROM drizzle.__drizzle_migrations) IS DISTINCT FROM 1789977438502::bigint THEN
    RAISE EXCEPTION 'Unexpected migration baseline; inspect before retrying';
  END IF;
END $$;
${migrations.map((m) => `${m.sql}\nINSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('${m.hash}',${m.when});`).join("\n")}
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT count(*) AS applied_migrations, max(created_at) AS latest_migration FROM drizzle.__drizzle_migrations;`;
console.log(JSON.stringify({ migrations: migrations.map(({ sql, ...meta }) => meta), sql }));
