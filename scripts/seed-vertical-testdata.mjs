// Realistic demo data for the school group "Vertical" (testing / demos before the real start).
//   node scripts/seed-vertical-testdata.mjs            -> insert (one transaction, all or nothing)
//   node scripts/seed-vertical-testdata.mjs --remove   -> delete every demo row again
//   node scripts/seed-vertical-testdata.mjs --print    -> only write the SQL to docs/lovable-export.local/
// Every demo row has an id starting with 5eed0000-; demo accounts use @example.com addresses and
// a random password nobody knows (no login possible). Dates are relative to the day of the run.
// Credentials: SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF from docs/.env.deploy.local.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync("docs/.env.deploy.local", "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 1500)}`);
  return JSON.parse(text);
}

const PREFIX = "5eed0000-0000-4000-8000-";
let counter = 0;
const nid = () => PREFIX + (++counter).toString(16).padStart(12, "0");
// Deterministic pseudo-random numbers: the same run produces the same data.
let seed = 20260924;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => Math.round(a + rnd() * (b - a));

const q = (v) => v === null || v === undefined ? "NULL"
  : typeof v === "number" || typeof v === "boolean" ? String(v)
  : Array.isArray(v) ? `ARRAY[${v.map(q).join(",")}]::text[]`
  : typeof v === "object" ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  : `'${String(v).replace(/'/g, "''")}'`;
const statements = [];
function ins(table, rows, { each = false } = {}) {
  if (!rows.length) return;
  const cols = [...new Set(rows.flatMap(Object.keys))];
  // A column only some rows set must fall back to its DEFAULT (not NULL) in the other rows.
  const values = rows.map((r) => `(${cols.map((c) => (c in r ? q(r[c]) : "DEFAULT")).join(", ")})`);
  if (each) values.forEach((v) => statements.push(`INSERT INTO ${table} (${cols.join(", ")}) VALUES ${v};`));
  else statements.push(`INSERT INTO ${table} (${cols.join(", ")}) VALUES\n  ${values.join(",\n  ")};`);
}

// ── Removal ────────────────────────────────────────────────────────────────
// chat_* (migration 0025): copies of demo group/event messages and the demo channels.
const SEEDED = ["chat_messages", "chat_channels", "feed_likes", "feed_comments", "feed_achievements", "challenge_progress", "challenge_goals", "challenges",
  "flight_coach_notes", "flight_training_items", "flights", "student_day_notes", "event_messages", "event_carpool_riders",
  "event_carpools", "event_staff", "event_briefing_tasks", "event_maneuvers", "event_weather_decisions", "equipment_checks",
  "equipment_assignments", "equipment_maintenance", "incident_reports", "billing_items", "launch_leader_credits",
  "event_signups", "flight_events", "school_equipment", "instructor_certifications", "instructor_availability",
  "school_rates", "team_poll_responses", "team_polls", "group_messages", "training_progress", "training_level_history",
  "student_status_history", "group_member_functions", "group_members", "locations"];
