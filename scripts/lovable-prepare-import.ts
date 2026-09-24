// One-off (leaving Lovable): builds an import plan for one pilot from
//   docs/lovable-export.local/flights.csv          (CSV export from the old app's settings)
//   docs/lovable-export.local/files/<bucket>/...   (storage backup; folders = old flight ids)
// Run: npx tsx scripts/lovable-prepare-import.ts  -> docs/lovable-export.local/import-plan.json
// Only reads local files. The plan uses "__USER__" as user id; the import script fills it in.
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { parseIGC, type IGCData } from "../src/lib/igc-parser";

const DIR = "docs/lovable-export.local";
const FILES = `${DIR}/files`;
const USER = "__USER__";

// ── CSV (RFC 4180: quoted fields may contain commas, quotes and newlines) ──
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}
const num = (v: string) => (v.trim() === "" ? null : Number(v));
const int = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));

// The app's CSV export starts with a UTF-8 BOM (for Excel); strip it or "date" is not found.
const csv = parseCsv(readFileSync(`${DIR}/flights.csv`, "utf8").replace(/^\uFEFF/, ""));

// ── Locations: one per (name, lat, lng); type from how the flights use it ──
type Loc = { id: string; user_id: string; name: string; latitude: number; longitude: number; type: string; roles: Set<string> };
const locations = new Map<string, Loc>();
function location(name: string, lat: string, lng: string, role: "takeoff" | "landing") {
  if (!name.trim() || lat.trim() === "" || lng.trim() === "") return null;
  const key = `${name.trim()}|${Number(lat).toFixed(6)}|${Number(lng).toFixed(6)}`;
  let loc = locations.get(key);
  if (!loc) {
    loc = { id: randomUUID(), user_id: USER, name: name.trim(), latitude: Number(lat), longitude: Number(lng), type: role, roles: new Set() };
    locations.set(key, loc);
  }
  loc.roles.add(role);
  return loc.id;
}

type Flight = Record<string, unknown> & { id: string; date: string; duration_minutes: number | null; _source: string };
const flights: Flight[] = csv.map((r, i) => ({
  id: randomUUID(),
  user_id: USER,
  date: r.date,
  takeoff_location_id: location(r.takeoff, r.takeoff_lat, r.takeoff_lng, "takeoff"),
  landing_location_id: location(r.landing, r.landing_lat, r.landing_lng, "landing"),
  duration_minutes: int(r.duration_minutes),
  distance_km: num(r.distance_km),
  altitude_gain: int(r.altitude_gain_m),
  glider: r.glider.trim() || null,
  thermals: r.thermals.trim() || null,
  wind_speed: int(r.wind_speed_kmh),
  wind_direction: r.wind_direction.trim() || null,
  is_solo_shv: r.is_solo_shv === "true",
  comments: r.comments.trim() || null,
  _source: `CSV Zeile ${i + 2}`,
}));
for (const loc of locations.values()) loc.type = loc.roles.size > 1 ? "both" : [...loc.roles][0];

// ── Storage backup, grouped by old flight id (path: <oldUser>/<flightId>/<file>) ──
type File = { bucket: string; rel: string; name: string; size: number };
const hashOf = (rel: string) => createHash("sha256").update(readFileSync(`${FILES}/${rel}`)).digest("hex");
const folders = new Map<string, File[]>();
const rootFiles: File[] = [];
for (const bucket of ["flight-photos", "igc-files", "flight-videos"]) {
  if (!existsSync(`${FILES}/${bucket}`)) continue;
  for (const user of readdirSync(`${FILES}/${bucket}`)) {
    for (const entry of readdirSync(`${FILES}/${bucket}/${user}`)) {
      const path = `${bucket}/${user}/${entry}`;
      if (statSync(`${FILES}/${path}`).isFile()) { rootFiles.push({ bucket, rel: path, name: entry, size: statSync(`${FILES}/${path}`).size }); continue; }
      for (const name of readdirSync(`${FILES}/${path}`)) {
        const rel = `${path}/${name}`;
        (folders.get(entry) ?? folders.set(entry, []).get(entry)!).push({ bucket, rel, name, size: statSync(`${FILES}/${rel}`).size });
      }
    }
  }
}

