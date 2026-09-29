import { describe, expect, it } from "vitest";
import {
  aircraftColumnLabel, confirmationLabel, flownSites, hasConfirmations, heightDifference, logbookSummary, pageLabel, passengerText, printableFlights,
  sortForPrint, summaryLines, type LogbookFlight, type LogbookPlace,
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

  it("leaves cancelled flights out and labels confirmed ones with initials and date", () => {
    const confirmed = flight(bergbo, lehn, { confirmation: { status: "confirmed", instructor_name: "Iris  Beatrice Keller", decided_at: "2025-03-12T10:00:00Z" } });
    const asArray = flight(bergbo, lehn, { confirmation: [{ status: "confirmed", instructor_name: null, decided_at: null }] });
    const revoked = flight(bergbo, lehn, { confirmation: { status: "revoked", instructor_name: "Iris", decided_at: "2025-03-12T10:00:00Z" } });
    const cancelled = flight(bergbo, lehn, { cancelled_at: "2025-04-01T00:00:00Z" });
    expect(printableFlights([confirmed, cancelled]).map((f) => f.id)).toEqual([confirmed.id]);
    expect(confirmationLabel(confirmed)).toBe("IBK 12.03.25");
    expect(confirmationLabel(asArray)).toBe("ja");
    expect(confirmationLabel(revoked)).toBe("");
    expect(hasConfirmations([revoked, cancelled])).toBe(false);
    expect(hasConfirmations([revoked, confirmed])).toBe(true);
  });

  it("names the tandem passenger and whether they confirmed", () => {
    expect(passengerText(flight(bergbo, lehn, { passenger: { passenger_name: "Anna", status: "confirmed", confirmed_at: "2025-03-12T10:00:00Z" } })))
      .toBe("Passagier: Anna (bestätigt 12.03.25)");
    expect(passengerText(flight(bergbo, lehn, { passenger: [{ passenger_name: "Gast", status: "pending", confirmed_at: null }] }))).toBe("Passagier: Gast");
    expect(passengerText(flight(bergbo, lehn))).toBe("");
  });

  it("labels pages with the total", () => {
    expect(pageLabel(3, 15)).toBe("3/15");
  });
});
