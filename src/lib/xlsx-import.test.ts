import { describe, expect, it } from "vitest";
import { parseDate, parseRows } from "./xlsx-import";

describe("parseDate", () => {
  it("reads Swiss and ISO dates", () => {
    expect(parseDate("18.01.2025")).toBe("2025-01-18");
    expect(parseDate("5.8.2024")).toBe("2024-08-05");
    expect(parseDate("2025-01-18")).toBe("2025-01-18");
  });

  it("keeps the calendar day of a date cell at local midnight", () => {
    expect(parseDate(new Date(2025, 0, 18))).toBe("2025-01-18");
    expect(parseDate(new Date(2025, 0, 17, 23, 59, 43))).toBe("2025-01-18");
  });

  it("returns null instead of inventing a date", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate("gestern")).toBeNull();
    expect(parseDate("31.02.2025")).toBeNull();
    expect(parseDate(new Date("invalid"))).toBeNull();
  });
});

describe("parseRows", () => {
  it("maps a Flightbook row and keeps its number", () => {
    const { flights, invalidRows } = parseRows([
      { Nr: 78, Datum: "18.01.2025", Gleitschirm: "Advance Pi3 21 Fire", Start: "SP Niederhorn", Landung: "LP Lehn", Flugdauer: "00:20:00", Km: "10", Beschreibung: "Alleinflug" },
    ]);
    expect(invalidRows).toEqual([]);
    expect(flights[0]).toMatchObject({
      date: "2025-01-18", takeoff: "Niederhorn", landing: "Lehn", durationMinutes: 20, distanceKm: 10,
      glider: "Advance Pi3 21 Fire", comments: "Alleinflug", sourceRef: "78",
    });
  });

  it("reports rows with an unreadable date and skips rows without a date", () => {
    const { flights, invalidRows } = parseRows([
      { Nr: 1, Datum: "05.08.2024" },
      { Nr: 2, Datum: "irgendwann" },
      { Nr: 3 },
      { Datum: "07.09.2024" },
    ]);
    expect(flights.map((f) => f.sourceRef)).toEqual(["1", null]);
    expect(invalidRows).toEqual([3]);
  });
});