// ── Match IGC folders to CSV flights: same date, closest duration ──
function trackData(igc: IGCData) {
  const step = Math.max(1, Math.floor(igc.points.length / 2000));
  return {
    points: igc.points.filter((_, i) => i % step === 0).map((p) => ({ lat: p.lat, lng: p.lng, altitude: p.altitude || 0, time: p.time || "" })),
    stats: { maxAltitude: igc.maxAltitude, minAltitude: igc.minAltitude, maxClimbRate: igc.maxClimbRate, maxSinkRate: igc.maxSinkRate,
      avgSpeedKmh: igc.avgSpeedKmh, totalDistanceKm: igc.totalDistanceKm, xcDistanceKm: igc.xcDistanceKm, xcOptimization: igc.xcOptimization,
      startTime: igc.startTime, endTime: igc.endTime, durationMinutes: igc.durationMinutes },
  };
}
const flightFolder = new Map<string, string>(); // flight id -> folder
const folderFlight = new Map<string, string>(); // folder -> flight id (duplicate tracks share one flight)
const trackByHash = new Map<string, string>(); // IGC content hash -> flight id
const report: string[] = [];
const igc_tracks: Record<string, unknown>[] = [];
for (const [folder, files] of folders) {
  const igcFile = files.find((f) => f.bucket === "igc-files");
  if (!igcFile) continue;
  // The old app sometimes stored the same flight twice (identical IGC file): keep one flight.
  const hash = hashOf(igcFile.rel);
  if (trackByHash.has(hash)) {
    folderFlight.set(folder, trackByHash.get(hash)!);
    report.push(`IGC ${igcFile.name}: identisch mit bereits zugeordnetem Track -> Duplikat, Medien gehen an denselben Flug`);
    continue;
  }
  const igc = parseIGC(readFileSync(`${FILES}/${igcFile.rel}`, "utf8"));
  const candidates = flights.filter((f) => f.date === igc.date && !flightFolder.has(f.id));
  let flight = candidates.sort((a, b) => Math.abs((a.duration_minutes ?? 0) - igc.durationMinutes) - Math.abs((b.duration_minutes ?? 0) - igc.durationMinutes))[0];
  if (!flight) {
    flight = { id: folder, user_id: USER, date: igc.date ?? "", duration_minutes: igc.durationMinutes, altitude_gain: igc.maxAltitude - igc.minAltitude,
      distance_km: igc.xcDistanceKm || null, glider: igc.glider || null, _source: `nur IGC (${igcFile.name})` } as Flight;
    flights.push(flight);
    report.push(`IGC ${igc.date} ${igc.durationMinutes} min: kein CSV-Flug an diesem Tag -> neuer Flug aus dem Track`);
  } else {
    report.push(`IGC ${igc.date} ${igc.durationMinutes} min -> ${flight._source} (${flight.duration_minutes ?? "?"} min, ${candidates.length} Flüge an dem Tag)`);
  }
  flight.id = folder; // keep the old flight id: it is also the storage folder of its media
  flightFolder.set(flight.id, folder);
  folderFlight.set(folder, folder);
  trackByHash.set(hash, folder);
  igc_tracks.push({ flight_id: folder, storage_path: `${USER}/${folder}/${igcFile.name}`, track_data: trackData(igc) });
}

// ── Photos/videos: IGC folders attach to their flight; photo-only folders only when the upload
//    day has exactly one CSV flight (upload timestamp is the file-name prefix) ──
const flight_photos: Record<string, unknown>[] = [];
const flight_videos: Record<string, unknown>[] = [];
const uploads: { bucket: string; src: string; dest: string }[] = [];
const unassigned: string[] = [];
const photoByHash = new Map<string, string>(); // photo content hash -> folder it was first seen in
// Folders with a track first, so duplicate photos in photo-only folders are recognised.
const ordered = [...folders].sort(([a], [b]) => Number(folderFlight.has(b)) - Number(folderFlight.has(a)));
for (const [folder, allFiles] of ordered) {
  const files = allFiles.filter((f) => {
    if (f.bucket !== "flight-photos") return true;
    const h = hashOf(f.rel);
    if (photoByHash.has(h)) return false; // same picture uploaded again (also within one folder)
    photoByHash.set(h, folder);
    return true;
  });
  if (files.length === 0) { report.push(`Fotos ohne Track (${folder.slice(0, 8)}): alle bereits als Duplikat vorhanden`); continue; }
  let flightId = folderFlight.get(folder) ?? null;
  if (!flightId) {
    const ts = Number(files.map((f) => f.name.match(/^(\d{12,})/)?.[1]).find(Boolean));
    const day = ts ? new Date(ts).toISOString().slice(0, 10) : null;
    const sameDay = flights.filter((f) => f.date === day);
    if (sameDay.length === 1) {
      flightId = sameDay[0].id;
      report.push(`Fotos ohne Track (${folder.slice(0, 8)}, hochgeladen ${day}) -> ${sameDay[0]._source}`);
    } else {
      unassigned.push(`${folder.slice(0, 8)}: ${files.length} Fotos, hochgeladen ${day} (${sameDay.length} Flüge an dem Tag)`);
      continue;
    }
  }
  for (const f of files) {
    const dest = `${USER}/${flightId}/${f.name}`;
    if (f.bucket === "flight-photos") { flight_photos.push({ flight_id: flightId, storage_path: dest }); uploads.push({ bucket: f.bucket, src: f.rel, dest }); }
    if (f.bucket === "igc-files") uploads.push({ bucket: f.bucket, src: f.rel, dest });
    if (f.bucket === "flight-videos") {
      uploads.push({ bucket: f.bucket, src: f.rel, dest });
      if (/\.(mp4|mov|webm)$/i.test(f.name)) {
        const poster = files.find((p) => p.bucket === "flight-videos" && p.name === f.name.replace(/\.\w+$/, ".jpg"));
        flight_videos.push({ flight_id: flightId, storage_path: dest, poster_path: poster ? `${USER}/${flightId}/${poster.name}` : null, size_bytes: f.size });
      }
    }
  }
}

// ── Profile pictures ──
const profile: Record<string, string> = {};
for (const f of rootFiles) {
  const dest = `${USER}/${f.name}`;
  uploads.push({ bucket: f.bucket, src: f.rel, dest });
  if (f.name.startsWith("avatar")) profile.avatar_url = dest;
  if (f.name.startsWith("cover")) profile.cover_photo_url = dest;
}

const plan = {
  createdAt: new Date().toISOString(),
  locations: [...locations.values()].map(({ roles: _roles, ...l }) => l),
  flights: flights.map(({ _source: _s, ...f }) => f),
  igc_tracks, flight_photos, flight_videos, profile, uploads, unassigned,
};
writeFileSync(`${DIR}/import-plan.json`, JSON.stringify(plan));
console.log(report.join("\n"));
console.log(`\nFlüge: ${plan.flights.length} | Orte: ${plan.locations.length} | Tracks: ${igc_tracks.length} | Fotos: ${flight_photos.length} | Videos: ${flight_videos.length} | Profilbilder: ${Object.keys(profile).length} | Dateien hochzuladen: ${uploads.length}`);
console.log(`Nicht zugeordnet (bleiben in docs/lovable-export.local/files): ${unassigned.length ? "\n  " + unassigned.join("\n  ") : "keine"}`);
