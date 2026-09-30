// Backup of the Flyary database and storage files – read-only against the live project, except for one
// status row per run (report_backup_run, migration 0082) that lets Flyary warn when backups fail or stop.
//   npm run backup
// Writes to FLYARY_BACKUP_DIR (default: %USERPROFILE%\FlyaryBackups – deliberately outside OneDrive and the repo):
//   data/<timestamp>/<schema.table>.json   all rows of every public table plus auth.users/auth.identities
//   data/<timestamp>/manifest.json          time, project, git commit, applied migrations, row counts, file list with eTags
//   files/<bucket>/<path>                   mirror of all storage files (new or changed ones are downloaded;
//                                           changes are detected by eTag, not only by size)
//   files/.index.json                       eTag of every mirrored file
//   file-versions/<timestamp>/<bucket>/…    the previous content of files that changed in storage
// The newest FLYARY_BACKUP_KEEP data snapshots (default 8) are kept. Restore: scripts/db-restore.mjs,
// check: scripts/restore-verify.mjs. Daily run: scripts/install-backup-task.ps1.
// Credentials come from the environment or docs/.env.deploy.local (git-ignored), as in db-migrate.mjs.
// The backup contains personal data (emergency contacts, health consent, password hashes): keep it private.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, renameSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { exportSql, snapshotsToPrune, mirrorAction, reportRunSql } from "../src/lib/backup-sql.ts";

const fileEnv = existsSync("docs/.env.deploy.local")
  ? Object.fromEntries(readFileSync("docs/.env.deploy.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }))
  : {};
const token = process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || fileEnv.SUPABASE_PROJECT_REF;
if (!token || !ref) throw new Error("SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF missing");
const root = process.env.FLYARY_BACKUP_DIR || join(homedir(), "FlyaryBackups");
const keep = Number(process.env.FLYARY_BACKUP_KEEP || 8);

const api = (path, init = {}) => fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
  ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
});
async function sql(query) {
  const res = await api("/database/query", { method: "POST", body: JSON.stringify({ query }) });
  const body = await res.json();
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

const now = new Date();
const stamp = now.toISOString().slice(0, 16).replace("T", "_").replace(":", "");
let commit = null;
try { commit = execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* not a git checkout */ }
const run = { ok: false, snapshot: stamp, host: hostname(), gitCommit: commit, tables: 0, rows: 0, filesTotal: 0, downloaded: 0, failed: 0, message: null };

async function report() {
  try { await sql(reportRunSql(run)); } catch (e) { console.warn(`Could not report the run to Flyary: ${e.message}`); }
}

try {
  const dataDir = join(root, "data", stamp);
  mkdirSync(dataDir, { recursive: true });

  // 1. Table data (one query per table – not one transaction, which is fine at this size and write rate)
  const tables = (await sql(`select schemaname || '.' || tablename as t from pg_tables where schemaname = 'public' order by 1`))
    .map((r) => r.t).concat(["auth.users", "auth.identities"]);
  const counts = {};
  for (const table of tables) {
    const [{ rows }] = await sql(exportSql(table));
    writeFileSync(join(dataDir, `${table}.json`), JSON.stringify(rows));
    counts[table] = rows.length;
  }
  run.tables = tables.length;
  run.rows = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`${tables.length} tables, ${run.rows} rows → ${dataDir}`);

  // 2. Storage files (incremental mirror; changed files keep their previous version)
  const keys = await (await api("/api-keys?reveal=true")).json();
  const serviceKey = Array.isArray(keys) ? keys.find((k) => k.name === "service_role")?.api_key : null;
  if (!serviceKey) throw new Error("service_role key not available");
  const objects = await sql(`select bucket_id, name, (metadata->>'size')::bigint as size, metadata->>'mimetype' as mimetype, metadata->>'eTag' as etag from storage.objects where metadata is not null order by 1, 2`);
  const indexPath = join(root, "files", ".index.json");
  const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : {};
  let versioned = 0;
  for (const o of objects) {
    const key = `${o.bucket_id}/${o.name}`;
    const target = join(root, "files", o.bucket_id, ...o.name.split("/"));
    const exists = existsSync(target);
    const action = mirrorAction({ exists, size: exists ? statSync(target).size : null, etag: index[key] ?? null }, { size: Number(o.size), etag: o.etag });
    if (action === "skip") { if (o.etag) index[key] = o.etag; continue; }
    const url = `https://${ref}.supabase.co/storage/v1/object/authenticated/${o.bucket_id}/${o.name.split("/").map(encodeURIComponent).join("/")}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } });
    if (!res.ok) { run.failed++; console.warn(`  file failed (${res.status}): ${key}`); continue; }
    const content = Buffer.from(await res.arrayBuffer());
    if (action === "replace") {
      const version = join(root, "file-versions", stamp, o.bucket_id, ...o.name.split("/"));
      mkdirSync(dirname(version), { recursive: true });
      renameSync(target, version);
      versioned++;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    if (o.etag) index[key] = o.etag;
    run.downloaded++;
  }
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, JSON.stringify(index));
  run.filesTotal = objects.length;
  console.log(`${objects.length} files in storage, ${run.downloaded} downloaded (${versioned} changed, old version kept), ${run.failed} failed → ${join(root, "files")}`);

  // 3. Manifest
  const migrations = {
    legacy: (await sql("select version from supabase_migrations.schema_migrations order by 1")).map((r) => r.version),
    drizzle: (await sql("select count(*)::int as n from drizzle.__drizzle_migrations"))[0].n,
  };
  writeFileSync(join(dataDir, "manifest.json"), JSON.stringify({
    created_at: now.toISOString(), project_ref: ref, git_commit: commit, migrations, row_counts: counts,
    files: objects.map((o) => ({ bucket: o.bucket_id, name: o.name, size: Number(o.size), mimetype: o.mimetype, etag: o.etag })),
  }, null, 2));

  // 4. Keep the newest snapshots
  for (const old of snapshotsToPrune(readdirSync(join(root, "data")), keep)) {
    rmSync(join(root, "data", old), { recursive: true, force: true });
    console.log(`removed old snapshot ${old}`);
  }
  run.ok = run.failed === 0;
  if (!run.ok) run.message = `${run.failed} Datei(en) konnten nicht gesichert werden.`;
} catch (e) {
  run.ok = false;
  run.message = `Sicherung abgebrochen: ${e.message}`;
  console.error(run.message);
}
await report();
if (!run.ok) process.exitCode = 1;
console.log(run.ok ? "Backup done." : "Backup finished with errors.");
