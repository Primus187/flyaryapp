import { describe, expect, it } from "vitest";
import { linksPayload, setLink, suggestLinks, type ImportCandidate, type ImportFlight } from "./school-flight-match";

const flight = (id: string, number: number): ImportFlight => ({ id, number, startedAt: null, landedAt: null, takeoff: null, landing: null });
const own = (id: string, createdAt: string): ImportCandidate => ({ id, createdAt, durationMinutes: null, takeoff: null });

describe("suggestLinks", () => {
  it("pairs school flights with own entries in order", () => {
    expect(suggestLinks({ flights: [flight("s2", 2), flight("s1", 1)], candidates: [own("b", "2026-09-25T18:00:00Z"), own("a", "2026-09-25T17:00:00Z")] }))
      .toEqual({ s1: "a", s2: "b" });
  });

  it("creates new entries for school flights beyond the own ones", () => {
    expect(suggestLinks({ flights: [flight("s1", 1), flight("s2", 2), flight("s3", 3)], candidates: [own("a", "2026-09-25T17:00:00Z")] }))
      .toEqual({ s1: "a", s2: null, s3: null });
  });

  it("leaves extra own entries untouched and works without any", () => {
    expect(suggestLinks({ flights: [flight("s1", 1)], candidates: [own("a", "1"), own("b", "2")] })).toEqual({ s1: "a" });
    expect(suggestLinks({ flights: [flight("s1", 1)], candidates: [] })).toEqual({ s1: null });
  });
});

describe("setLink", () => {
  it("frees an own entry that is picked for another school flight", () => {
    expect(setLink({ s1: "a", s2: null }, "s2", "a")).toEqual({ s1: null, s2: "a" });
    expect(setLink({ s1: "a", s2: "b" }, "s1", null)).toEqual({ s1: null, s2: "b" });
  });

  it("builds the payload", () => {
    expect(linksPayload({ s1: "a", s2: null })).toEqual([{ schoolFlightId: "s1", flightId: "a" }, { schoolFlightId: "s2", flightId: null }]);
  });
});
