// One-off: export one pilot's own data from the old Lovable Cloud project (read-only).
//   node scripts/lovable-export-my-data.mjs
// Signs in with OLD_FLYARY_REFRESH_TOKEN from docs/.env.deploy.local, so it sees exactly what
// that pilot sees through RLS. Writes docs/lovable-export.local/ (git-ignored): data.json plus
// all referenced storage files. The rotated refresh token is written back to the env file.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname } from "node:path";

const ENV_FILE = "docs/.env.deploy.local";
const OUT = "docs/lovable-export.local";
const envText = readFileSync(ENV_FILE, "utf8");
const env = Object.fromEntries(envText.split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

// Old project's public values, from the .env before the switch (commit e0cb3e8).
const oldEnv = Object.fromEntries(execSync("git show e0cb3e8^:.env", { encoding: "utf8" }).split(/\r?\n/)
  .filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));
const OLD_URL = oldEnv.VITE_SUPABASE_URL;
const OLD_KEY = oldEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

async function session() {
  // Preferred: a copied access token (valid ~1 h, never rotated by the still-open old app).
  if (env.OLD_FLYARY_ACCESS_TOKEN) {
    // The Lovable project issues ES256 tokens that its /auth/v1/user endpoint rejects, while
    // PostgREST and Storage accept them. Take user id/email from the token payload; RLS on the
    // data endpoints still verifies the signature.
    const payload = JSON.parse(Buffer.from(env.OLD_FLYARY_ACCESS_TOKEN.split(".")[1], "base64url").toString());
    if (payload.exp * 1000 < Date.now()) throw new Error("Access-Token abgelaufen – bitte neu kopieren");
    return { access_token: env.OLD_FLYARY_ACCESS_TOKEN, user: { id: payload.sub, email: payload.email } };
  }
  const res = await fetch(`${OLD_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST", headers: { apikey: OLD_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: env.OLD_FLYARY_REFRESH_TOKEN }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Anmeldung am alten Projekt fehlgeschlagen: ${body.error_description || body.msg || res.status}`);
  // Refresh tokens rotate: keep the new one so the export can be re-run.
  writeFileSync(ENV_FILE, envText.replace(/^OLD_FLYARY_REFRESH_TOKEN=.*$/m, `OLD_FLYARY_REFRESH_TOKEN=${body.refresh_token}`));
  return body;
}

const auth = await session();
const uid = auth.user.id;
const headers = { apikey: OLD_KEY, Authorization: `Bearer ${auth.access_token}` };
console.log(`Angemeldet am alten Projekt als ${auth.user.email}`);

async function rest(path) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${OLD_URL}/rest/v1/${path}`, { headers: { ...headers, Range: `${from}-${from + 999}` } });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}
async function rpc(name) {
  const res = await fetch(`${OLD_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}
const byFlights = async (table, flightIds) => {
  const rows = [];
  for (let i = 0; i < flightIds.length; i += 100) rows.push(...await rest(`${table}?select=*&flight_id=in.(${flightIds.slice(i, i + 100).join(",")})`));
  return rows;
};

const data = { exportedAt: new Date().toISOString(), oldUserId: uid, email: auth.user.email };
data.profile = (await rest(`profiles?select=pilot_name,glider_info,bio,avatar_url,cover_photo_url,flight_school,training_level&user_id=eq.${uid}`))[0] || null;
data.profilePrivate = (await rpc("get_own_profile_private"))[0] || null;
for (const t of ["locations", "pilot_gliders", "flights", "training_progress", "flight_templates", "pilot_goals", "profile_photos", "xcontest_imports"]) {
  data[t] = await rest(`${t}?select=*&user_id=eq.${uid}`);
}
const flightIds = data.flights.map((f) => f.id);
for (const t of ["flight_photos", "flight_videos", "igc_tracks", "flight_training_items"]) data[t] = await byFlights(t, flightIds);
// Training items get random ids per project: keep (category_id, name) to map them on import.
data.training_items = await rest("training_items?select=id,category_id,name");

// Storage files referenced by the rows.
const files = [
  ...[data.profile?.avatar_url, data.profile?.cover_photo_url].filter((p) => p && !p.startsWith("http")).map((p) => ["flight-photos", p]),
  ...data.profile_photos.map((p) => ["flight-photos", p.storage_path]),
  ...data.flight_photos.map((p) => ["flight-photos", p.storage_path]),
  ...data.flight_videos.flatMap((v) => [v.storage_path, v.poster_path].filter(Boolean).map((p) => ["flight-videos", p])),
  ...data.igc_tracks.filter((t) => t.storage_path).map((t) => ["igc-files", t.storage_path]),
];
data.files = [];
for (const [bucket, path] of files) {
  const res = await fetch(`${OLD_URL}/storage/v1/object/authenticated/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`, { headers });
  if (!res.ok) { console.log(`  Datei fehlt/kein Zugriff: ${bucket}/${path} (HTTP ${res.status})`); continue; }
  const target = `${OUT}/files/${bucket}/${path}`;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  data.files.push({ bucket, path, contentType: res.headers.get("content-type") });
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/data.json`, JSON.stringify(data, null, 2));
console.log("Exportiert:", Object.entries(data).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k} ${v.length}`).join(", "));
console.log(`Profil: ${data.profile ? "ja" : "nein"}, private Angaben: ${data.profilePrivate ? "ja" : "nein"}`);
