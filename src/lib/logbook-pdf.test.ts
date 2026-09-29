import { describe, expect, it } from "vitest";
import {
  aircraftColumnLabel, flownSites, heightDifference, logbookSummary, pageLabel, sortForPrint, summaryLines, type LogbookFlight, type LogbookPlace,
} from "../../supabase/functions/export-flightbook-pdf/logbook";

const place = (id: string, name: string, altitude: number | null, official: string | null = null): LogbookPlace =>
  ({ id, name, altitude, country_code: "ch", description: null, official_site_id: official });
const bergbo = place("p1", "SP Bergbo", 1289, "dhv-1");
const bergboOwn = place("p9", "Bergbo (mein Name)", 1289, "dhv-1");
const lehn = place("p2", "LP Lehn", 565);
const niederhorn = place("p3", "SP Niederhorn", 1930);
const boezWest = place("p4", "SP Bözingenberg West", 906);
const unknown = place("p5", "Wiese", null);

let no = 0;
const flight = (takeoff: LogbookPlace | null, landing: LogbookPlace | null, extra: Partial<LogbookFlight> = {}): LogbookFlight => ({
  id: `f${++no}`, flight_no: no, date: "2025-01-01", glider: "Advance Pi3", discipline: "paraglider", duration_minutes: 10,
  distance_km: null, altitude_gain: null, comments: null, group_id: null, is_solo_shv: false, takeoff, landing, ...extra,
});

describe("logbook PDF", () => {
  it("prints in the order of the stable flight number, not of the date", () => {
    const flights = [flight(bergbo, lehn, { flight_no: 3, date: "2024-01-01" }), flight(bergbo, lehn, { flight_no: 1, date: "2025-01-01" })];
    expect(sortForPrint(flights).map((f) => f.flight_no)).toEqual([1, 3]);
  });

  it("lists only sites actually flown, one official site once, a top landing among the landing sites", () => {
    const flights = [flight(bergbo, lehn), flight(bergboOwn, lehn), flight(niederhorn, lehn), flight(boezWest, boezWest), flight(null, null)];
    const { takeoffs, landings } = flownSites(flights);
    expect(takeoffs.map((p) => p.name)).toEqual(["SP Bergbo", "SP Niederhorn", "SP Bözingenberg West"]);
    expect(landings.map((p) => p.name)).toEqual(["LP Lehn", "SP Bözingenberg West"]);
  });

  it("computes Diff. from the site heights like Flightbook", () => {
    expect(heightDifference(flight(bergbo, lehn))).toBe(724);
    expect(heightDifference(flight(boezWest, boezWest))).toBe(0);
    expect(heightDifference(flight(bergbo, unknown))).toBeNull();
    expect(heightDifference(flight(null, lehn))).toBeNull();
  });

  it("summarises the cover page like the Flightbook printout", () => {
    const flights = [flight(bergbo, lehn, { duration_minutes: 20, is_solo_shv: true }), flight(niederhorn, lehn, { duration_minutes: 47 })];
    expect(summaryLines(logbookSummary(flights))).toEqual([
      "Anzahl Startplätze: 2", "Anzahl Landeplätze: 1", "Anzahl Flüge: 2", "Flugstunden: 01:07:00", "Anzahl Alleinflüge: 1",
    ]);
  });

  it("names the aircraft column after the disciplines printed", () => {
    expect(aircraftColumnLabel([{ discipline: "paraglider" }])).toBe("Gleitschirm");
    expect(aircraftColumnLabel([{ discipline: "hangglider" }])).toBe("Delta");
    expect(aircraftColumnLabel([{ discipline: "paraglider" }, { discipline: "hangglider" }])).toBe("Fluggerät");
    expect(aircraftColumnLabel([])).toBe("Gleitschirm");
  });

  it("labels pages with the total", () => {
    expect(pageLabel(3, 15)).toBe("3/15");
  });
});
