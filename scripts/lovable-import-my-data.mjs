// One-off (leaving Lovable): imports docs/lovable-export.local/import-plan.json into the new
// project for the account with the given e-mail (it must have signed in once).
//   node scripts/lovable-import-my-data.mjs tobias.a.bolliger@gmail.com
// Safe to re-run: rows are matched by id (locations, flights) or by flight + path (tracks,
// photos, videos); storage uploads overwrite the same object. Never prints secret values.
import { readFileSync } from "node:fs";

const email = process.argv[2];
if (!email) throw new Error("Aufruf: node scripts/lovable-import-my-data.mjs <e-mail>");
const env = Object.fromEntries(readFileSync("docs/.env.deploy.local", "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const ref = env.SUPABASE_PROJECT_REF;
const projectUrl = `https://${ref}.supabase.co`;

async function api(method, path, body) {
  const res = await fetch(`https://api.supabase.com${path}`, {
    method, headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : null;
}
const sql = (query) => api("POST", `/v1/projects/${ref}/database/query`, { query });
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonLit = (v) => `$json$${JSON.stringify(v)}$json$::jsonb`;

// Target account
const users = await sql(`select id from auth.users where lower(email) = lower(${lit(email)})`);
if (users.length !== 1) throw new Error(`Kein eindeutiges Konto für ${email} im neuen Projekt – bitte zuerst einmal in der App anmelden.`);
const userId = users[0].id;
const plan = JSON.parse(readFileSync("docs/lovable-export.local/import-plan.json", "utf8").replaceAll("__USER__", userId));
console.log(`Ziel-Konto gefunden. Plan: ${plan.flights.length} Flüge, ${plan.locations.length} Orte, ${plan.igc_tracks.length} Tracks, ${plan.flight_photos.length} Fotos, ${plan.flight_videos.length} Videos`);

// 1) Files (service-role key only for Storage uploads, fetched at run time)
const keys = await api("GET", `/v1/projects/${ref}/api-keys?reveal=true`);
const serviceKey = keys.find((k) => k.name === "service_role")?.api_key;
if (!serviceKey) throw new Error("service_role-Schlüssel nicht gefunden");
const types = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", igc: "text/plain" };
let uploaded = 0;
for (const u of plan.uploads) {
  const ext = u.dest.split(".").pop().toLowerCase();
  const res = await fetch(`${projectUrl}/storage/v1/object/${u.bucket}/${u.dest.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "x-upsert": "true", "Content-Type": types[ext] || "application/octet-stream" },
    body: readFileSync(`docs/lovable-export.local/files/${u.src}`),
  });
  if (!res.ok) throw new Error(`Upload ${u.bucket}/${u.dest}: HTTP ${res.status} ${await res.text()}`);
  uploaded++;
  process.stdout.write(`\r  Dateien hochgeladen: ${uploaded}/${plan.uploads.length}`);
}
console.log();

// 2) Rows, one transaction (tracks separately below: they are large)
const insertById = (table, rows) => {
  if (!rows.length) return "";
  const cols = [...new Set(rows.flatMap(Object.keys))];
  return `INSERT INTO public.${table} (${cols.join(", ")})
  SELECT ${cols.join(", ")} FROM jsonb_populate_recordset(null::public.${table}, ${jsonLit(rows)})
  ON CONFLICT (id) DO NOTHING;`;
};
const insertByPath = (table, rows) => {
  if (!rows.length) return "";
  const cols = [...new Set(rows.flatMap(Object.keys))];
  return `INSERT INTO public.${table} (${cols.join(", ")})
  SELECT ${cols.map((c) => `x.${c}`).join(", ")} FROM jsonb_populate_recordset(null::public.${table}, ${jsonLit(rows)}) x
  WHERE NOT EXISTS (SELECT 1 FROM public.${table} t WHERE t.flight_id = x.flight_id AND t.storage_path = x.storage_path);`;
};
const profileSets = Object.entries(plan.profile).map(([k, v]) => `${k} = ${lit(v)}`);
await sql(`BEGIN;
${insertById("locations", plan.locations)}
${insertById("flights", plan.flights)}
${insertByPath("flight_photos", plan.flight_photos)}
${insertByPath("flight_videos", plan.flight_videos)}
${profileSets.length ? `UPDATE public.profiles SET ${profileSets.join(", ")} WHERE user_id = ${lit(userId)};` : ""}
COMMIT;`);
console.log("  Orte, Flüge, Fotos, Videos und Profilbilder geschrieben");

for (const [i, t] of plan.igc_tracks.entries()) {
  await sql(insertByPath("igc_tracks", [t]));
  process.stdout.write(`\r  Tracks geschrieben: ${i + 1}/${plan.igc_tracks.length}`);
}
console.log();

const [check] = await sql(`select
  (select count(*) from public.flights where user_id = ${lit(userId)}) as flights,
  (select count(*) from public.locations where user_id = ${lit(userId)}) as locations,
  (select count(*) from public.igc_tracks t join public.flights f on f.id = t.flight_id where f.user_id = ${lit(userId)}) as tracks,
  (select count(*) from public.flight_photos p join public.flights f on f.id = p.flight_id where f.user_id = ${lit(userId)}) as photos,
  (select count(*) from public.flight_videos v join public.flights f on f.id = v.flight_id where f.user_id = ${lit(userId)}) as videos`);
console.log(`\n✔ Fertig. Im neuen Projekt: ${check.flights} Flüge, ${check.locations} Orte, ${check.tracks} Tracks, ${check.photos} Fotos, ${check.videos} Videos.`);
