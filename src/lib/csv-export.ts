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
}

interface CsvConfirmation { status: string; school_name: string | null; instructor_name: string | null; decided_at: string | null }

export const CSV_HEADERS = [
  "flight_no", "date", "takeoff_at", "landing_at",
  "takeoff", "takeoff_lat", "takeoff_lng", "takeoff_altitude_m",
  "landing", "landing_lat", "landing_lng", "landing_altitude_m",
  "duration_minutes", "distance_km", "altitude_gain_m", "height_difference_m",
  "glider", "discipline", "is_tandem", "flight_kind", "is_solo_shv",
  "source", "source_ref", "confirmation_status", "confirmation_school", "confirmed_by", "confirmation_decided_at",
  "cancelled_at", "cancel_reason", "thermals", "wind_speed_kmh", "wind_direction", "comments", "id",
];

/** The logbook as CSV (UTF-8 with BOM so Excel reads umlauts), in the order of the flight number. */
export function flightsCsv(flights: CsvFlight[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const f of [...flights].sort((a, b) => a.flight_no - b.flight_no)) {
    const t = f.takeoff_location, l = f.landing_location;
    const diff = t?.altitude != null && l?.altitude != null ? t.altitude - l.altitude : null;
    const c = Array.isArray(f.confirmation) ? f.confirmation[0] : f.confirmation;
    lines.push([
      f.flight_no, f.date, f.takeoff_at, f.landing_at,
      t?.name, t?.latitude, t?.longitude, t?.altitude,
      l?.name, l?.latitude, l?.longitude, l?.altitude,
      f.duration_minutes, f.distance_km, f.altitude_gain, diff,
      f.glider, f.discipline, f.is_tandem ? "true" : "false", f.flight_kind, f.is_solo_shv ? "true" : "false",
      f.source, f.source_ref, c?.status, c?.school_name, c?.instructor_name, c?.decided_at,
      f.cancelled_at, f.cancel_reason, f.thermals, f.wind_speed, f.wind_direction, f.comments, f.id,
    ].map(csvEscape).join(","));
  }
  return "﻿" + lines.join("\n");
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

export async function exportFlightsCsv(userId: string): Promise<{ rows: number; blob: Blob }> {
  const flights = await fetchAllPages<CsvFlight>((from, to) => supabase
    .from("flights")
    .select(`
      id, flight_no, date, takeoff_at, landing_at, duration_minutes, distance_km, altitude_gain, glider, discipline,
      is_tandem, flight_kind, is_solo_shv, source, source_ref, thermals, wind_speed, wind_direction, comments,
      cancelled_at, cancel_reason, confirmation:flight_confirmations ( status, school_name, instructor_name, decided_at ),
      takeoff_location:locations!flights_takeoff_location_id_fkey ( ${PLACE} ),
      landing_location:locations!flights_landing_location_id_fkey ( ${PLACE} )
    `)
    .eq("user_id", userId)
    .order("flight_no", { ascending: true })
    .range(from, to) as unknown as PromiseLike<{ data: CsvFlight[] | null; error: { message: string } | null }>);

  const blob = new Blob([flightsCsv(flights)], { type: "text/csv;charset=utf-8" });
  return { rows: flights.length, blob };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
