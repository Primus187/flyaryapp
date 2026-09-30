// Checks a restore drill: compares a restored project with the backup it came from (read-only).
//   node scripts/restore-verify.mjs <snapshot folder> --ref <restored project ref>
// Compares the row count of every table in the backup manifest and every storage file (present, same
// size, same eTag, i.e. same content). Prints the differences and exits with code 1 if there are any.
// Drill (Flightbook replacement step 6), with an empty second project as target:
//   $env:SUPABASE_PROJECT_REF='<target>'; node scripts/db-migrate.mjs --apply; Remove-Item Env:SUPABASE_PROJECT_REF
//   node scripts/db-restore.mjs <snapshot> --ref <target> --yes
//   node scripts/restore-verify.mjs <snapshot> --ref <target>
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { compareRestore, qualifiedIdent } from "../src/lib/backup-sql.ts";

const args = process.argv.slice(2);
const snapshot = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--ref");
const ref = args.includes("--ref") ? args[args.indexOf("--ref") + 1] : null;
if (!snapshot || !ref) throw new Error("usage: node scripts/restore-verify.mjs <snapshot folder> --ref <restored project ref>");
const manifest = JSON.parse(readFileSync(join(resolve(snapshot), "manifest.json"), "utf8"));

const fileEnv = existsSync("docs/.env.deploy.local")
  ? Object.fromEntries(readFileSync("docs/.env.deploy.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }))
  : {};
const token = process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN missing");
if (ref === (process.env.SUPABASE_PROJECT_REF || fileEnv.SUPABASE_PROJECT_REF)) console.warn("Note: checking the live project itself.");

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

const existing = new Set((await sql(`select table_schema || '.' || table_name as t from information_schema.tables where table_schema in ('public', 'auth')`)).map((r) => r.t));
const tables = Object.keys(manifest.row_counts).filter((t) => existing.has(t));
const rowCounts = {};
for (let i = 0; i < tables.length; i += 40) {
  const chunk = tables.slice(i, i + 40);
  const [row] = await sql(`select ${chunk.map((t, j) => `(select count(*) from ${qualifiedIdent(t)})::int as c${j}`).join(", ")}`);
  chunk.forEach((t, j) => { rowCounts[t] = row[`c${j}`]; });
}
const files = (await sql(`select bucket_id as bucket, name, (metadata->>'size')::bigint as size, metadata->>'eTag' as etag from storage.objects where metadata is not null`))
  .map((f) => ({ ...f, size: Number(f.size) }));

const problems = compareRestore(manifest, { rowCounts, files });
const rows = Object.values(manifest.row_counts).reduce((a, b) => a + b, 0);
console.log(`Backup ${manifest.created_at}: ${Object.keys(manifest.row_counts).length} tables, ${rows} rows, ${manifest.files.length} files.`);
console.log(`Restored project ${ref}: ${tables.length} tables found, ${files.length} files.`);
if (problems.length) {
  console.log(`\n${problems.length} difference(s):`);
  for (const p of problems.slice(0, 200)) console.log(`  - ${p}`);
  process.exitCode = 1;
} else {
  console.log("\nRestore complete: every row count and every file matches the backup.");
}
