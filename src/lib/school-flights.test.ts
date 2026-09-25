import { describe, expect, it } from "vitest";
import {
  airborneMinutes, appendSnippet, boardAction, flightCountByStudent, flightDurationMinutes, flightNumbers, flightsInAir, landingHintDue,
  latestFlight, ratingsPayload, schoolFlightErrorKey, takeoffAction, toggleRating,
  type SchoolFlight,
} from "./school-flights";

const flight = (patch: Partial<SchoolFlight>): SchoolFlight => ({
  id: "f", student_user_id: "anna", seq: 1, status: "landed", started_at: null, landed_at: "2026-09-25T10:00:00Z", ...patch,
});
const now = new Date("2026-09-25T10:30:00Z");

describe("flightNumbers", () => {
  it("numbers per student consecutively, skipping aborted launches and seq gaps", () => {
    const flights = [
      flight({ id: "a3", seq: 4 }),
      flight({ id: "a1", seq: 1 }),
      flight({ id: "a-abort", seq: 2, status: "aborted", landed_at: null }),
      flight({ id: "b1", student_user_id: "beat", seq: 1, status: "in_air", started_at: "2026-09-25T10:20:00Z", landed_at: null }),
    ];
    expect(flightNumbers(flights)).toEqual({ a1: 1, a3: 2, b1: 1 });
  });
});

describe("flightCountByStudent", () => {
  it("counts landed and airborne flights, not aborted launches", () => {
    const flights = [
      flight({ id: "1" }),
      flight({ id: "2", status: "in_air", started_at: "2026-09-25T10:00:00Z", landed_at: null }),
      flight({ id: "3", status: "aborted", landed_at: null }),
      flight({ id: "4", student_user_id: "beat", status: "aborted", landed_at: null }),
    ];
    expect(flightCountByStudent(flights)).toEqual({ anna: 2 });
  });
});

describe("times", () => {
  it("measures airborne time only for flights in the air", () => {
    expect(airborneMinutes(flight({ status: "in_air", started_at: "2026-09-25T10:05:30Z", landed_at: null }), now)).toBe(24);
    expect(airborneMinutes(flight({}), now)).toBeNull();
  });

  it("measures flight time only when start and landing are recorded", () => {
    expect(flightDurationMinutes(flight({ started_at: "2026-09-25T09:48:00Z" }))).toBe(12);
    expect(flightDurationMinutes(flight({ started_at: null }))).toBeNull();
    expect(flightDurationMinutes(flight({ status: "aborted", started_at: "2026-09-25T09:48:00Z", landed_at: null }))).toBeNull();
  });

  it("lists flights in the air, longest first", () => {
    const flights = [
      flight({ id: "late", status: "in_air", started_at: "2026-09-25T10:25:00Z", landed_at: null }),
      flight({ id: "landed" }),
      flight({ id: "early", status: "in_air", started_at: "2026-09-25T10:01:00Z", landed_at: null }),
    ];
    expect(flightsInAir(flights).map((f) => f.id)).toEqual(["early", "late"]);
  });

  it("shows the landing hint only when switched on and reached", () => {
    const inAir = flight({ status: "in_air", started_at: "2026-09-25T10:00:00Z", landed_at: null });
    expect(landingHintDue(inAir, now, null)).toBe(false);
    expect(landingHintDue(inAir, now, 30)).toBe(true);
    expect(landingHintDue(inAir, now, 45)).toBe(false);
    expect(landingHintDue(flight({}), now, 15)).toBe(false);
  });
});

describe("recording helpers", () => {
  it("appends snippets as sentences", () => {
    expect(appendSnippet("", "Anflug sauber")).toBe("Anflug sauber");
    expect(appendSnippet("Guter Start", "Anflug sauber")).toBe("Guter Start. Anflug sauber");
    expect(appendSnippet("Guter Start! ", "Anflug sauber")).toBe("Guter Start! Anflug sauber");
  });

  it("toggles ratings and builds the payload", () => {
    let ratings = toggleRating({}, "launch", 2);
    ratings = toggleRating(ratings, "approach", 3);
    expect(ratingsPayload(ratings)).toEqual([{ item_id: "launch", rating: 2 }, { item_id: "approach", rating: 3 }]);
    expect(toggleRating(ratings, "launch", 2)).toEqual({ approach: 3 });
    expect(toggleRating(ratings, "launch", 1)).toEqual({ launch: 1, approach: 3 });
  });

  it("picks the main action of a student row", () => {
    const inAir = flight({ status: "in_air", started_at: "2026-09-25T10:00:00Z", landed_at: null });
    expect(boardAction([flight({}), inAir], "basic_course")).toBe("land");
    expect(boardAction([flight({})], "basic_course")).toBe("count");
    expect(boardAction([], "height_flight")).toBe("add");
    expect(boardAction([], null)).toBe("add");
  });

  it("maps database errors to messages", () => {
    expect(schoolFlightErrorKey("Flight day is closed")).toBe("closed");
    expect(schoolFlightErrorKey("Student is already in the air")).toBe("alreadyInAir");
    expect(schoolFlightErrorKey("Flight is not in the air")).toBe("notInAir");
    expect(schoolFlightErrorKey("Student is not signed up for this flight day")).toBe("notSignedUp");
    expect(schoolFlightErrorKey("Flight day access required")).toBe("noAccess");
    expect(schoolFlightErrorKey("Failed to fetch")).toBe("generic");
    expect(schoolFlightErrorKey(undefined)).toBe("generic");
  });
});

describe("take-off helpers", () => {
  it("offers start on the ground and abort while in the air", () => {
    expect(takeoffAction([flight({})])).toBe("start");
    expect(takeoffAction([flight({ status: "in_air", started_at: "2026-09-25T10:00:00Z", landed_at: null })])).toBe("abort");
    expect(takeoffAction([])).toBe("start");
  });

  it("finds the latest flight by seq", () => {
    expect(latestFlight([flight({ id: "a", seq: 1 }), flight({ id: "c", seq: 3 }), flight({ id: "b", seq: 2 })])?.id).toBe("c");
    expect(latestFlight([])).toBeNull();
  });
});
