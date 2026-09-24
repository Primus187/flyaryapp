// One-time setup of the self-hosted Supabase project (after leaving Lovable Cloud).
//   node scripts/setup-new-project.mjs
// Reads docs/.env.deploy.local (git-ignored). Never prints secret values. Safe to re-run:
// every step checks what already exists.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const ENV_FILE = "docs/.env.deploy.local";
if (!existsSync(ENV_FILE)) throw new Error(`${ENV_FILE} missing`);
const env = Object.fromEntries(readFileSync(ENV_FILE, "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
for (const k of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF", "APP_URL", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "XCONTEST_ENCRYPTION_KEY"]) {
  if (!env[k]) throw new Error(`${k} missing in ${ENV_FILE}`);
}
const ref = env.SUPABASE_PROJECT_REF;
const appUrl = env.APP_URL.replace(/\/+$/, "");
const projectUrl = `https://${ref}.supabase.co`;

async function api(method, path, body) {
  const res = await fetch(`https://api.supabase.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : null;
}
const sql = (query) => api("POST", `/v1/projects/${ref}/database/query`, { query });
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const step = (name) => console.log(`\n▶ ${name}`);

step("1/6 Datenbank-Migrationen");
execSync("node scripts/db-migrate.mjs --apply", { stdio: "inherit" });

step("2/6 Vault-Secrets (project_url, push_internal_secret)");
const existingVault = (await sql("select name from vault.decrypted_secrets where name in ('project_url','push_internal_secret')")).map((r) => r.name);
if (!existingVault.includes("project_url")) await sql(`select vault.create_secret(${lit(projectUrl)}, 'project_url')`);
let pushSecret;
if (existingVault.includes("push_internal_secret")) {
  pushSecret = (await sql("select decrypted_secret as s from vault.decrypted_secrets where name = 'push_internal_secret'"))[0].s;
} else {
  pushSecret = randomBytes(32).toString("hex");
  await sql(`select vault.create_secret(${lit(pushSecret)}, 'push_internal_secret')`);
}
console.log("  ok (project_url, push_internal_secret)");

step("3/6 Profil und Rolle für bestehende Konten (Anmelde-Trigger lief vor den Migrationen)");
const fixed = await sql(`
  with p as (
    insert into public.profiles (user_id, pilot_name)
    select u.id, coalesce(u.raw_user_meta_data->>'full_name', '') from auth.users u
    where not exists (select 1 from public.profiles x where x.user_id = u.id)
    returning 1),
  r as (
    insert into public.user_roles (user_id, role)
    select u.id, 'user' from auth.users u
    where not exists (select 1 from public.user_roles x where x.user_id = u.id)
    returning 1)
  select (select count(*) from p) as profiles, (select count(*) from r) as roles`);
console.log(`  ok (neu: ${fixed[0].profiles} Profil, ${fixed[0].roles} Rolle)`);

step("4/6 Edge-Function-Secrets");
await api("POST", `/v1/projects/${ref}/secrets`, [
  { name: "VAPID_PUBLIC_KEY", value: env.VAPID_PUBLIC_KEY },
  { name: "VAPID_PRIVATE_KEY", value: env.VAPID_PRIVATE_KEY },
  { name: "XCONTEST_ENCRYPTION_KEY", value: env.XCONTEST_ENCRYPTION_KEY },
  { name: "PUSH_INTERNAL_SECRET", value: pushSecret },
  { name: "APP_URL", value: appUrl },
]);
console.log("  ok (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, XCONTEST_ENCRYPTION_KEY, PUSH_INTERNAL_SECRET, APP_URL)");

step("5/6 Edge Functions deployen");
execSync(`npx --yes supabase@latest functions deploy --use-api --project-ref ${ref}`, {
  stdio: "inherit", env: { ...process.env, SUPABASE_ACCESS_TOKEN: env.SUPABASE_ACCESS_TOKEN },
});

step("6/6 Login-Einstellungen (App-Adresse, erlaubte Weiterleitungen)");
await api("PATCH", `/v1/projects/${ref}/config/auth`, {
  site_url: appUrl,
  uri_allow_list: [`${appUrl}/**`, "http://localhost:8080/**"].join(","),
});
const auth = await api("GET", `/v1/projects/${ref}/config/auth`);
console.log(`  ok (Site-URL ${auth.site_url}; Google-Login ${auth.external_google_enabled ? "aktiv" : "NICHT aktiv – in Supabase unter Authentication → Providers → Google einschalten"})`);

console.log("\n✔ Fertig. Jetzt kann das Frontend deployt werden (git push).");
