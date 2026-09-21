import { describe, expect, it } from "vitest";
import {
  hasCertifiedAvailableInstructor,
  nextAvailabilityStatus,
  sortByAvailability,
  startOfWeek,
  weekDates,
} from "./instructor-availability";

describe("nextAvailabilityStatus", () => {
  it("cycles through the full sequence and back to the start", () => {
    expect(nextAvailabilityStatus(null)).toBe("available");
    expect(nextAvailabilityStatus("available")).toBe("unsure");
    expect(nextAvailabilityStatus("unsure")).toBe("unavailable");
    expect(nextAvailabilityStatus("unavailable")).toBe(null);
  });
});

describe("startOfWeek", () => {
  it("returns the same Monday when given a Monday", () => {
    const monday = startOfWeek(new Date(2026, 8, 21)); // 2026-09-21 is a Monday
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(8);
    expect(monday.getDate()).toBe(21);
  });

  it("rolls a Sunday back to the preceding Monday", () => {
    const monday = startOfWeek(new Date(2026, 8, 27)); // Sunday
    expect(monday.getDate()).toBe(21);
  });

  it("rolls a mid-week date back to that week's Monday", () => {
    const monday = startOfWeek(new Date(2026, 8, 24)); // Thursday
    expect(monday.getDate()).toBe(21);
  });
});

describe("weekDates", () => {
  it("returns 7 consecutive ISO dates starting at the given Monday", () => {
    const dates = weekDates(new Date(2026, 8, 21));
    expect(dates).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("crosses a month boundary correctly", () => {
    const dates = weekDates(new Date(2026, 8, 28));
    expect(dates[0]).toBe("2026-09-28");
    expect(dates[6]).toBe("2026-10-04");
  });
});

describe("sortByAvailability", () => {
  it("orders available, then unsure/unset, then unavailable, preserving original order within a group", () => {
    const people = ["a", "b", "c", "d", "e"];
    const status: Record<string, "available" | "unsure" | "unavailable" | null> = {
      a: "unavailable",
      b: "available",
      c: null,
      d: "unsure",
      e: "available",
    };
    expect(sortByAvailability(people, (p) => status[p])).toEqual(["b", "e", "d", "c", "a"]);
  });
});

describe("hasCertifiedAvailableInstructor", () => {
  it("is true when an available instructor also has a valid cert", () => {
    const result = hasCertifiedAvailableInstructor(
      ["u1", "u2"],
      { u1: "unavailable", u2: "available" },
      (id) => id === "u2",
    );
    expect(result).toBe(true);
  });

  it("is false when the only available instructor lacks a valid cert", () => {
    const result = hasCertifiedAvailableInstructor(
      ["u1", "u2"],
      { u1: "unavailable", u2: "available" },
      (id) => id === "u1",
    );
    expect(result).toBe(false);
  });

  it("is false when nobody is marked available", () => {
    const result = hasCertifiedAvailableInstructor(["u1"], {}, () => true);
    expect(result).toBe(false);
  });
});
