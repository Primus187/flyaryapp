// Restores a backup made by scripts/db-backup.mjs into a Supabase project.
//   node scripts/db-restore.mjs <snapshot folder> --ref <target project ref> [--skip-files] [--yes]
// Prerequisites: the target has the schema already (node scripts/db-migrate.mjs --apply against it, same
// migrations as in the snapshot's manifest) and its public tables are EMPTY – the script refuses otherwise.
// Without --yes it only checks and prints what it would do.
// Order: auth.users/auth.identities first (their triggers may create profile rows, which are cleared again),
// then all public tables with user triggers disabled (no notifications, XP or pushes while loading),
// sequences reset, then the storage files from the backup's files/ mirror.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { insertSql, qualifiedIdent, restoreOrder } from "../src/lib/backup-sql.ts";

const args = process.argv.slice(2);
const snapshot = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--ref");
const ref = args.includes("--ref") ? args[args.indexOf("--ref") + 1] : null;
const apply = args.includes("--yes");
const skipFiles = args.includes("--skip-files");
if (!snapshot || !ref) throw new Error("usage: node scripts/db-restore.mjs <snapshot folder> --ref <target project ref> [--skip-files] [--yes]");
const dir = resolve(snapshot);
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));

const fileEnv = existsSync("docs/.env.deploy.local")
  ? Object.fromEntries(readFileSync("docs/.env.deploy.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }))
  : {};
const token = process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN missing");

const api = (path, init = {}) => fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
  ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
});
async function sql(query) {
  const res = await api("/database/query", { method: "POST", body: JSON.stringify({ query }) });
  const body = await res.json();
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

const tables = Object.keys(manifest.row_counts);
const authTables = tables.filter((t) => t.startsWith("auth."));
const publicTables = tables.filter((t) => t.startsWith("public."));
const rowsOf = (t) => readFileSync(join(dir, `${t}.json`), "utf8");

// Checks: every table exists in the target, public tables are empty
const columns = new Map();
for (const r of await sql(`select table_schema || '.' || table_name as t, column_name as c from information_schema.columns
  where table_schema in ('public', 'auth') and is_generated = 'NEVER' and coalesce(generation_expression, '') = '' order by ordinal_position`)) {
  if (!columns.has(r.t)) columns.set(r.t, []);
  columns.get(r.t).push(r.c);
}
const missing = tables.filter((t) => !columns.has(t));
if (missing.length) throw new Error(`Tables missing in the target (apply the migrations first): ${missing.join(", ")}`);
const filled = [];
for (const t of publicTables) {
  const [{ n }] = await sql(`select count(*)::int as n from ${qualifiedIdent(t)}`);
  if (n > 0) filled.push(`${t} (${n})`);
}
if (filled.length) throw new Error(`Target tables are not empty: ${filled.join(", ")}`);

const fks = (await sql(`select c.conrelid::regclass::text as t, c.confrelid::regclass::text as r from pg_constraint c
  join pg_namespace n on n.oid = c.connamespace where c.contype = 'f' and n.nspname = 'public'`))
  .map((f) => ({ table: f.t.includes(".") ? f.t : `public.${f.t}`, references: f.r.includes(".") ? f.r : `public.${f.r}` }));
const order = restoreOrder(publicTables, fks);
const total = tables.reduce((s, t) => s + manifest.row_counts[t], 0);
console.log(`Snapshot ${manifest.created_at} from ${manifest.project_ref} (commit ${manifest.git_commit ?? "?"}) → target ${ref}`);
console.log(`${tables.length} tables, ${total} rows, ${skipFiles ? "no" : manifest.files.length} files.`);
if (!apply) { console.log("Checks passed. Run again with --yes to restore."); process.exit(0); }

// 1. Accounts
for (const t of authTables) {
  if (manifest.row_counts[t]) await sql(insertSql(t, columns.get(t), rowsOf(t)));
  console.log(`  ${t}: ${manifest.row_counts[t]}`);
}
// rows created by triggers on auth.users (e.g. profiles) are replaced by the backup's rows
for (const t of [...order].reverse()) await sql(`delete from ${qualifiedIdent(t)}`);

// 2. App data, user triggers off
for (const t of publicTables) await sql(`alter table ${qualifiedIdent(t)} disable trigger user`);
try {
  for (const t of order) {
    if (manifest.row_counts[t]) await sql(insertSql(t, columns.get(t), rowsOf(t)));
    console.log(`  ${t}: ${manifest.row_counts[t]}`);
  }
} finally {
  for (const t of publicTables) await sql(`alter table ${qualifiedIdent(t)} enable trigger user`);
}

// 3. Sequences behind serial columns continue after the restored ids
for (const s of await sql(`select table_schema || '.' || table_name as t, column_name as c from information_schema.columns
  where table_schema = 'public' and column_default like 'nextval(%'`)) {
  await sql(`select setval(pg_get_serial_sequence('${qualifiedIdent(s.t).replace(/'/g, "''")}', '${s.c}'),
    coalesce((select max("${s.c}") from ${qualifiedIdent(s.t)}), 0) + 1, false)`);
}
console.log("Database restored.");

// 4. Storage files
if (!skipFiles) {
  const keys = await (await api("/api-keys?reveal=true")).json();
  const serviceKey = Array.isArray(keys) ? keys.find((k) => k.name === "service_role")?.api_key : null;
  if (!serviceKey) throw new Error("service_role key of the target not available");
  const filesRoot = join(dir, "..", "..", "files");
  let uploaded = 0, failed = 0;
  for (const f of manifest.files) {
    const local = join(filesRoot, f.bucket, ...f.name.split("/"));
    if (!existsSync(local)) { failed++; console.warn(`  missing in backup: ${f.bucket}/${f.name}`); continue; }
    const url = `https://${ref}.supabase.co/storage/v1/object/${f.bucket}/${f.name.split("/").map(encodeURIComponent).join("/")}`;
    const res = await fetch(url, { method: "POST", body: readFileSync(local),
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "x-upsert": "true", "Content-Type": f.mimetype || "application/octet-stream" } });
    if (res.ok) uploaded++; else { failed++; console.warn(`  upload failed (${res.status}): ${f.bucket}/${f.name}`); }
  }
  console.log(`${uploaded} files uploaded, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}
