import { supabase } from "@/integrations/supabase/client";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

interface CsvPlace { name: string | null; latitude: number | null; longitude: number | null; altitude: number | null }

export interface CsvFlight {
  id: string;
  flight_no: number;
  date: string;
  takeoff_at: string | null;
  landing_at: string | null;
  duration_minutes: number | null;
  distance_km: number | null;
  altitude_gain: number | null;
  glider: string | null;
  discipline: string | null;
  is_tandem: boolean;
  flight_kind: string | null;
  is_solo_shv: boolean;
  source: string | null;
  source_ref: string | null;
  thermals: string | null;
  wind_speed: number | null;
  wind_direction: string | null;
  comments: string | null;
  takeoff_location: CsvPlace | null;
  landing_location: CsvPlace | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  confirmation?: CsvConfirmation | CsvConfirmation[] | null;
  tandem_kind?: string | null;
  passenger?: CsvPassenger | CsvPassenger[] | null;
}

interface CsvPassenger { passenger_name: string; status: string; confirmed_at: string | null }

interface CsvConfirmation { status: string; school_name: string | null; instructor_name: string | null; decided_at: string | null }

export const CSV_HEADERS = [
  "flight_no", "date", "takeoff_at", "landing_at",
  "takeoff", "takeoff_lat", "takeoff_lng", "takeoff_altitude_m",
  "landing", "landing_lat", "landing_lng", "landing_altitude_m",
  "duration_minutes", "distance_km", "altitude_gain_m", "height_difference_m",
  "glider", "discipline", "is_tandem", "tandem_kind", "passenger", "passenger_status", "passenger_confirmed_at", "flight_kind", "is_solo_shv",
  "source", "source_ref", "confirmation_status", "confirmation_school", "confirmed_by", "confirmation_decided_at",
  "cancelled_at", "cancel_reason", "thermals", "wind_speed_kmh", "wind_direction", "comments", "id",
];

type Cell = string | number | boolean | null | undefined;

/** One export row per flight, in the column order of CSV_HEADERS (shared by CSV, Excel and the archive). */
export function flightRow(f: CsvFlight): Cell[] {
  const t = f.takeoff_location, l = f.landing_location;
  const diff = t?.altitude != null && l?.altitude != null ? t.altitude - l.altitude : null;
  const c = Array.isArray(f.confirmation) ? f.confirmation[0] : f.confirmation;
  const p = Array.isArray(f.passenger) ? f.passenger[0] : f.passenger;
  return [
    f.flight_no, f.date, f.takeoff_at, f.landing_at,
    t?.name, t?.latitude, t?.longitude, t?.altitude,
    l?.name, l?.latitude, l?.longitude, l?.altitude,
    f.duration_minutes, f.distance_km, f.altitude_gain, diff,
    f.glider, f.discipline, f.is_tandem ? "true" : "false", f.tandem_kind, p?.passenger_name, p?.status, p?.confirmed_at, f.flight_kind, f.is_solo_shv ? "true" : "false",
    f.source, f.source_ref, c?.status, c?.school_name, c?.instructor_name, c?.decided_at,
    f.cancelled_at, f.cancel_reason, f.thermals, f.wind_speed, f.wind_direction, f.comments, f.id,
  ];
}

const byNumber = (flights: CsvFlight[]) => [...flights].sort((a, b) => a.flight_no - b.flight_no);

/** The logbook as CSV (UTF-8 with BOM so Excel reads umlauts), in the order of the flight number. */
export function flightsCsv(flights: CsvFlight[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const f of byNumber(flights)) lines.push(flightRow(f).map(csvEscape).join(","));
  return "﻿" + lines.join("\n");
}

/** The same table as an Excel workbook (sheet "Flüge"); numbers stay numbers, empty cells stay empty. */
export async function flightsXlsx(flights: CsvFlight[]): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const rows = byNumber(flights).map((f) => flightRow(f).map((v) => (v === undefined ? null : v)));
  const sheet = XLSX.utils.aoa_to_sheet([CSV_HEADERS, ...rows]);
  sheet["!autofilter"] = { ref: sheet["!ref"] ?? "A1" };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Flüge");
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

const PAGE_SIZE = 1000;

/**
 * Reads all pages of a query. A single request stops at the API row limit (1000), and an export that
 * silently lacks rows must not happen; errors are thrown instead of returning a partial result.
 */
export async function fetchAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return all;
  }
}

const PLACE = "name:display_name, latitude, longitude, altitude";

export const FLIGHT_EXPORT_SELECT = `
      id, flight_no, date, takeoff_at, landing_at, duration_minutes, distance_km, altitude_gain, glider, discipline,
      is_tandem, flight_kind, is_solo_shv, source, source_ref, thermals, wind_speed, wind_direction, comments,
      cancelled_at, cancel_reason, tandem_kind, confirmation:flight_confirmations ( status, school_name, instructor_name, decided_at ),
      passenger:flight_passengers ( passenger_name, status, confirmed_at ),
      takeoff_location:locations!flights_takeoff_location_id_fkey ( ${PLACE} ),
      landing_location:locations!flights_landing_location_id_fkey ( ${PLACE} )
    `;

/** All own flights for the exports, in flight number order (all pages; errors are thrown). */
export function fetchExportFlights(userId: string): Promise<CsvFlight[]> {
  return fetchAllPages<CsvFlight>((from, to) => supabase
    .from("flights")
    .select(FLIGHT_EXPORT_SELECT)
    .eq("user_id", userId)
    .order("flight_no", { ascending: true })
    .range(from, to) as unknown as PromiseLike<{ data: CsvFlight[] | null; error: { message: string } | null }>);
}

export async function exportFlightsCsv(userId: string): Promise<{ rows: number; blob: Blob }> {
  const flights = await fetchExportFlights(userId);
  const blob = new Blob([flightsCsv(flights)], { type: "text/csv;charset=utf-8" });
  return { rows: flights.length, blob };
}

export async function exportFlightsXlsx(userId: string): Promise<{ rows: number; blob: Blob }> {
  const flights = await fetchExportFlights(userId);
  const blob = new Blob([await flightsXlsx(flights)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { rows: flights.length, blob };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
