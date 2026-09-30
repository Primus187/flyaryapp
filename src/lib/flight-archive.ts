/**
 * Complete personal archive (Flightbook replacement step 5): everything needed to keep one's logbook
 * independently of Flyary, as one ZIP file.
 *
 *   README.txt      what is inside, in plain words
 *   manifest.json   export time, counts and a SHA-256 checksum of every file
 *   flyary.json     all data with IDs: flights, change history, confirmations and their events,
 *                   passengers, IGC track list, licences, evidence, gear, places, training status
 *   flights.csv / flights.xlsx / flugbuch.pdf   the logbook as table and as printable proof
 *   igc/…           every original IGC file;  photos/…  optional
 *
 * Every read goes through all pages; a missing file or a flight count that differs from the server
 * aborts the export instead of producing an archive that silently lacks data.
 */
import { zipSync, strToU8 } from "fflate";
import { supabase } from "@/integrations/supabase/client";
import { LICENCES } from "@/lib/training-status";
import { fetchAllPages, fetchExportFlights, flightsCsv, flightsXlsx, type CsvFlight } from "@/lib/csv-export";

export const ARCHIVE_FORMAT = "flyary-archive/1";

export interface ArchiveFile { path: string; data: Uint8Array }
export interface ManifestEntry { path: string; bytes: number; sha256: string }
export type ArchiveProgress = (stage: "data" | "igc" | "photos" | "pdf" | "zip", done: number, total: number) => void;

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const safe = (s: string) => s.replace(/[^\w.-]+/g, "_");

/** igc/0042_2026-09-22.igc; a second track of the same flight gets a suffix. */
export function igcPath(flightNo: number | null | undefined, date: string | null | undefined, taken: Set<string>): string {
  const base = `igc/${String(flightNo ?? 0).padStart(4, "0")}_${safe(date ?? "ohne-datum")}`;
  let path = `${base}.igc`;
  for (let i = 2; taken.has(path); i++) path = `${base}_${i}.igc`;
  taken.add(path);
  return path;
}

/** The export must contain exactly as many flights as the server holds. */
export function assertComplete(serverCount: number | null, exported: number): void {
  if (serverCount === null || serverCount !== exported) {
    throw new Error(`Export incomplete: ${exported} of ${serverCount ?? "?"} flights read`);
  }
}

/** Packs the files, adds manifest.json with checksums and returns the ZIP bytes. */
export async function packArchive(files: ArchiveFile[], meta: Record<string, unknown>): Promise<{ zip: Uint8Array; manifest: { files: ManifestEntry[] } & Record<string, unknown> }> {
  const entries: ManifestEntry[] = [];
  for (const f of files) entries.push({ path: f.path, bytes: f.data.byteLength, sha256: await sha256Hex(f.data) });
  const manifest = { format: ARCHIVE_FORMAT, ...meta, files: entries };
  const tree: Record<string, Uint8Array> = {};
  for (const f of files) tree[f.path] = f.data;
  tree["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  return { zip: zipSync(tree, { level: 6 }), manifest };
}

const README = (exportedAt: string, flights: number, igcs: number, photos: number | null) => `Flyary – vollständiges Archiv deines Flugtagebuchs
Erstellt: ${exportedAt}

Inhalt
- flugbuch.pdf      Flugbuch zum Ausdrucken (Stempel und Unterschrift der Flugschule pro Seite)
- flights.csv       alle Flüge als Tabelle (UTF-8), gleiche Spalten wie flights.xlsx
- flights.xlsx      alle Flüge für Excel
- flyary.json       alle Daten mit IDs: Flüge, Änderungshistorie, Bestätigungen samt Verlauf,
                    Passagiere, Pilotenausweise, Nachweise, Geräte, Orte und Ausbildungsstand
- igc/              ${igcs} Original-IGC-Dateien (Name: Flugnummer_Datum.igc)
${photos === null ? "" : `- photos/           ${photos} Fotos (Name: Flugnummer_Datum_n)\n`}- manifest.json     Anzahl Einträge und SHA-256-Prüfsumme jeder Datei

${flights} Flüge. Der Ausbildungsstand in flyary.json ist der Stand zum Zeitpunkt des Exports;
spätere Bestätigungen oder Widerrufe sind darin nicht enthalten.
`;

type Rows = Record<string, unknown>[];
const inChunks = async <T,>(ids: string[], read: (chunk: string[]) => Promise<T[]>): Promise<T[]> => {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 150) out.push(...await read(ids.slice(i, i + 150)));
  return out;
};
const pages = (table: string, select: string, column: string, value: string, order = "id") =>
  fetchAllPages<Record<string, unknown>>((from, to) => supabase.from(table as never).select(select)
    .eq(column, value).order(order, { ascending: true }).range(from, to) as unknown as PromiseLike<{ data: Rows | null; error: { message: string } | null }>);
const byFlights = (table: string, select: string, flightIds: string[]) => inChunks(flightIds, async (chunk) =>
  fetchAllPages<Record<string, unknown>>((from, to) => supabase.from(table as never).select(select)
    .in("flight_id", chunk).order("id", { ascending: true }).range(from, to) as unknown as PromiseLike<{ data: Rows | null; error: { message: string } | null }>));

async function download(bucket: string, path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`${bucket}/${path}: ${error?.message ?? "missing"}`);
  return new Uint8Array(await data.arrayBuffer());
}

export interface CollectOptions {
  userId: string;
  email: string | null;
  includePhotos: boolean;
  fetchPdf: () => Promise<Uint8Array>;
  onProgress?: ArchiveProgress;
}

