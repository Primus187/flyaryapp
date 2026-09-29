import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { CSV_HEADERS, fetchAllPages, flightsCsv, type CsvFlight } from "./csv-export";

const flight = (no: number, extra: Partial<CsvFlight> = {}): CsvFlight => ({
  id: `f${no}`, flight_no: no, date: "2025-01-18", takeoff_at: null, landing_at: null, duration_minutes: 20, distance_km: null,
  altitude_gain: null, glider: "Advance Pi3", discipline: "paraglider", is_tandem: false, flight_kind: null, is_solo_shv: false,
  source: "manual", source_ref: null, thermals: null, wind_speed: null, wind_direction: null, comments: null,
  takeoff_location: { name: "SP Niederhorn", latitude: 46.7, longitude: 7.8, altitude: 1930 },
  landing_location: { name: "LP Lehn", latitude: 46.6, longitude: 7.8, altitude: 565 }, ...extra,
});

describe("flights CSV", () => {
  it("writes one row per flight in flight-number order with the height difference and origin", () => {
    const csv = flightsCsv([flight(2, { source: "flightbook", source_ref: "78", comments: 'Alleinflug, "gut"' }), flight(1)]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [header, first, second] = csv.slice(1).split("\n");
    expect(header.split(",")).toEqual(CSV_HEADERS);
    const cols = first.split(",");
    expect(cols[CSV_HEADERS.indexOf("flight_no")]).toBe("1");
    expect(cols[CSV_HEADERS.indexOf("height_difference_m")]).toBe("1365");
    expect(second).toContain('flightbook,78');
    expect(second).toContain('"Alleinflug, ""gut"""');
  });

  it("leaves the height difference empty when a site has no height", () => {
    const csv = flightsCsv([flight(1, { landing_location: null })]);
    const cols = csv.slice(1).split("\n")[1].split(",");
    expect(cols[CSV_HEADERS.indexOf("height_difference_m")]).toBe("");
  });
});

describe("fetchAllPages", () => {
  it("keeps reading while pages are full", async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => i);
    const page = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
    expect(await fetchAllPages(page)).toHaveLength(2345);
    expect(page).toHaveBeenCalledTimes(3);
  });

  it("throws instead of returning a partial export", async () => {
    let call = 0;
    const page = async () => (++call === 1 ? { data: Array(1000).fill(0), error: null } : { data: null, error: { message: "timeout" } });
    await expect(fetchAllPages(page)).rejects.toThrow("timeout");
  });
});
