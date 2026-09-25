// Marketplace demo data: sellers who share no group with you, a second flight school with a shop,
// listings in all categories (with generated demo photos), sales with reviews, reports for the moderation
// and one buyer asking about your own newest listing.
//   node scripts/seed-market-testdata.mjs              -> insert (one transaction) and upload the photos
//   node scripts/seed-market-testdata.mjs --no-photos  -> same, without photos
//   node scripts/seed-market-testdata.mjs --remove     -> delete every demo row and photo again
//   node scripts/seed-market-testdata.mjs --print      -> only write the SQL to docs/lovable-export.local/
// Every demo row has an id starting with 5eed0002- (the Vertical demo data uses 5eed0000-, so both can be
// removed separately); accounts use @example.com addresses and a random password nobody knows.
// Photos are rendered locally with Playwright (Chromium) and uploaded with the service key, which the script
// reads through the Management API and never prints.
// Credentials: SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF from docs/.env.deploy.local.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync("docs/.env.deploy.local", "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const REF = env.SUPABASE_PROJECT_REF;
async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 1500)}`);
  return JSON.parse(text);
}
async function serviceKey() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } });
  if (!res.ok) throw new Error(`API-Keys nicht lesbar: HTTP ${res.status}`);
  const key = (await res.json()).find((k) => k.name === "service_role")?.api_key;
  if (!key) throw new Error("service_role-Key nicht gefunden");
  return key;
}
const STORAGE = `https://${REF}.supabase.co/storage/v1`;
const BUCKET = "marketplace-photos";

const PREFIX = "5eed0002-0000-4000-8000-";
let counter = 0;
const nid = () => PREFIX + (++counter).toString(16).padStart(12, "0");

const q = (v) => v === null || v === undefined ? "NULL"
  : typeof v === "object" && "raw" in v ? v.raw
  : typeof v === "number" || typeof v === "boolean" ? String(v)
  : typeof v === "object" ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  : `'${String(v).replace(/'/g, "''")}'`;
const statements = [];
function ins(table, rows) {
  if (!rows.length) return;
  const cols = [...new Set(rows.flatMap(Object.keys))];
  const values = rows.map((r) => `(${cols.map((c) => (c in r ? q(r[c]) : "DEFAULT")).join(", ")})`);
  statements.push(`INSERT INTO ${table} (${cols.join(", ")}) VALUES\n  ${values.join(",\n  ")};`);
}
const ago = (days, hours = 0) => `now() - interval '${days} days ${hours} hours'`;
/** SQL expression instead of a literal (dates relative to the run). */
const raw = (expr) => ({ raw: expr });