/** Reads everything and returns the ZIP. Throws on any missing piece. */
export async function buildFlightArchive(o: CollectOptions): Promise<{ zip: Uint8Array; flights: number; igcs: number; photos: number }> {
  const progress = o.onProgress ?? (() => {});
  const exportedAt = new Date().toISOString();
  progress("data", 0, 1);

  const flights: CsvFlight[] = await fetchExportFlights(o.userId);
  const { count, error: countError } = await supabase.from("flights").select("id", { count: "exact", head: true }).eq("user_id", o.userId);
  if (countError) throw new Error(countError.message);
  assertComplete(count, flights.length);

  const fullFlights = await pages("flights", "*", "user_id", o.userId, "flight_no");
  assertComplete(count, fullFlights.length);
  const flightIds = fullFlights.map((f) => String(f.id));
  const numberOf = new Map(fullFlights.map((f) => [String(f.id), { no: f.flight_no as number, date: f.date as string }]));

  const [changes, confirmations, events, passengers, tracks, photos, licences, evidence, gear, places] = await Promise.all([
    pages("flight_changes", "id, flight_id, field, old_value, new_value, changed_by, origin, changed_at", "user_id", o.userId),
    pages("flight_confirmations", "id, flight_id, group_id, school_name, status, instructor_id, instructor_name, instructor_cert, confirmed_data, reason, submitted_at, decided_at, updated_at, solo_checklist", "student_id", o.userId),
    pages("flight_confirmation_events", "id, flight_id, group_id, action, actor_id, actor_name, reason, created_at", "student_id", o.userId),
    pages("flight_passengers", "id, flight_id, passenger_user_id, passenger_name, status, confirmed_at, confirmed_data, created_at, updated_at", "pilot_id", o.userId),
    byFlights("igc_tracks", "id, flight_id, storage_path, created_at", flightIds),
    o.includePhotos ? byFlights("flight_photos", "id, flight_id, storage_path, created_at", flightIds) : Promise.resolve([] as Rows),
    pages("pilot_licences", "*", "user_id", o.userId),
    pages("pilot_evidence", "*", "user_id", o.userId),
    pages("pilot_gliders", "*", "user_id", o.userId),
    pages("locations", "*", "user_id", o.userId),
  ]);

  const trainingStatus: Record<string, unknown>[] = [];
  for (const [discipline, licences] of Object.entries(LICENCES)) {
    for (const licence of licences) {
      const { data, error } = await supabase.rpc("training_status" as never, { _user_id: o.userId, _discipline: discipline, _licence: licence } as never);
      if (error) throw new Error(`training_status ${discipline}/${licence}: ${error.message}`);
      trainingStatus.push({ discipline, licence, status: data });
    }
  }
  progress("data", 1, 1);

  const files: ArchiveFile[] = [];
  const taken = new Set<string>();
  const trackFiles: Record<string, unknown>[] = [];
  for (let i = 0; i < tracks.length; i++) {
    progress("igc", i, tracks.length);
    const t = tracks[i];
    const n = numberOf.get(String(t.flight_id));
    const path = igcPath(n?.no, n?.date, taken);
    files.push({ path, data: await download("igc-files", String(t.storage_path)) });
    trackFiles.push({ ...t, file: path });
  }
  progress("igc", tracks.length, tracks.length);

  const photoFiles: Record<string, unknown>[] = [];
  for (let i = 0; i < photos.length; i++) {
    progress("photos", i, photos.length);
    const ph = photos[i];
    const n = numberOf.get(String(ph.flight_id));
    const ext = (String(ph.storage_path).match(/\.(\w{2,5})$/)?.[1] ?? "jpg").toLowerCase();
    const path = `photos/${String(n?.no ?? 0).padStart(4, "0")}_${safe(n?.date ?? "ohne-datum")}_${i + 1}.${ext}`;
    files.push({ path, data: await download("flight-photos", String(ph.storage_path)) });
    photoFiles.push({ ...ph, file: path });
  }
  if (photos.length) progress("photos", photos.length, photos.length);

  progress("pdf", 0, 1);
  const pdf = await o.fetchPdf();
  progress("pdf", 1, 1);

  const json = {
    format: ARCHIVE_FORMAT, exported_at: exportedAt, user: { id: o.userId, email: o.email },
    flights: fullFlights, flight_changes: changes, confirmations, confirmation_events: events, passengers,
    igc_tracks: trackFiles, photos: o.includePhotos ? photoFiles : undefined,
    licences, evidence, gear, places, training_status: trainingStatus,
  };
  files.unshift(
    { path: "README.txt", data: strToU8(README(exportedAt, flights.length, tracks.length, o.includePhotos ? photos.length : null)) },
    { path: "flyary.json", data: strToU8(JSON.stringify(json, null, 2)) },
    { path: "flights.csv", data: strToU8(flightsCsv(flights)) },
    { path: "flights.xlsx", data: await flightsXlsx(flights) },
    { path: "flugbuch.pdf", data: pdf },
  );

  progress("zip", 0, 1);
  const { zip } = await packArchive(files, {
    exported_at: exportedAt, user_id: o.userId,
    counts: { flights: flights.length, confirmed: confirmations.filter((c) => c.status === "confirmed").length, igc_files: tracks.length, photos: photos.length, changes: changes.length },
  });
  progress("zip", 1, 1);
  return { zip, flights: flights.length, igcs: tracks.length, photos: photos.length };
}