// Tables that do not exist yet (chat_* before migration 0025) are skipped.
const removeSql = `BEGIN;
${SEEDED.map((t) => `DO $$ BEGIN IF to_regclass('public.${t}') IS NOT NULL THEN
  DELETE FROM public.${t} WHERE ${t === "flight_training_items" ? "flight_id" : "id"}::text LIKE '${PREFIX}%'; END IF; END $$;`).join("\n")}
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
  await sql(removeSql);
  const [left] = await sql(`select (select count(*) from auth.users where id::text like '${PREFIX}%') users,
    (select count(*) from public.flight_events where id::text like '${PREFIX}%') events`);
  console.log(`✔ Testdaten entfernt (verbleibend: ${left.users} Konten, ${left.events} Termine).`);
  process.exit(0);
}

// ── Context ────────────────────────────────────────────────────────────────
const groups = await sql(`select id, created_by from public.groups where name ilike 'vertical%' and group_type = 'school'`);
if (groups.length !== 1) throw new Error(`Erwarte genau eine Schulgruppe "Vertical", gefunden: ${groups.length}`);
const G = groups[0].id;
const ADMIN = groups[0].created_by;
const [existing] = await sql(`select count(*)::int n from auth.users where id::text like '${PREFIX}%'`);
if (existing.n > 0 && !process.argv.includes("--print")) throw new Error("Testdaten sind bereits eingespielt. Zuerst: node scripts/seed-vertical-testdata.mjs --remove");
const exam = await sql(`select id, name from public.training_items where is_exam_maneuver order by name`);
const [{ chat }] = await sql(`select to_regclass('public.chat_channels') is not null as chat`); // migration 0025 applied?
const itemsByName = Object.fromEntries(exam.map((i) => [i.name.slice(0, 2), i.id])); // "a)" .. "g)"
const examIds = exam.map((i) => i.id);

// ── Dates relative to today (Europe/Zurich, events on Saturdays) ─────────────
const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Zurich" }));
today.setHours(12, 0, 0, 0);
const day = (offset) => { const d = new Date(today); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const nextSat = ((6 - today.getDay() + 7) % 7) || 7;
const at = (offset, time) => `${day(offset)} ${time}:00 Europe/Zurich`;

// ── People ─────────────────────────────────────────────────────────────────
const people = {
  reto: { name: "Reto Brunner", functions: ["school_lead", "instructor"] },
  lea: { name: "Lea Schmid", functions: ["instructor"] },
  nico: { name: "Nico Frei", functions: ["launch_helper"] },
  mia: { name: "Mia Zürcher", level: "ground", functions: ["student"] },
  lukas: { name: "Lukas Graf", level: "ground", functions: ["student"] },
  nina: { name: "Nina Bühler", level: "ground", functions: ["student"] },
  jonas: { name: "Jonas Wyss", level: "altitude", functions: ["student"] },
  sara: { name: "Sara Kälin", level: "altitude", functions: ["student"] },
  david: { name: "David Meier", level: "altitude", functions: ["student"], status: ["paused", "Knieverletzung beim Landen – Pause bis Mitte Oktober"] },
  laura: { name: "Laura Fankhauser", level: "exam_ready", functions: ["student"] },
  tim: { name: "Tim Roth", level: "licensed", functions: ["licensed"] },
};
const ascii = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
for (const p of Object.values(people)) {
  p.id = nid();
  p.email = `${ascii(p.name).replace(" ", ".")}@example.com`;
}
const P = people;
const students = ["mia", "lukas", "nina", "jonas", "sara", "david", "laura", "tim"].map((k) => P[k]);
const staff = [P.reto, P.lea, P.nico];

statements.push(`-- demo accounts: random unknown password, e-mail confirmed, @example.com (no mail delivery)`);
for (const p of Object.values(P)) {
  statements.push(`INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  VALUES (${q(p.id)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${q(p.email)},
    extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf')), now() - interval '60 days',
    '{"provider":"email","providers":["email"]}'::jsonb, ${q({ full_name: p.name })}, now() - interval '60 days', now(),
    '', '', '', '', '', '', '', '');`);
  statements.push(`INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
  VALUES (${q(p.id)}, ${q(p.id)}, ${q(p.id)}, 'email', ${q({ sub: p.id, email: p.email, email_verified: true })}, now(), now(), NULL);`);
}
// handle_new_user() created profile + role; fill in the details.
const shv = () => `${between(10, 99)}.${between(100, 999)}`;
for (const [key, p] of Object.entries(P)) {
  const isStudent = !!p.level;
  statements.push(`UPDATE public.profiles SET pilot_name = ${q(p.name)}, flight_school = 'Vertical',
    training_level = ${q(p.level ?? "licensed")}, shv_number = ${q(isStudent && p.level !== "ground" ? shv() : key === "reto" || key === "lea" ? shv() : null)},
    glider_info = ${q(isStudent ? null : pick(["Advance Iota DLS 25", "Ozone Rush 6 MS", "Nova Mentor 7 S"]))},
    emergency_contact_name = ${q(pick(["Anna", "Peter", "Claudia", "Markus", "Sandra"]) + " " + p.name.split(" ")[1])},
    emergency_contact_phone = ${q(`+41 79 ${between(100, 999)} ${between(10, 99)} ${between(10, 99)}`)},
    health_data_consent_at = ${isStudent ? "now() - interval '40 days'" : "NULL"},
    allergies = ${q(key === "sara" ? "Wespenstiche (Notfallset im Rucksack)" : null)},
    exam_theory_date = ${q(key === "laura" ? day(-20) : null)}, exam_practical_date = ${q(key === "laura" ? day(nextSat + 14) : null)}
    WHERE user_id = ${q(p.id)};`);
}

// Memberships and school functions
ins("public.group_members", Object.values(P).map((p) => ({ id: nid(), group_id: G, user_id: p.id, role: "member" })));
ins("public.group_member_functions", Object.values(P).flatMap((p) => p.functions.map((f) => ({ id: nid(), group_id: G, user_id: p.id, function: f }))));

// Student status and training level history
ins("public.student_status_history", students.map((s) => ({ id: nid(), group_id: G, student_id: s.id, status: "active", reason: "Kursanmeldung", changed_by: P.reto.id, changed_at: at(-75, "18:00") })));
ins("public.student_status_history", [
  { id: nid(), group_id: G, student_id: P.david.id, status: "paused", reason: P.david.status[1], changed_by: P.reto.id, changed_at: at(-12, "20:15") },
]);
const levelSteps = { ground: ["ground"], altitude: ["ground", "altitude"], exam_ready: ["ground", "altitude", "exam_ready"], licensed: ["ground", "altitude", "exam_ready", "licensed"] };
ins("public.training_level_history", students.flatMap((s) => levelSteps[s.level].map((lvl, i, all) => ({
  id: nid(), group_id: G, user_id: s.id, training_level: lvl, changed_by: P.reto.id, changed_at: at(-70 + Math.round((i * 60) / all.length), "19:00") }))));

// Locations (visible only to their owner, so every pilot gets their own copies)
const SITES = {
  bergbo: { name: "Bergbo (Beatenberg)", lat: 46.7004461275177, lng: 7.82075985995716, type: "takeoff" },
  luegi: { name: "Luegibrüggli", lat: 46.6909892081535, lng: 7.8103359224171, type: "takeoff" },
  niederhorn: { name: "Niederhorn", lat: 46.7111941579059, lng: 7.7779333981952, type: "takeoff" },
  lehn: { name: "Lehn (Interlaken)", lat: 46.6811436966955, lng: 7.82389455771575, type: "landing" },
  hoehematte: { name: "Höhematte Interlaken", lat: 46.6859673174659, lng: 7.85872937706202, type: "landing" },
  uebungshang: { name: "Übungshang Beatenberg", lat: 46.6987, lng: 7.7935, type: "both" },
};
const locs = [];
const loc = (person, site) => {
  person.locs ??= {};
  if (!person.locs[site]) {
    const s = SITES[site];
    person.locs[site] = nid();
    locs.push({ id: person.locs[site], user_id: person.id, name: s.name, latitude: s.lat, longitude: s.lng, type: s.type, altitude: { bergbo: 1260, luegi: 1080, niederhorn: 1935, lehn: 570, hoehematte: 568, uebungshang: 1150 }[site] });
  }
  return person.locs[site];
};

// ── Equipment ──────────────────────────────────────────────────────────────
const eq = (name, type, inv, size, extra = {}) => ({ id: nid(), group_id: G, name, equipment_type: type, inventory_number: inv, size, condition: "gut", status: "in_stock", purchase_date: "2024-03-01", shv_type_approved: type === "glider", last_check_date: day(-200), next_check_date: day(165), ...extra });
const E = {
  alpha22: eq("Advance Alpha 7", "glider", "VG-01", "22"),
  alpha24: eq("Advance Alpha 7", "glider", "VG-02", "24"),
  alpha26: eq("Advance Alpha 7", "glider", "VG-03", "26"),
  prionS: eq("Nova Prion 5", "glider", "VG-04", "S", { next_check_date: day(-9), condition: "Leinen prüfen" }),
  prionM: eq("Nova Prion 5", "glider", "VG-05", "M"),
  alpha6: eq("Advance Alpha 6", "glider", "VG-06", "24", { status: "retired", retired_at: day(-40), retire_reason: "Porosität über Grenzwert, Tuch ermüdet", condition: "ausgemustert" }),
  easyM: eq("Advance Easiness 3", "harness", "VH-01", "M"),
  easyL: eq("Advance Easiness 3", "harness", "VH-02", "L"),
  wani: eq("Woody Valley Wani Light 2", "harness", "VH-03", "M", { status: "maintenance", condition: "Schnalle ersetzt, Kontrolle ausstehend" }),
  res1: eq("Advance Companion SQR 100", "reserve", "VR-01", "100", { next_check_date: day(12) }),
  res2: eq("Advance Companion SQR 120", "reserve", "VR-02", "120", { next_check_date: day(-3) }),
  helm1: eq("Charly Insider", "helmet", "VK-01", "M", { next_check_date: null }),
  helm2: eq("Charly Insider", "helmet", "VK-02", "L", { next_check_date: null }),
  radio1: eq("Motorola T82", "radio", "VF-01", null, { next_check_date: null }),
  radio2: eq("Motorola T82", "radio", "VF-02", null, { next_check_date: null }),
  vario: eq("Skytraxx 2.1", "vario", "VV-01", null, { next_check_date: null }),
};
// [item, pilot, from, due, returned (null = still out)]
const assignments = [
  [E.alpha24, P.mia, -35, -5, -4], [E.easyM, P.mia, -35, -5, -4], [E.alpha26, P.lukas, -30, 10, null], [E.easyL, P.lukas, -30, 10, null],
  [E.alpha22, P.nina, -21, -2, null], [E.prionM, P.jonas, -40, 6, null], [E.helm1, P.nina, -21, 12, null], [E.radio1, P.sara, -14, 2, null],
].map(([item, person, from, due, returned]) => {
  if (returned === null) item.status = "assigned";
  return { id: nid(), equipment_id: item.id, group_id: G, user_id: person.id, assigned_on: day(from), due_on: day(due),
    returned_on: returned === null ? null : day(returned), note: item === E.alpha22 ? "Rückgabe überfällig – Nina erinnern" : null, created_by: P.reto.id };
});
ins("public.school_equipment", Object.values(E));
ins("public.equipment_assignments", assignments);
ins("public.equipment_maintenance", [
  { id: nid(), group_id: G, equipment_id: E.res2.id, maintenance_type: "reserve_repack", due_at: day(-3), note: "Packintervall 180 Tage" },
  { id: nid(), group_id: G, equipment_id: E.res1.id, maintenance_type: "reserve_repack", due_at: day(12), note: "Termin bei Airwave Thun" },
  { id: nid(), group_id: G, equipment_id: E.prionS.id, maintenance_type: "glider_check", due_at: day(-9), note: "2-Jahres-Check inkl. Leinenvermessung" },
  { id: nid(), group_id: G, equipment_id: E.wani.id, maintenance_type: "harness_check", due_at: day(4), note: "Nach Schnallentausch Sichtkontrolle" },
  { id: nid(), group_id: G, equipment_id: E.alpha24.id, maintenance_type: "glider_check", due_at: day(-60), completed_at: day(-58), completed_by: P.reto.id, note: "Check bestanden, Porosität 12 s" },
]);

// ── Staff: certifications, availability, rates ───────────────────────────
ins("public.instructor_certifications", [
  { id: nid(), group_id: G, user_id: P.reto.id, cert_type: "instructor", issued_at: "2015-04-20", valid_until: "2027-03-31" },
  { id: nid(), group_id: G, user_id: P.reto.id, cert_type: "biplace_2", issued_at: "2018-06-01", valid_until: "2027-06-30" },
  { id: nid(), group_id: G, user_id: P.reto.id, cert_type: "first_aid", issued_at: day(-712), valid_until: day(18), note: "Refresher buchen" },
  { id: nid(), group_id: G, user_id: P.lea.id, cert_type: "instructor", issued_at: "2021-05-10", valid_until: "2026-12-31" },
  { id: nid(), group_id: G, user_id: P.lea.id, cert_type: "first_aid", issued_at: day(-300), valid_until: day(430) },
  { id: nid(), group_id: G, user_id: P.nico.id, cert_type: "launch_leader", issued_at: "2023-03-15", valid_until: "2027-03-15" },
]);
const upcomingSats = [0, 7, 14].map((w) => nextSat + w);
ins("public.instructor_availability", [
  ...upcomingSats.map((o, i) => ({ id: nid(), group_id: G, user_id: P.reto.id, date: day(o), status: "available" })),
  ...upcomingSats.map((o, i) => ({ id: nid(), group_id: G, user_id: P.lea.id, date: day(o), status: ["available", "unsure", "unavailable"][i], note: i === 2 ? "Ferien" : null })),
  ...upcomingSats.map((o, i) => ({ id: nid(), group_id: G, user_id: P.nico.id, date: day(o), status: i === 1 ? "unsure" : "available" })),
]);
ins("public.school_rates", [
  { id: nid(), group_id: G, rate_key: "rental_per_day", label: "Materialmiete pro Tag", amount: 40, unit: "Tag", valid_from: "2026-01-01" },
  { id: nid(), group_id: G, rate_key: "rental_per_week", label: "Materialmiete pro Woche", amount: 150, unit: "Woche", valid_from: "2026-01-01" },
  { id: nid(), group_id: G, rate_key: "travel_per_km", label: "Fahrspesen pro km", amount: 0.7, unit: "km", valid_from: "2026-01-01" },
  { id: nid(), group_id: G, rate_key: "launch_leader_per_day", label: "Startleiter-Entschädigung pro Tag", amount: 120, unit: "Tag", valid_from: "2026-01-01" },
]);

// ── Events ─────────────────────────────────────────────────────────────────
const PREP = "Wetter am Vorabend prüfen (MeteoSchweiz, Windy). Material komplett: Schirm, Gurtzeug, Retter, Helm, Handschuhe, feste Schuhe, Funk geladen. Znüni und genug zu trinken mitnehmen.";
function event(key, o) {
  const ev = { id: nid(), group_id: G, created_by: P.reto.id, status: "confirmed", ...o };
  EV[key] = ev;
  return ev;
}
const EV = {};
event("basic1", { title: "Grundkurs Tag 1 – Übungshang", event_category: "basic_course", event_date: at(nextSat - 35, "08:30"), meeting_point: "Talstation Beatenbergbahn, 08:30",
  day_topic: "Auslegen, Vorwärtsstart, erste Hüpfer am Übungshang", flight_prep_notes: PREP, instructor: "Reto Brunner", max_participants: 6 });
event("height1", { title: "Höhenflugtag Bergbo", event_category: "height_flight", event_date: at(nextSat - 28, "08:00"), meeting_point: "08:00 Bahnhof Interlaken Ost\n08:45 Startplatz Bergbo",
  flight_area: "Bergbo → Lehn, Luegibrüggli bei Westwind", day_topic: "Landeeinteilung und Volte", flight_prep_notes: PREP, instructor: "Reto Brunner", launch_helper: "Nico Frei", max_participants: 6 });
event("height2", { title: "Höhenflugtag Niederhorn", event_category: "height_flight", event_date: at(nextSat - 21, "08:00"), meeting_point: "08:00 Talstation Niederhornbahn",
  flight_area: "Niederhorn → Höhematte", day_topic: "Ohren anlegen und Beschleuniger", flight_prep_notes: PREP, instructor: "Lea Schmid", launch_helper: "Nico Frei", max_participants: 6 });
event("theory1", { title: "Theorieabend: Meteo für Gleitschirmpiloten", event_category: "lecture", event_date: at(nextSat - 16, "19:00"), meeting_point: "Schulungsraum Vertical, Interlaken",
  day_topic: "Föhn, Bise, Thermik – Wetterentscheid im Berner Oberland", instructor: "Lea Schmid" });
event("height3", { title: "Höhenflugtag Bergbo", event_category: "height_flight", event_date: at(nextSat - 14, "08:00"), meeting_point: "08:00 Bahnhof Interlaken Ost\n08:45 Startplatz Bergbo",
  flight_area: "Bergbo → Lehn", day_topic: "Prüfungsmanöver: Doppelkreis und Acht", flight_prep_notes: PREP, instructor: "Reto Brunner", launch_helper: "Nico Frei", max_participants: 6 });
event("height4", { title: "Höhenflugtag Luegibrüggli", status: "cancelled", event_category: "height_flight", event_date: at(nextSat - 7, "08:00"), meeting_point: "08:00 Bahnhof Interlaken Ost",
  flight_area: "Luegibrüggli → Lehn", day_topic: "Soaring am Luegibrüggli", instructor: "Lea Schmid", max_participants: 6, description: "Abgesagt: Föhn mit Böen über 45 km/h am Brienzer Rothorn." });
event("up1", { title: "Höhenflugtag Bergbo", event_category: "height_flight", event_date: at(nextSat, "08:00"), signup_deadline: `${day(nextSat - 1)} 23:59:59 Europe/Zurich`,
  meeting_point: "08:00 Bahnhof Interlaken Ost\n08:45 Startplatz Bergbo", flight_area: "Bergbo → Lehn", day_topic: "Seitenklapper stabilisieren", flight_prep_notes: PREP,
  instructor: "Reto Brunner", launch_helper: "Nico Frei", max_participants: 6, departure_info: "Fahrgemeinschaften ab Bern 07:00 (siehe unten)" });
event("basic2", { title: "Grundkurs Tag 2 – erste Höhenflüge", status: "announced", event_category: "basic_course", event_date: at(nextSat + 7, "08:30"),
  meeting_point: "Talstation Beatenbergbahn, 08:30", day_topic: "Erster Höhenflug mit Funkbegleitung", flight_prep_notes: PREP, instructor: "Lea Schmid", max_participants: 4 });
event("theory2", { title: "Theorieabend: Luftrecht und Prüfungsvorbereitung", status: "announced", event_category: "lecture", event_date: at(nextSat + 12, "19:00"),
  meeting_point: "Schulungsraum Vertical, Interlaken", day_topic: "Lufträume, Hindernisse, Fragenkatalog SHV", instructor: "Reto Brunner" });
event("exam", { title: "Prüfungstag Brevet", status: "announced", event_category: "experienced", event_type: "Brevetprüfung", event_date: at(nextSat + 14, "08:00"),
  meeting_point: "08:00 Startplatz Bergbo", flight_area: "Bergbo → Lehn", instructor: "Reto Brunner", max_participants: 3,
  description: "Praktische SHV-Prüfung für Laura. Experte vor Ort ab 09:00." });
event("camp", { title: "Herbstcamp Tessin", status: "announced", event_category: "camp_air", event_date: at(nextSat + 20, "07:00"), end_date: day(nextSat + 22),
  meeting_point: "07:00 Parkplatz Talstation Monte Lema, Miglieglia", departure_info: "Unterkunft: Ostello Miglieglia, Zimmer à 4. Anreise individuell oder Fahrgemeinschaft.",
  description: "Drei Flugtage im Malcantone: Monte Lema, Dagro und Porlezza. Ideal für Streckenflug-Einsteiger und Brevet-Schüler.",
  max_participants: 10, published_to_feed: true, published_at: at(-6, "18:30"), feed_description: "Noch 4 Plätze frei fürs Herbstcamp im Tessin! 🌄" });
ins("public.flight_events", Object.values(EV));

ins("public.event_staff", [
  ...["height1", "height3", "up1", "exam"].map((k) => ({ id: nid(), event_id: EV[k].id, user_id: P.reto.id, role: "instructor", position: "Start" })),
  ...["height2", "basic2"].map((k) => ({ id: nid(), event_id: EV[k].id, user_id: P.lea.id, role: "instructor", position: "Start" })),
  ...["height1", "height3", "up1"].map((k) => ({ id: nid(), event_id: EV[k].id, user_id: P.lea.id, role: "instructor", position: "Landeplatz" })),
  ...["height1", "height2", "height3", "up1"].map((k) => ({ id: nid(), event_id: EV[k].id, user_id: P.nico.id, role: "launch_helper", position: "Start" })),
]);
const heightKeys = ["height1", "height2", "height3", "height4", "up1"];
ins("public.event_briefing_tasks", heightKeys.flatMap((k, i) => [
  { id: nid(), event_id: EV[k].id, task_type: "meteo", label: "Wetterbriefing", assigned_user_id: [P.jonas, P.sara, P.laura, P.jonas, P.laura][i].id, sort_order: 0 },
  { id: nid(), event_id: EV[k].id, task_type: "flight_area", label: "Fluggebiet und Hindernisse", assigned_user_id: P.lea.id, sort_order: 1 },
  { id: nid(), event_id: EV[k].id, task_type: "day_topic", label: "Tagesthema", assigned_user_id: P.reto.id, sort_order: 2 },
]));
const maneuverPlan = { height1: ["a)", "b)"], height2: ["c)", "d)"], height3: ["a)", "b)"], up1: ["e)", "f)"], exam: ["a)", "b)", "c)", "d)", "e)", "f)", "g)"] };
ins("public.event_maneuvers", Object.entries(maneuverPlan).flatMap(([k, list]) => list.filter((m) => itemsByName[m]).map((m, i) => ({ id: nid(), event_id: EV[k].id, training_item_id: itemsByName[m], sort_order: i }))));
ins("public.event_weather_decisions", [
  { id: nid(), event_id: EV.height4.id, decision_deadline: at(nextSat - 8, "18:00"), status: "cancelled", decided_by: P.lea.id, decided_at: at(nextSat - 8, "17:40"), note: "Föhn, Böen > 45 km/h. Ersatzdatum wird im Chat bekanntgegeben." },
  { id: nid(), event_id: EV.up1.id, decision_deadline: at(nextSat - 1, "18:00"), status: "weather_pending", note: "Entscheid Freitag 18:00 – Bise könnte bis Mittag stören." },
]);

// ── Signups (one statement each: the waitlist trigger counts earlier rows) ──
const signup = (k, s, extra = {}) => ({ id: nid(), event_id: EV[k].id, user_id: s.id, signed_up: true, ...extra });
const past = {
  basic1: [P.mia, P.lukas, P.nina], height1: [P.jonas, P.sara, P.david, P.laura], height2: [P.jonas, P.sara, P.laura, P.tim],
  theory1: [P.mia, P.lukas, P.nina, P.jonas, P.sara, P.laura], height3: [P.jonas, P.sara, P.laura, P.mia], height4: [P.jonas, P.sara, P.laura],
};
const signups = [];
for (const [k, list] of Object.entries(past)) list.forEach((s, i) =>
  signups.push(signup(k, s, { attended: k !== "height4", confirmed_by_school: true })));
[P.jonas, P.sara, P.laura, P.mia, P.lukas, P.nina, P.tim, P.david].forEach((s, i) =>
  signups.push(signup("up1", s, i === 7 ? { signed_up: false } : { confirmed_by_school: i < 3 })));
[P.mia, P.lukas, P.nina].forEach((s) => signups.push(signup("basic2", s)));
[P.laura].forEach((s) => signups.push(signup("exam", s, { confirmed_by_school: true })));
[P.jonas, P.sara, P.laura, P.tim, P.lea, P.reto].forEach((s) => signups.push(signup("camp", s)));
[P.laura, P.jonas, P.sara].forEach((s) => signups.push(signup("theory2", s)));
ins("public.event_signups", signups, { each: true });

// Carpool and event chat for the next flying day
const carpool = { id: nid(), event_id: EV.up1.id, driver_user_id: P.sara.id, seats: 3, departure_place: "Bern Wankdorf P+R", departure_time: "07:00" };
ins("public.event_carpools", [carpool]);
ins("public.event_carpool_riders", [P.jonas, P.mia].map((s) => ({ id: nid(), carpool_id: carpool.id, user_id: s.id })));
ins("public.event_messages", [
  { id: nid(), event_id: EV.up1.id, user_id: P.reto.id, message: "Hallo zäme! Stand jetzt sieht Samstag gut aus, Entscheid kommt Freitag 18:00. Bitte Retter-Packdatum kontrollieren.", created_at: at(-2, "19:05") },
  { id: nid(), event_id: EV.up1.id, user_id: P.sara.id, message: "Ich fahre ab Bern Wankdorf, habe noch einen Platz frei 🚗", created_at: at(-2, "19:40") },
  { id: nid(), event_id: EV.up1.id, user_id: P.mia.id, message: "Darf ich mitkommen? Dann bin ich um 07:00 dort.", created_at: at(-1, "07:12") },
  { id: nid(), event_id: EV.up1.id, user_id: P.nico.id, message: "Funkkanal wie immer 5. Ich bin ab 08:30 am Start.", created_at: at(-1, "12:30") },
]);

// Equipment check for the next flying day
ins("public.equipment_checks", [P.jonas, P.sara, P.laura, P.mia].flatMap((s) =>
  ["Helm", "Handschuhe", "Feste Schuhe", "Funkgerät", "Retter-Packdatum"].map((item) => ({
    id: nid(), group_id: G, student_user_id: s.id, item, present: !(s === P.mia && item === "Funkgerät") && !(s === P.jonas && item === "Retter-Packdatum"),
    checked_at: at(-1, "20:00"), checked_by: P.lea.id, note: s === P.jonas && item === "Retter-Packdatum" ? "Packdatum abgelaufen – Schul-Retter VR-01 nehmen" : null }))));

// ── Flights, day notes, coach notes ────────────────────────────────────────
const FLIGHT_NOTES = [
  ["Vorwärtsstart sauber, gute Beschleunigung. Volte etwas zu weit, Queranflug früher einleiten.", "Start ok. Landung punktgenau, schön ausgeflared."],
  ["Rückwärtsstart gelungen, Schirm ruhig über dem Kopf. Doppelkreis zu früh ausgeleitet.", "Doppelkreis in 20 s, Achse gehalten. Landung leicht kurz."],
  ["Ohren sauber angelegt, Beschleuniger dosiert. Achtung Blickführung beim Ausleiten.", "Acht in Zeit, zweiter Kreis etwas flach. Landeeinteilung gut."],
];
const SUMMARIES = ["Solider Tag, Fortschritte bei der Landeeinteilung.", "Sehr ruhig und konzentriert. Bereit für das nächste Manöver.", "Start noch hektisch, sonst gute Entwicklung."];
const NEXT_STEPS = ["Nächstes Mal: Seitenklapper links/rechts stabilisieren.", "Nächster Schritt: Acht auf Zeit (je 18–22 s).", "Nächstes Mal: Landung mit Ohren und Gewichtsverlagerung."];
const flights = [], dayNotes = [], fti = [], coachNotes = [];
const flyingDays = { height1: ["bergbo", "lehn"], height2: ["niederhorn", "hoehematte"], height3: ["bergbo", "lehn"] };
const gliderOf = { jonas: "Nova Prion 5 M (Schule)", sara: "Advance Alpha 7 24", david: "Advance Alpha 7 26 (Schule)", laura: "Advance Alpha 7 22", tim: "Advance Iota 2 23", mia: "Advance Alpha 7 24 (Schule)" };
for (const [k, [from, to]] of Object.entries(flyingDays)) {
  const instructor = k === "height2" ? P.lea : P.reto;
  past[k].forEach((s, si) => {
    const key = Object.keys(P).find((x) => P[x] === s);
    const n = s === P.mia ? 1 : between(2, 3);
    for (let f = 1; f <= n; f++) {
      const fid = nid();
      const dur = from === "niederhorn" ? between(14, 25) : between(7, 11);
      flights.push({ id: fid, user_id: s.id, group_id: G, event_id: EV[k].id, date: EV[k].event_date.slice(0, 10), takeoff_location_id: loc(s, from), landing_location_id: loc(s, to),
        duration_minutes: dur, altitude_gain: from === "niederhorn" ? 1365 : 690, distance_km: from === "niederhorn" ? 6.2 : 4.1, glider: gliderOf[key] || "Advance Alpha 7 (Schule)",
        thermals: pick(["Keine", "Schwach", "Mässig"]), wind_speed: between(5, 15), wind_direction: pick(["SW", "W", "NW"]),
        comments: f === 1 ? pick(["Ruhige Luft, schöner Flug über den Thunersee.", "Start bei leichtem Aufwind, alles nach Plan.", "Etwas turbulent über dem Wald, sonst super."]) : null,
        created_at: at(Number(k === "height1" ? nextSat - 28 : k === "height2" ? nextSat - 21 : nextSat - 14), `1${f}:30`) });
      if (s !== P.tim) dayNotes.push({ id: nid(), event_id: EV[k].id, student_user_id: s.id, flight_number: f, note: FLIGHT_NOTES[si % 3][(f - 1) % 2], visible_to_student: true, instructor_id: instructor.id });
      if (f === 1 && maneuverPlan[k] && s.level !== "ground" && s !== P.tim) {
        fti.push({ flight_id: fid, item_id: itemsByName[maneuverPlan[k][0]], instructor_rating: between(2, 4), instructor_note: "Im Briefing besprochen, sauber geflogen.", instructor_id: instructor.id });
      }
      if (f === n && si === 0) coachNotes.push({ id: nid(), flight_id: fid, coach_id: instructor.id, note: "Gute Entscheidung, bei aufkommendem Talwind früher zu landen.", visible_to_student: true });
    }
    if (s !== P.tim) {
      // One summary per student and day (unique index); on the latest day it is flagged as next step,
      // exactly like the coach view does it.
      const latest = k === "height3";
      dayNotes.push({ id: nid(), event_id: EV[k].id, student_user_id: s.id, flight_number: null,
        note: latest ? `${SUMMARIES[si % 3]} ${NEXT_STEPS[si % 3]}` : SUMMARIES[si % 3], visible_to_student: true, instructor_id: instructor.id, is_next_step: latest });
    }
  });
}
// Basic course day: ground practice (no altitude flights), notes only; David paused on day 1
past.basic1.forEach((s, si) => dayNotes.push({ id: nid(), event_id: EV.basic1.id, student_user_id: s.id, flight_number: null, note: ["Auslegen und Leinencheck sitzen. Vorwärtsstart noch zu zögerlich.", "Schirm steigt schön, beim Beschleunigen weiterlaufen!", "Sehr gutes Bodenhandling, erste Hüpfer kontrolliert."][si], visible_to_student: true, instructor_id: P.reto.id }));
ins("public.locations", locs);
ins("public.flights", flights);
ins("public.student_day_notes", dayNotes);
ins("public.flight_training_items", fti);
ins("public.flight_coach_notes", coachNotes);

// Training progress on the SHV exam maneuvers (ratings 1-5; >= 3 counts as done)
const progress = { jonas: [3, 3, 2, 2], sara: [4, 3, 3, 3, 2], david: [3, 2], laura: [4, 4, 4, 5, 4, 3, 4], tim: [5, 5, 5, 5, 5, 5, 5] };
ins("public.training_progress", Object.entries(progress).flatMap(([k, ratings]) => ratings.map((r, i) => ({
  id: nid(), user_id: P[k].id, item_id: examIds[i], rating: r, notes: r >= 4 ? "Prüfungsreif" : r === 3 ? "Sicher, noch Feinschliff" : "Weiter üben", updated_at: at(-14 + i, "20:00") }))));

// ── Billing, launch-leader credits ─────────────────────────────────────────
ins("public.billing_items", [
  ...[P.mia, P.lukas, P.nina].map((s, i) => ({ id: nid(), group_id: G, user_id: s.id, item_type: "course_fee", description: "Grundkurs Herbst (5 Tage)", quantity: 1, unit_amount: 950, amount: 950, billing_date: day(-40), paid_at: i === 0 ? day(-30) : null, created_by: ADMIN })),
  ...[P.jonas, P.sara].map((s) => ({ id: nid(), group_id: G, user_id: s.id, item_type: "course_fee", description: "Höhenflugkurs (10 Flugtage)", quantity: 1, unit_amount: 1450, amount: 1450, billing_date: day(-60), paid_at: day(-50), created_by: ADMIN })),
  { id: nid(), group_id: G, user_id: P.jonas.id, event_id: EV.height2.id, item_type: "rental", description: "Materialmiete Schulschirm", quantity: 1, unit_amount: 40, amount: 40, billing_date: day(nextSat - 21), created_by: P.lea.id },
  { id: nid(), group_id: G, user_id: P.mia.id, event_id: EV.height3.id, item_type: "rental", description: "Materialmiete Schirm und Gurtzeug", quantity: 1, unit_amount: 40, amount: 40, billing_date: day(nextSat - 14), created_by: P.reto.id },
  { id: nid(), group_id: G, user_id: P.laura.id, item_type: "other", description: "Prüfungsgebühr SHV (weiterverrechnet)", quantity: 1, unit_amount: 180, amount: 180, billing_date: day(-5), created_by: ADMIN, note: "Fällig vor Prüfungstag" },
]);
ins("public.launch_leader_credits", [
  ...["height1", "height2", "height3"].map((k) => ({ id: nid(), group_id: G, user_id: P.nico.id, event_id: EV[k].id, entry_type: "earned", booking_date: EV[k].event_date.slice(0, 10), days: 1, amount: 120, created_by: P.reto.id })),
  { id: nid(), group_id: G, user_id: P.nico.id, entry_type: "payout", booking_date: day(-10), days: 0, amount: 240, note: "Auszahlung August", created_by: ADMIN },
]);

// ── Incident (open, SHV deadline running) ──────────────────────────────────
ins("public.incident_reports", [{ id: nid(), group_id: G, event_id: EV.height1.id, student_user_id: P.david.id, reported_by: P.reto.id,
  occurred_at: at(nextSat - 28, "11:20"), involved_persons: "David Meier (Schüler), Reto Brunner (Fluglehrer)",
  description: "Harte Landung auf dem Landeplatz Lehn nach zu spätem Flare bei aufkommendem Talwind. Schmerzen im linken Knie, selbständig zum Auto gegangen.",
  measures: "Kühlung vor Ort, Arztbesuch am gleichen Tag. Nachbesprechung Flare-Timing im nächsten Theorieblock.", status: "open" }]);

// ── Challenge with goals, progress and feed achievements ───────────────────
const ch = { id: nid(), group_id: G, title: "Herbst-Challenge Berner Oberland", description: "Fliege von allen drei Hausstartplätzen der Schule. Wer alle drei schafft, erhält ein Vertical-Buff 🎉", start_date: day(-45), end_date: day(40), created_by: P.reto.id };
const goals = [["Bergbo", SITES.bergbo], ["Niederhorn", SITES.niederhorn], ["Luegibrüggli", SITES.luegi]].map(([label, s], i) => ({ id: nid(), challenge_id: ch.id, label, points: 10, sort_order: i, latitude: s.lat, longitude: s.lng, radius_meters: 500, goal_type: "waypoint" }));
ins("public.challenges", [ch]);
ins("public.challenge_goals", goals);
const flightOf = (s, k) => flights.find((f) => f.user_id === s.id && f.event_id === EV[k].id)?.id ?? null;
const prog = [[P.laura, 0, "height1"], [P.laura, 1, "height2"], [P.laura, 2, "height3"], [P.sara, 0, "height1"], [P.sara, 1, "height2"], [P.jonas, 1, "height2"]];
ins("public.challenge_progress", prog.map(([s, gi, k]) => ({ id: nid(), challenge_id: ch.id, user_id: s.id, goal_id: goals[gi].id, flight_id: flightOf(s, k), completed_at: EV[k].event_date })));
const achievements = [
  { id: nid(), user_id: P.sara.id, challenge_id: ch.id, goal_id: goals[1].id, achievement_type: "goal_reached", created_at: at(nextSat - 21, "16:00") },
  { id: nid(), user_id: P.laura.id, challenge_id: ch.id, goal_id: null, achievement_type: "challenge_completed", created_at: at(nextSat - 14, "16:30") },
];
ins("public.feed_achievements", achievements);

// ── Feed: published flights with likes/comments ────────────────────────────
const featured = [flightOf(P.laura, "height3"), flightOf(P.tim, "height2"), flightOf(P.sara, "height2")].filter(Boolean);
statements.push(`UPDATE public.flights SET published_to_feed = true, published_at = created_at + interval '2 hours' WHERE id IN (${featured.map(q).join(", ")});`);
ins("public.feed_likes", [
  { id: nid(), flight_id: featured[0], user_id: P.reto.id, reaction_type: "heart" }, { id: nid(), flight_id: featured[0], user_id: P.sara.id, reaction_type: "fire" },
  { id: nid(), flight_id: featured[1], user_id: P.jonas.id, reaction_type: "heart" }, { id: nid(), flight_id: featured[2], user_id: P.laura.id, reaction_type: "heart" },
  { id: nid(), achievement_id: achievements[1].id, user_id: P.reto.id, reaction_type: "fire" }, { id: nid(), event_id: EV.camp.id, user_id: P.jonas.id, reaction_type: "heart" },
]);
ins("public.feed_comments", [
  { id: nid(), flight_id: featured[0], user_id: P.reto.id, message: "Doppelkreis wie im Lehrbuch 👌 So kannst du an die Prüfung!", created_at: at(nextSat - 14, "19:10") },
  { id: nid(), flight_id: featured[0], user_id: P.laura.id, message: "Danke Reto 😊", created_at: at(nextSat - 14, "19:25") },
  { id: nid(), flight_id: featured[2], user_id: P.jonas.id, message: "Mega Aussicht auf den Thunersee!", created_at: at(nextSat - 21, "20:00") },
  { id: nid(), event_id: EV.camp.id, user_id: P.tim.id, message: "Bin dabei, nehme das Auto mit 3 Plätzen ab Bern.", created_at: at(-5, "09:00") },
]);

// ── Group chat, team channel, team poll ────────────────────────────────────
ins("public.group_messages", [
  { id: nid(), group_id: G, user_id: P.reto.id, message: "Willkommen in der Vertical-Gruppe! Hier kommen Infos zu Kurstagen, Wetterentscheiden und Material.", created_at: at(-50, "18:00") },
  { id: nid(), group_id: G, user_id: P.nina.id, message: "Kann man Schulhelme auch übers Wochenende ausleihen?", created_at: at(-9, "12:40") },
  { id: nid(), group_id: G, user_id: P.lea.id, message: "Ja, einfach kurz im Material-Bereich eintragen lassen. 🙂", created_at: at(-9, "13:05") },
  { id: nid(), group_id: G, user_id: P.reto.id, message: "Ersatzdatum für den abgesagten Luegibrüggli-Tag folgt nächste Woche.", created_at: at(-7, "18:10") },
  { id: nid(), group_id: G, user_id: P.reto.id, message: "Team: Prion S ist über dem Check-Datum – bitte bis zum Check nicht mehr einsetzen.", is_team_only: true, created_at: at(-8, "21:00") },
  { id: nid(), group_id: G, user_id: P.lea.id, message: "Notiert. Ich nehme für den Grundkurs die Alpha 22.", is_team_only: true, created_at: at(-8, "21:20") },
]);
const poll = { id: nid(), group_id: G, question: "Wer übernimmt am Prüfungstag die Landeplatz-Betreuung?", options: ["Lea", "Nico", "Reto"], closes_at: at(nextSat + 7, "20:00"), created_by: P.reto.id };
ins("public.team_polls", [poll]);
ins("public.team_poll_responses", [{ id: nid(), poll_id: poll.id, user_id: P.nico.id, response: "Nico", responded_at: at(-3, "08:00") }, { id: nid(), poll_id: poll.id, user_id: P.reto.id, response: "Nico", responded_at: at(-3, "09:15") }]);

// ── Chat channels (only when migration 0025 is applied) ────────────────────
// Group/event messages above reach the channels through the migration's forwarding triggers.
// No announcements here: those would push to the real members of the group.
if (chat) {
  const channels = {
    grundkurs: { id: nid(), kind: "group", group_id: G, name: "Grundkurs Herbst", description: "Fragen und Infos für den Grundkurs", audience: "students", audience_levels: ["ground"], created_by: P.reto.id },
    info: { id: nid(), kind: "group", group_id: G, name: "Info Vertical", description: "Wichtige Infos der Schule – hier schreibt nur das Team", audience: "all", staff_only_posting: true, created_by: P.reto.id },
    camp: { id: nid(), kind: "group", group_id: G, name: "Herbstcamp Tessin", description: "Organisation Camp Monte Lema", audience: "custom", created_by: P.lea.id },
  };
  ins("public.chat_channels", Object.values(channels));
  ins("public.chat_channel_members", [P.jonas, P.sara, P.laura, P.tim, P.lea, P.reto].map((u) => ({ channel_id: channels.camp.id, user_id: u.id, added_by: P.lea.id })));
  ins("public.chat_messages", [
    { id: nid(), channel_id: channels.grundkurs.id, user_id: P.reto.id, message: "Willkommen im Grundkurs! Hier klären wir alles rund um Übungshang und erste Höhenflüge.", created_at: at(-34, "19:00") },
    { id: nid(), channel_id: channels.grundkurs.id, user_id: P.lukas.id, message: "Brauche ich für den Übungshang schon ein Funkgerät?", created_at: at(-3, "18:12") },
    { id: nid(), channel_id: channels.grundkurs.id, user_id: P.lea.id, message: "Nein, am Übungshang nicht. Ab dem ersten Höhenflug bekommst du eines von der Schule.", created_at: at(-3, "18:40") },
    { id: nid(), channel_id: channels.info.id, user_id: P.reto.id, message: "Die Bahn Beatenberg fährt ab Oktober erst ab 08:30 – Treffpunkte entsprechend angepasst.", created_at: at(-4, "12:00") },
    { id: nid(), channel_id: channels.camp.id, user_id: P.lea.id, message: "Zimmereinteilung im Ostello folgt. Bitte bis Mittwoch melden, wer mit dem Auto fährt.", created_at: at(-2, "20:05") },
    { id: nid(), channel_id: channels.camp.id, user_id: P.tim.id, message: "Ich fahre ab Bern, 3 Plätze frei 🚗", created_at: at(-2, "20:30") },
  ]);
}

// ── Run ────────────────────────────────────────────────────────────────────
if (process.argv.includes("--print")) {
  // Review mode: only the read-only lookups above ran; write the SQL locally (git-ignored folder).
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync("docs/lovable-export.local", { recursive: true });
  writeFileSync("docs/lovable-export.local/seed-preview.sql", `BEGIN;\n${statements.join("\n")}\nCOMMIT;\n`);
  console.log(`SQL geschrieben: docs/lovable-export.local/seed-preview.sql (${statements.length} Anweisungen)`);
  process.exit(0);
}
await sql(`BEGIN;\n${statements.join("\n")}\nCOMMIT;`);
const [c] = await sql(`select
  (select count(*) from auth.users where id::text like '${PREFIX}%') konten,
  (select count(*) from public.flight_events where id::text like '${PREFIX}%') termine,
  (select count(*) from public.event_signups where id::text like '${PREFIX}%' and status = 'waitlist') warteliste,
  (select count(*) from public.flights where id::text like '${PREFIX}%') fluege,
  (select count(*) from public.school_equipment where id::text like '${PREFIX}%') material,
  (select count(*) from public.student_day_notes where id::text like '${PREFIX}%') notizen`);
console.log(`✔ Testdaten eingespielt: ${c.konten} Konten, ${c.termine} Termine (${c.warteliste} auf Warteliste), ${c.fluege} Flüge, ${c.material} Material, ${c.notizen} Tagesnotizen.`);
console.log("Entfernen vor dem Echtbetrieb: node scripts/seed-vertical-testdata.mjs --remove");