// ── Removal ────────────────────────────────────────────────────────────────
async function removePhotos() {
  const files = await sql(`select name from storage.objects where bucket_id = '${BUCKET}' and name like '${PREFIX}%'`);
  if (!files.length) return 0;
  const key = await serviceKey();
  for (let i = 0; i < files.length; i += 100) {
    const res = await fetch(`${STORAGE}/object/${BUCKET}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: files.slice(i, i + 100).map((f) => f.name) }),
    });
    if (!res.ok) throw new Error(`Fotos löschen: HTTP ${res.status} ${await res.text()}`);
  }
  return files.length;
}
const removeSql = `BEGIN;
DELETE FROM public.notifications WHERE reference_id::text LIKE '${PREFIX}%';
DELETE FROM public.chat_messages WHERE id::text LIKE '${PREFIX}%';
DELETE FROM public.chat_channels WHERE id::text LIKE '${PREFIX}%';
DELETE FROM public.marketplace_reviews WHERE id::text LIKE '${PREFIX}%';
DELETE FROM public.marketplace_reports WHERE id::text LIKE '${PREFIX}%';
DELETE FROM public.marketplace_listings WHERE id::text LIKE '${PREFIX}%';
DELETE FROM public.school_shop_profiles WHERE group_id::text LIKE '${PREFIX}%';
DELETE FROM public.group_member_functions WHERE id::text LIKE '${PREFIX}%';
DELETE FROM public.group_members WHERE id::text LIKE '${PREFIX}%';
DELETE FROM public.flights WHERE id::text LIKE '${PREFIX}%';
DELETE FROM public.groups WHERE id::text LIKE '${PREFIX}%';
-- Rows that triggers created for demo accounts (XP, badges, notifications, ...).
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'user_id' LOOP
    EXECUTE format('DELETE FROM public.%I WHERE user_id::text LIKE %L', r.table_name, '${PREFIX}%');
  END LOOP;
END $$;
DELETE FROM auth.users WHERE id::text LIKE '${PREFIX}%';
COMMIT;`;

if (process.argv.includes("--remove")) {
  const photos = await removePhotos();
  await sql(removeSql);
  const [left] = await sql(`select (select count(*) from auth.users where id::text like '${PREFIX}%') users,
    (select count(*) from public.marketplace_listings where id::text like '${PREFIX}%') listings`);
  console.log(`✔ Marktplatz-Testdaten entfernt (${photos} Fotodateien; verbleibend: ${left.users} Konten, ${left.listings} Anzeigen).`);
  process.exit(0);
}

// ── Context ────────────────────────────────────────────────────────────────
const [existing] = await sql(`select count(*)::int n from auth.users where id::text like '${PREFIX}%'`);
if (existing.n > 0 && !process.argv.includes("--print")) throw new Error("Marktplatz-Testdaten sind bereits eingespielt. Zuerst: node scripts/seed-market-testdata.mjs --remove");
// You = the Flyary admin; your newest live listing gets a question from a demo buyer.
const admins = await sql(`select user_id from public.user_roles where role = 'admin' and user_id::text not like '5eed%' order by user_id limit 1`);
const ME = admins[0]?.user_id ?? null;
const [myListing] = ME ? await sql(`select id, title from public.marketplace_listings where seller_user_id = '${ME}'
  and status in ('active', 'reserved') order by bumped_at desc nulls last limit 1`) : [];

// ── People (fictional, spread over Switzerland; nobody is in one of your groups) ─
const people = {
  sandro: { name: "Sandro Keller", plz: "3600", ort: "Thun", canton: "BE", lat: 46.76, lng: 7.63, since: 820, flights: 64 },
  chiara: { name: "Chiara Rossi", plz: "6600", ort: "Locarno", canton: "TI", lat: 46.17, lng: 8.8, since: 610, flights: 41 },
  martin: { name: "Martin Huber", plz: "6003", ort: "Luzern", canton: "LU", lat: 47.05, lng: 8.31, since: 1300, flights: 180 },
  julie: { name: "Julie Favre", plz: "1003", ort: "Lausanne", canton: "VD", lat: 46.52, lng: 6.63, since: 400, flights: 22 },
  fabian: { name: "Fabian Steiner", plz: "7000", ort: "Chur", canton: "GR", lat: 46.85, lng: 9.53, since: 950, flights: 95 },
  andrea: { name: "Andrea Baumann", plz: "8004", ort: "Zürich", canton: "ZH", lat: 47.38, lng: 8.52, since: 210, flights: 12 },
  beat: { name: "Beat Zurbriggen", plz: "3984", ort: "Fiesch", canton: "VS", lat: 46.4, lng: 8.13, since: 1500, flights: 240 },
  nadine: { name: "Nadine Egli", plz: "9000", ort: "St. Gallen", canton: "SG", lat: 47.42, lng: 9.37, since: 300, flights: 18 },
  pascal: { name: "Pascal Moser", plz: "6390", ort: "Engelberg", canton: "OW", lat: 46.82, lng: 8.41, since: 1100, flights: 150 },
  lena: { name: "Lena Hofer", plz: "3011", ort: "Bern", canton: "BE", lat: 46.95, lng: 7.44, since: 700, flights: 55 },
  kevin: { name: "Kevin Brandt", plz: "4051", ort: "Basel", canton: "BS", lat: 47.55, lng: 7.59, since: 3, flights: 0 },
};
const ascii = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
for (const p of Object.values(people)) { p.id = nid(); p.email = `${ascii(p.name).replace(" ", ".")}@example.com`; }
const P = people;

statements.push(`-- demo accounts: random unknown password, e-mail confirmed, @example.com (no mail delivery)`);
for (const p of Object.values(P)) {
  statements.push(`INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  VALUES (${q(p.id)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${q(p.email)},
    extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf')), ${ago(p.since)},
    '{"provider":"email","providers":["email"]}'::jsonb, ${q({ full_name: p.name })}, ${ago(p.since)}, now(),
    '', '', '', '', '', '', '', '');`);
  statements.push(`INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
  VALUES (${q(p.id)}, ${q(p.id)}, ${q(p.id)}, 'email', ${q({ sub: p.id, email: p.email, email_verified: true })}, now(), now(), NULL);`);
  // handle_new_user() created profile + role; name and "member since"
  statements.push(`UPDATE public.profiles SET pilot_name = ${q(p.name)}, training_level = 'licensed', created_at = ${ago(p.since)} WHERE user_id = ${q(p.id)};`);
}
// A few logged flights, so the seller card shows some experience.
const flights = [];
for (const p of Object.values(P)) {
  for (let i = 0; i < p.flights; i++) {
    flights.push({ id: nid(), user_id: p.id, date: raw(`(current_date - ${Math.floor((i * p.since) / Math.max(p.flights, 1)) + 1})`),
      duration_minutes: 8 + ((i * 37) % 90) });
  }
}
if (flights.length) {
  statements.push(`INSERT INTO public.flights (id, user_id, date, duration_minutes) VALUES\n  ${flights.map((f) => `(${q(f.id)}, ${q(f.user_id)}, ${f.date.raw}, ${f.duration_minutes})`).join(",\n  ")};`);
}

// ── A second flight school with an active shop (not one of your groups) ─────
const school = { id: nid(), name: "Flugschule Hochflug (Demo)" };
statements.push(`INSERT INTO public.groups (id, name, group_type, created_by, created_at) VALUES (${q(school.id)}, ${q(school.name)}, 'school', ${q(P.pascal.id)}, ${ago(1100)});`);
ins("public.group_members", [
  { id: nid(), group_id: school.id, user_id: P.pascal.id, role: "admin" },
  { id: nid(), group_id: school.id, user_id: P.beat.id, role: "member" },
]);
ins("public.group_member_functions", [
  { id: nid(), group_id: school.id, user_id: P.pascal.id, function: "school_lead" },
  { id: nid(), group_id: school.id, user_id: P.beat.id, function: "shop" },
]);
ins("public.school_shop_profiles", [{ group_id: school.id, legal_name: "Hochflug Demo GmbH", street: "Dorfstrasse 12", postal_code: "6390",
  locality: "Engelberg", uid_number: "CHE-000.000.002", vat_registered: true, email: "shop@hochflug-demo.example.com", phone: "+41 41 000 00 00",
  warranty_text: "Neuware: 2 Jahre Gewährleistung. Occasionen: 3 Monate auf Material und Nähte, Check-Protokoll liegt bei. Demo-Shop für Tests.",
  active: true, updated_by: P.pascal.id }]);

// ── Listings ───────────────────────────────────────────────────────────────
// [seller, category, title, {fields}, photos, color]
const wing = (cert, wmin, wmax, hours, check, porosity, extra = {}) => ({ certification: cert, weight_min: wmin, weight_max: wmax, flight_hours: hours, last_check: check, porosity, ...extra });
const L = [];
function listing(seller, category, title, o, photos = 2, color = "#e11d48") {
  const days = o.days ?? 3;
  const isSchool = seller === school;
  const home = isSchool ? P.pascal : seller;
  const row = {
    id: nid(), seller_user_id: isSchool ? null : seller.id, seller_group_id: isSchool ? school.id : null, created_by: home.id,
    listing_type: o.wanted ? "wanted" : "offer", category, title, description: o.description ?? "",
    price_cents: o.price === undefined ? null : Math.round(o.price * 100), price_type: o.priceType ?? "fixed", condition: o.wanted ? null : (o.condition ?? "used"),
    manufacturer: o.manufacturer ?? null, model: o.model ?? null, size: o.size ?? null, year: o.year ?? null, attributes: o.attributes ?? {},
    quantity: o.quantity ?? 1, postal_code: home.plz, locality: home.ort, canton: home.canton, lat: home.lat, lng: home.lng,
    delivery: o.delivery ?? "pickup", status: o.status ?? "active",
    published_at: raw(ago(days)), bumped_at: raw(ago(days, 2)), expires_at: raw(`now() - interval '${days} days' + interval '60 days'`), created_at: raw(ago(days + 1)),
    sold_to: o.soldTo?.id ?? null,
  };
  L.push({ row, photos: o.wanted ? 0 : photos, color, category, title });
  return row;
}
const S = {};
S.iota = listing(P.sandro, "glider", "Advance Iota DLS 23 – top Zustand", { manufacturer: "Advance", model: "Iota DLS", size: "23", year: 2022, price: 2900, priceType: "negotiable", condition: "like_new",
  attributes: wing("b", 75, 95, 85, "2026-04", 420, { hours_from_logbook: false }), delivery: "both", days: 2,
  description: "Verkaufe meine Iota DLS, weil ich auf einen Leichtschirm umsteige. Nie Baumlandung, immer trocken gelagert. Check April 2026 bei Airwave, Protokoll vorhanden. Probeflug am Niesen möglich." }, 3, "#f97316");
S.rush = listing(P.chiara, "glider", "Ozone Rush 6 MS", { manufacturer: "Ozone", model: "Rush 6", size: "MS", year: 2020, price: 1600,
  attributes: wing("b", 85, 105, 210, "2025-11", 180, { repairs: "Kleiner Riss im Obersegel, professionell geflickt (Protokoll vorhanden)." }), days: 5,
  description: "Solider High-B, viele schöne Streckenflüge im Tessin. Porosität gut, Leinen 2025 teilweise ersetzt." }, 2, "#2563eb");
listing(P.martin, "harness", "Woody Valley GTO Light 2, Grösse M", { manufacturer: "Woody Valley", model: "GTO Light 2", size: "M", year: 2021, price: 1400,
  attributes: { harness_type: "pod", protector: "airbag", reserve_container: true }, delivery: "shipping", days: 1,
  description: "Leichtes Liegegurtzeug mit Frontcontainer. Retter nicht inbegriffen. Versand versichert mit der Post." }, 2, "#111827");
listing(P.julie, "reserve", "Companion SQR 120 – frisch gepackt", { manufacturer: "Advance", model: "Companion SQR 120", year: 2021, price: 450,
  attributes: { reserve_type: "other", max_load: 120, last_repack: "2026-06" }, days: 8,
  description: "Nie geworfen. Packprotokoll Juni 2026. Passt in die meisten Frontcontainer." }, 1, "#facc15");
listing(P.fabian, "instrument", "Skytraxx 3.0 mit FLARM", { manufacturer: "Skytraxx", model: "3.0", year: 2023, price: 480, condition: "like_new",
  attributes: { instrument_type: "combo" }, delivery: "shipping", days: 3, description: "Inkl. Halterung fürs Cockpit und Ladekabel. Luftraumdaten aktuell." }, 2, "#0f766e");
listing(P.andrea, "helmet", "Supair Pilot Helm, weiss", { manufacturer: "Supair", model: "Pilot", size: "M", year: 2019, price: 80,
  attributes: { norm: "en966" }, days: 12, description: "Ein paar Kratzer, Polster frisch gewaschen." }, 1, "#f8fafc");
listing(P.beat, "tandem", "Nova Bion 2 Tandem 41", { manufacturer: "Nova", model: "Bion 2", size: "41", year: 2019, price: 3900, priceType: "negotiable",
  attributes: wing("b", 110, 220, 350, "2026-03", 90), days: 6, description: "Tandemschirm aus meinem Passagierbetrieb, jährlich gecheckt. Trimmer neu." }, 3, "#16a34a");
listing(P.nadine, "glider", "Gin Bolero 7 S – ideal für Einsteiger", { manufacturer: "Gin", model: "Bolero 7", size: "S", year: 2023, price: 1800, condition: "like_new",
  attributes: wing("a", 65, 85, 40, "2026-05", 520, { hours_from_logbook: true }), days: 4,
  description: "Nach dem Brevet gekauft, jetzt auf einen B-Schirm gewechselt. Stunden aus dem Flugbuch." }, 2, "#a855f7");
listing(P.lena, "clothing", "Gleitschirm-Overall Kortel, Grösse M", { size: "M", price: 120, days: 15, description: "Warm und winddicht, ideal für Winterflüge." }, 1, "#1e3a8a");
listing(P.sandro, "other", "Packsack Concertina + Schnellpacksack", { price: 60, days: 20, description: "Beide in gutem Zustand, Reissverschlüsse ok." }, 1, "#64748b");
listing(P.chiara, "instrument", "Funkgerät Yaesu FT-60E", { manufacturer: "Yaesu", model: "FT-60E", price: 150, status: "reserved",
  attributes: { instrument_type: "radio" }, days: 9, description: "Mit Helm-Headset und Ersatzakku." }, 1, "#0f172a");
listing(P.martin, "glider", "Niviuk Ikuma 2 P 23", { manufacturer: "Niviuk", model: "Ikuma 2 P", size: "23", year: 2022, price: 2500, priceType: "negotiable",
  attributes: wing("c", 80, 98, 150, "2026-01", 250), days: 10, description: "Anspruchsvoller Streckenschirm (EN-C). Nur für erfahrene Pilotinnen und Piloten." }, 2, "#dc2626");
listing(P.julie, "harness", "Supair Altirando Lite – Hike & Fly", { manufacturer: "Supair", model: "Altirando Lite", size: "M", year: 2020, price: 350,
  attributes: { harness_type: "seat", protector: "none", reserve_container: false }, days: 18, description: "Sehr leicht (280 g), perfekt für Hike & Fly." }, 1, "#475569");
listing(P.fabian, "glider", "Advance Alpha 7 26", { manufacturer: "Advance", model: "Alpha 7", size: "26", year: 2019, price: 1400,
  attributes: wing("a", 90, 110, 120, "2024-02", 300), days: 25, description: "Guter Anfängerschirm. Letzter Check schon länger her – vor dem Fliegen checken lassen." }, 2, "#0ea5e9");
listing(P.andrea, "other", "Windsack mit Teleskopstange", { price: 40, condition: "like_new", days: 7, description: "Stange 3 m, passt in jeden Rucksack." }, 1, "#ea580c");
listing(P.beat, "reserve", "Rundkappe Gin Yeti Rescue 100", { manufacturer: "Gin", model: "Yeti Rescue 100", year: 2015, price: 150,
  attributes: { reserve_type: "round", max_load: 100, last_repack: "2024-09" }, days: 14, description: "Packdatum abgelaufen, vor Gebrauch neu packen lassen." }, 1, "#e2e8f0");
listing(P.nadine, "helmet", "Kortel Kanaille Integralhelm L", { manufacturer: "Kortel", model: "Kanaille", size: "L", year: 2024, price: 180, condition: "like_new",
  attributes: { norm: "en966" }, days: 2 }, 2, "#18181b");
listing(P.sandro, "glider", "Suche: EN-A Schirm Grösse S", { wanted: true, priceType: "on_request", days: 3,
  description: "Für meine Partnerin (65–80 kg). Gerne mit aktuellem Check. Raum Thun/Bern." });
listing(P.chiara, "harness", "Suche leichtes Reversible-Gurtzeug", { wanted: true, priceType: "on_request", days: 11, description: "Grösse S/M, bis ca. CHF 500." });
// Suspicious listing with open reports (for the moderation queue)
const scam = listing(P.kevin, "glider", "Ozone Enzo 3 – fast neu, nur CHF 900", { manufacturer: "Ozone", model: "Enzo 3", size: "MS", year: 2024, price: 900,
  attributes: wing("ccc", 85, 100, 10, "2026-06", 600), delivery: "shipping", days: 1,
  description: "Muss schnell weg. Nur Vorauszahlung, Versand aus dem Ausland. Bitte per E-Mail melden, nicht im Chat." }, 1, "#fb7185");
// School shop: new goods with several pieces and used school equipment
listing(school, "glider", "Advance Alpha 7 – Neuware, alle Grössen", { manufacturer: "Advance", model: "Alpha 7", size: "22–28", year: 2026, price: 3950, condition: "new",
  quantity: 5, attributes: wing("a", 55, 130, 0, "2026-09", 1000), delivery: "both", days: 4, description: "Ab Lager Engelberg. Probeflug nach Absprache, Einweisung inklusive." }, 3, "#22c55e");
listing(school, "harness", "Advance Easiness 3 – Aktion", { manufacturer: "Advance", model: "Easiness 3", size: "M", year: 2026, price: 1890, condition: "new",
  quantity: 3, attributes: { harness_type: "reversible", protector: "airbag", reserve_container: true }, days: 6 }, 2, "#0f172a");
listing(school, "glider", "Schulschirm Nova Prion 5 M – Occasion", { manufacturer: "Nova", model: "Prion 5", size: "M", year: 2021, price: 1100,
  attributes: wing("a", 75, 95, 260, "2026-02", 150), days: 9, description: "Aus dem Schulbetrieb, regelmässig gewartet. Check-Protokoll liegt bei." }, 2, "#8b5cf6");
listing(school, "helmet", "Charly Insider – Schulhelme Occasion", { manufacturer: "Charly", model: "Insider", size: "M/L", price: 60, quantity: 4,
  attributes: { norm: "en966" }, days: 16 }, 1, "#fde047");
// Finished sales (reviews below)
const sold1 = listing(P.lena, "glider", "Skywalk Chili 5 S", { manufacturer: "Skywalk", model: "Chili 5", size: "S", year: 2021, price: 1900, status: "sold", soldTo: P.andrea,
  attributes: wing("b", 70, 90, 180, "2026-05", 200), days: 30 }, 2, "#f43f5e");
const sold2 = listing(P.martin, "instrument", "Syride SYS'Evo", { manufacturer: "Syride", model: "SYS'Evo", price: 160, status: "sold", soldTo: P.beat,
  attributes: { instrument_type: "vario" }, days: 22 }, 1, "#1f2937");
const sold3 = listing(P.sandro, "glider", "Advance Pi 3 21", { manufacturer: "Advance", model: "Pi 3", size: "21", year: 2020, price: 1500, status: "sold", soldTo: P.nadine,
  attributes: wing("b", 60, 90, 90, "2025-10", 350), days: 40 }, 1, "#f59e0b");
const sold4 = listing(school, "reserve", "Schul-Retter Occasion 110", { manufacturer: "Advance", model: "Companion SQR 110", price: 280, status: "sold", soldTo: P.fabian,
  attributes: { reserve_type: "other", max_load: 110, last_repack: "2026-04" }, days: 35 }, 1, "#fef08a");
const sold5 = listing(P.chiara, "other", "Rucksack Ozone 110 l", { price: 70, status: "sold", soldTo: P.kevin, days: 20 }, 1, "#334155");
ins("public.marketplace_listings", L.map((l) => l.row));

// ── Reviews, reports ───────────────────────────────────────────────────────
const review = (l, direction, reviewer, revieweeUser, revieweeGroup, rating, comment, days, reported = false) => ({
  id: nid(), listing_id: l.id, listing_title: l.title, direction, reviewer_id: reviewer.id, reviewee_user_id: revieweeUser?.id ?? null,
  reviewee_group_id: revieweeGroup?.id ?? null, rating, comment, created_at: raw(ago(days)), reported_at: reported ? raw(ago(days - 1)) : null });
const reviews = [
  review(sold1, "of_seller", P.andrea, P.lena, null, 5, "Super unkompliziert, Schirm genau wie beschrieben.", 28),
  review(sold1, "of_buyer", P.lena, P.andrea, null, 5, "Pünktlich und freundlich.", 28),
  review(sold2, "of_seller", P.beat, P.martin, null, 4, "Alles gut, Versand hat etwas gedauert.", 18),
  review(sold2, "of_buyer", P.martin, P.beat, null, 5, null, 18),
  review(sold3, "of_seller", P.nadine, P.sandro, null, 5, "Hat mir alles erklärt und ist sogar einen Probeflug mitgekommen.", 36),
  review(sold3, "of_buyer", P.sandro, P.nadine, null, 4, null, 36),
  review(sold4, "of_seller", P.fabian, null, school, 5, "Top Beratung im Shop, Retter frisch gepackt.", 33),
  // reported: waits in the moderation
  review(sold5, "of_seller", P.kevin, P.chiara, null, 1, "Totale Abzocke, die Verkäuferin ist eine Betrügerin!!!", 5, true),
];
statements.push(`INSERT INTO public.marketplace_reviews (id, listing_id, listing_title, direction, reviewer_id, reviewee_user_id, reviewee_group_id, rating, comment, created_at, reported_at) VALUES\n  ${
  reviews.map((r) => `(${[r.id, r.listing_id, r.listing_title, r.direction, r.reviewer_id, r.reviewee_user_id, r.reviewee_group_id, r.rating, r.comment].map(q).join(", ")}, ${r.created_at.raw}, ${r.reported_at ? r.reported_at.raw : "NULL"})`).join(",\n  ")};`);
ins("public.marketplace_reports", [
  { id: nid(), listing_id: scam.id, reporter_id: P.lena.id, reason: "scam", note: "Nur Vorauszahlung und Kontakt ausserhalb von Flyary – typisches Betrugsmuster." },
  { id: nid(), listing_id: scam.id, reporter_id: P.julie.id, reason: "scam", note: "Preis viel zu tief für einen Enzo 3." },
]);

// ── A demo buyer asks about your newest live listing (you get a chat and a push) ─
if (myListing) {
  const channel = nid();
  statements.push(`INSERT INTO public.chat_channels (id, kind, name, listing_id, buyer_id, created_by) VALUES (${q(channel)}, 'listing', ${q(myListing.title.slice(0, 80))}, ${q(myListing.id)}, ${q(P.andrea.id)}, ${q(P.andrea.id)});`);
  statements.push(`INSERT INTO public.chat_messages (id, channel_id, user_id, message, created_at) VALUES
  (${q(nid())}, ${q(channel)}, ${q(P.andrea.id)}, ${q(`Hallo! Ist «${myListing.title}» noch zu haben?`)}, now() - interval '20 minutes'),
  (${q(nid())}, ${q(channel)}, ${q(P.andrea.id)}, 'Ich könnte am Wochenende vorbeikommen und bar bezahlen.', now() - interval '18 minutes');`);
}

// ── Run ────────────────────────────────────────────────────────────────────
if (process.argv.includes("--print")) {
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync("docs/lovable-export.local", { recursive: true });
  writeFileSync("docs/lovable-export.local/seed-market-preview.sql", `BEGIN;\n${statements.join("\n")}\nCOMMIT;\n`);
  console.log(`SQL geschrieben: docs/lovable-export.local/seed-market-preview.sql (${statements.length} Anweisungen)`);
  process.exit(0);
}
await sql(`BEGIN;\n${statements.join("\n")}\nCOMMIT;`);

// ── Photos: rendered demo pictures (1280 px + 320 px thumbnail, JPEG) ────────
let uploaded = 0;
if (!process.argv.includes("--no-photos")) {
  const { chromium } = await import("@playwright/test");
  const key = await serviceKey();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const photoRows = [];
  for (const l of L) {
    for (let i = 0; i < l.photos; i++) {
      const photoId = nid();
      const path = `${l.row.id}/${photoId}.jpg`, thumb = `${l.row.id}/${photoId}_thumb.jpg`;
      for (const [file, w, h] of [[path, 1280, 960], [thumb, 320, 240]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.setContent(photoHtml(l.category, l.color, i, l.title));
        const body = await page.screenshot({ type: "jpeg", quality: w > 400 ? 78 : 70 });
        const res = await fetch(`${STORAGE}/object/${BUCKET}/${file}`, {
          method: "POST", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "image/jpeg", "Cache-Control": "31536000", "x-upsert": "true" }, body,
        });
        if (!res.ok) throw new Error(`Foto-Upload ${file}: HTTP ${res.status} ${await res.text()}`);
        uploaded++;
      }
      photoRows.push({ id: photoId, listing_id: l.row.id, path, thumb_path: thumb, position: i });
    }
  }
  await browser.close();
  if (photoRows.length) await sql(`INSERT INTO public.marketplace_listing_photos (id, listing_id, path, thumb_path, position) VALUES\n  ${
    photoRows.map((r) => `(${[r.id, r.listing_id, r.path, r.thumb_path, r.position].map(q).join(", ")})`).join(",\n  ")};`);
}

const [c] = await sql(`select
  (select count(*) from auth.users where id::text like '${PREFIX}%') konten,
  (select count(*) from public.marketplace_listings where id::text like '${PREFIX}%') anzeigen,
  (select count(*) from public.marketplace_listing_photos where listing_id::text like '${PREFIX}%') fotos,
  (select count(*) from public.marketplace_reviews where id::text like '${PREFIX}%') bewertungen`);
console.log(`✔ Marktplatz-Testdaten eingespielt: ${c.konten} Konten, 1 Flugschule mit Shop, ${c.anzeigen} Anzeigen, ${c.fotos} Fotos (${uploaded} Dateien), ${c.bewertungen} Bewertungen.`);
console.log(myListing ? `  Andrea Baumann hat dir zu «${myListing.title}» geschrieben.` : "  (Keine eigene aktive Anzeige gefunden – ohne Chat-Anfrage.)");
console.log("Entfernen: node scripts/seed-market-testdata.mjs --remove");

// Simple illustration per category; photo 2 and 3 use other backgrounds and zoom.
function photoHtml(category, color, variant, title) {
  const bg = [
    "linear-gradient(180deg,#7dd3fc 0%,#e0f2fe 70%,#bbf7d0 100%)",
    "linear-gradient(180deg,#a3c585 0%,#6b8f4e 100%)",
    "linear-gradient(135deg,#e5e7eb 0%,#9ca3af 100%)",
  ][variant % 3];
  const scale = [1, 1.25, 0.85][variant % 3];
  const line = "#374151";
  const shapes = {
    glider: `<path d="M140 330 Q640 40 1140 330 Q640 230 140 330 Z" fill="${color}" stroke="${line}" stroke-width="4"/>
      ${[200, 420, 860, 1080].map((x) => `<line x1="${x}" y1="300" x2="640" y2="720" stroke="${line}" stroke-width="2"/>`).join("")}
      <circle cx="640" cy="740" r="26" fill="${line}"/>`,
    tandem: `<path d="M100 330 Q640 20 1180 330 Q640 220 100 330 Z" fill="${color}" stroke="${line}" stroke-width="4"/>
      ${[160, 400, 880, 1120].map((x) => `<line x1="${x}" y1="300" x2="640" y2="700" stroke="${line}" stroke-width="2"/>`).join("")}
      <circle cx="615" cy="730" r="24" fill="${line}"/><circle cx="665" cy="760" r="24" fill="${line}"/>`,
    harness: `<rect x="440" y="260" width="400" height="440" rx="120" fill="${color}" stroke="${line}" stroke-width="6"/>
      <rect x="500" y="560" width="280" height="90" rx="30" fill="#ffffff" fill-opacity=".25"/><line x1="500" y1="260" x2="470" y2="140" stroke="${line}" stroke-width="10"/><line x1="780" y1="260" x2="810" y2="140" stroke="${line}" stroke-width="10"/>`,
    reserve: `<path d="M340 520 Q640 100 940 520 Z" fill="${color}" stroke="${line}" stroke-width="5"/>
      ${[360, 500, 640, 780, 920].map((x) => `<line x1="${x}" y1="515" x2="640" y2="820" stroke="${line}" stroke-width="2"/>`).join("")}`,
    instrument: `<rect x="450" y="190" width="380" height="580" rx="40" fill="${color}" stroke="${line}" stroke-width="6"/>
      <rect x="490" y="240" width="300" height="360" rx="12" fill="#ecfeff"/><text x="640" y="450" font-size="96" text-anchor="middle" font-family="Arial" fill="#0f172a">+2.4</text>
      <circle cx="560" cy="690" r="30" fill="#e5e7eb"/><circle cx="720" cy="690" r="30" fill="#e5e7eb"/>`,
    helmet: `<path d="M400 620 Q400 280 640 280 Q880 280 880 620 Z" fill="${color}" stroke="${line}" stroke-width="6"/>
      <path d="M450 540 Q640 470 830 540 L830 600 Q640 540 450 600 Z" fill="#0f172a" fill-opacity=".7"/>`,
    clothing: `<path d="M520 200 L760 200 L880 330 L820 380 L780 340 L780 760 L660 760 L640 520 L620 760 L500 760 L500 340 L460 380 L400 330 Z" fill="${color}" stroke="${line}" stroke-width="6"/>`,
    other: `<rect x="420" y="300" width="440" height="420" rx="60" fill="${color}" stroke="${line}" stroke-width="6"/>
      <path d="M540 300 Q640 170 740 300" fill="none" stroke="${line}" stroke-width="16"/>`,
  };
  return `<!doctype html><html><body style="margin:0;overflow:hidden">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 960" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="display:block;background:${bg}">
      <g transform="translate(640 480) scale(${scale}) translate(-640 -480)">${shapes[category] ?? shapes.other}</g>
      <rect x="0" y="880" width="1280" height="80" fill="#000" fill-opacity=".35"/>
      <text x="32" y="932" font-size="34" font-family="Arial" fill="#fff">${title.replace(/[<&]/g, "")} · Demo-Foto</text>
    </svg></body></html>`;
}
