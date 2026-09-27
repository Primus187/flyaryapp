// Imports the official takeoff/landing sites from the DHV site database into public.official_sites.
// Usage:
//   node scripts/import-official-sites.mjs            -> dry run: what would be added/changed/retired
//   node scripts/import-official-sites.mjs --apply    -> write it
//   node scripts/import-official-sites.mjs --file=data/dhv/other.xml
// Input: the "DHV XML" country export (login at dhv.de → Gelände-Datenbank → Download), kept in the
// git-ignored folder data/dhv/. Re-running is safe: sites are matched by their DHV location id,
// renamed/moved sites update every linked pilot place (trigger official_sites_propagate), and sites
// missing from the file are only marked inactive, never deleted, so flights keep their place.
// Credentials as for scripts/db-migrate.mjs (docs/.env.deploy.local).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { parseDhvXml } from "../src/lib/dhv-sites.ts";
import { localizeSiteName, normalizeSiteName } from "../src/lib/site-names.ts";

const fileEnv = existsSync("docs/.env.deploy.local")
  ? Object.fromEntries(readFileSync("docs/.env.deploy.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }))
  : {};
const token = process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || fileEnv.SUPABASE_PROJECT_REF;
if (!token || !ref) throw new Error("SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF missing");
const apply = process.argv.includes("--apply");

const fileArg = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
const file = fileArg || (existsSync("data/dhv") ? readdirSync("data/dhv").filter((f) => /dhvxml.*\.xml$/i.test(f)).map((f) => `data/dhv/${f}`)[0] : null);
if (!file || !existsSync(file)) throw new Error("No DHV XML export found in data/dhv/ (or pass --file=...)");

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
const lit = (v) => v === null || v === undefined ? "NULL" : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const arr = (a) => `ARRAY[${a.map(lit).join(",")}]::text[]`;

const rows = parseDhvXml(readFileSync(file, "utf8"), normalizeSiteName)
  .map((r) => ({ ...r, name_fr: localizeSiteName(r.name_de, "fr"), name_en: localizeSiteName(r.name_de, "en") }));
if (rows.length === 0) throw new Error(`${file}: no sites found – is it the "DHV XML" export?`);
const countries = [...new Set(rows.map((r) => r.country_code))];
console.log(`${file}: ${rows.length} places (${countries.join(", ")}) – ${rows.filter((r) => r.type === "takeoff").length} takeoffs, ${rows.filter((r) => r.type === "landing").length} landings, ${rows.filter((r) => r.type === "both").length} both`);

const existing = await sql(`SELECT source_id, name_de, latitude, longitude, active FROM public.official_sites WHERE source = 'dhv' AND country_code IN (${countries.map(lit).join(",")})`);
const byId = new Map(existing.map((e) => [e.source_id, e]));
const fresh = rows.filter((r) => !byId.has(r.source_id));
const renamed = rows.filter((r) => byId.has(r.source_id) && byId.get(r.source_id).name_de !== r.name_de);
const ids = new Set(rows.map((r) => r.source_id));
const retired = existing.filter((e) => e.active && !ids.has(e.source_id));
const linked = retired.length
  ? await sql(`SELECT count(*)::int AS n FROM public.locations l JOIN public.official_sites s ON s.id = l.official_site_id WHERE s.source = 'dhv' AND s.source_id IN (${retired.map((r) => lit(r.source_id)).join(",")})`)
  : [{ n: 0 }];
console.log(`new: ${fresh.length}, renamed: ${renamed.length}, no longer in the file: ${retired.length} (pilot places linked to them: ${linked[0].n})`);
for (const r of renamed.slice(0, 20)) console.log(`  renamed ${byId.get(r.source_id).name_de} → ${r.name_de}`);
for (const r of retired.slice(0, 20)) console.log(`  retired ${r.name_de}`);

if (!apply) { console.log("Dry run. Re-run with --apply to write."); process.exit(0); }

const COLS = ["source_id", "area_name", "name_de", "name_fr", "name_en", "type", "latitude", "longitude", "altitude", "country_code", "region", "municipality", "wind_directions", "paragliding", "hanggliding", "source_url"];
for (let i = 0; i < rows.length; i += 200) {
  const values = rows.slice(i, i + 200).map((r) => `('dhv',${COLS.map((c) => c === "wind_directions" ? arr(r[c]) : c === "type" ? `${lit(r[c])}::public.location_type` : lit(r[c])).join(",")},true)`);
  await sql(`INSERT INTO public.official_sites (source,${COLS.join(",")},active) VALUES ${values.join(",\n")}
    ON CONFLICT (source, source_id) DO UPDATE SET ${COLS.filter((c) => c !== "source_id").map((c) => `${c} = EXCLUDED.${c}`).join(", ")}, active = true, updated_at = now()`);
  console.log(`  written ${Math.min(i + 200, rows.length)}/${rows.length}`);
}
if (retired.length) {
  await sql(`UPDATE public.official_sites SET active = false, updated_at = now() WHERE source = 'dhv' AND source_id IN (${retired.map((r) => lit(r.source_id)).join(",")})`);
}
const [{ n }] = await sql("SELECT count(*)::int AS n FROM public.official_sites WHERE active");
console.log(`Done. Active official sites: ${n}.`);
