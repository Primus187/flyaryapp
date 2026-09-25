// Regenerates src/integrations/supabase/types.ts from the live database schema (read-only, via the
// Supabase Management API). Run after every applied migration: node scripts/gen-types.mjs
// Credentials come from the environment or docs/.env.deploy.local (git-ignored), as in db-migrate.mjs.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const fileEnv = existsSync("docs/.env.deploy.local")
  ? Object.fromEntries(readFileSync("docs/.env.deploy.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }))
  : {};
const token = process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || fileEnv.SUPABASE_PROJECT_REF;
if (!token || !ref) throw new Error("SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF missing");

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`, {
  headers: { Authorization: `Bearer ${token}` },
});
const body = await res.json();
if (!res.ok || !body.types) throw new Error(`Type generation failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
writeFileSync("src/integrations/supabase/types.ts", body.types);
console.log("src/integrations/supabase/types.ts updated");
