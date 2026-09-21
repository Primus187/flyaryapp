import { describe, expect, it } from "vitest";
import { levelCountsAtYearEnd, licensedCompletionsInYear } from "./annual-report";

describe("levelCountsAtYearEnd", () => {
  it("falls back to the live profile value for the current year when there is no history", () => {
    const { counts, unresolved } = levelCountsAtYearEnd(
      ["u1"],
      [],
      [{ user_id: "u1", training_level: "grundkurs" }],
      2026,
      2026,
    );
    expect(counts).toEqual({ grundkurs: 1 });
    expect(unresolved).toBe(0);
  });

  it("marks a student unresolved for a past year with no history entry", () => {
    const { counts, unresolved } = levelCountsAtYearEnd(
      ["u1"],
      [],
      [{ user_id: "u1", training_level: "licensed" }],
      2024,
      2026,
    );
    expect(counts).toEqual({});
    expect(unresolved).toBe(1);
  });

  it("uses the latest history entry before the year's end", () => {
    const history = [
      { user_id: "u1", training_level: "ground", changed_at: "2023-05-01T00:00:00Z" },
      { user_id: "u1", training_level: "altitude", changed_at: "2024-06-01T00:00:00Z" },
      { user_id: "u1", training_level: "licensed", changed_at: "2025-02-01T00:00:00Z" },
    ];
    const { counts, unresolved } = levelCountsAtYearEnd(["u1"], history, [], 2024, 2026);
    expect(counts).toEqual({ altitude: 1 });
    expect(unresolved).toBe(0);
  });

  it("ignores history entries after the year's end", () => {
    const history = [{ user_id: "u1", training_level: "licensed", changed_at: "2025-02-01T00:00:00Z" }];
    const { counts, unresolved } = levelCountsAtYearEnd(["u1"], history, [], 2024, 2026);
    expect(counts).toEqual({});
    expect(unresolved).toBe(1);
  });

  it("counts multiple students independently", () => {
    const history = [{ user_id: "u2", training_level: "licensed", changed_at: "2024-03-01T00:00:00Z" }];
    const { counts, unresolved } = levelCountsAtYearEnd(
      ["u1", "u2"],
      history,
      [{ user_id: "u1", training_level: "grundkurs" }],
      2024,
      2026,
    );
    expect(counts).toEqual({ licensed: 1 });
    expect(unresolved).toBe(1);
  });
});

describe("licensedCompletionsInYear", () => {
  it("counts a transition to licensed within the year", () => {
    const history = [{ user_id: "u1", training_level: "licensed", changed_at: "2025-07-01T00:00:00Z" }];
    expect(licensedCompletionsInYear(history, 2025)).toBe(1);
  });

  it("excludes transitions in other years", () => {
    const history = [
      { user_id: "u1", training_level: "licensed", changed_at: "2024-12-31T23:59:59Z" },
      { user_id: "u2", training_level: "licensed", changed_at: "2026-01-01T00:00:00Z" },
    ];
    expect(licensedCompletionsInYear(history, 2025)).toBe(0);
  });

  it("counts each student once even with repeated entries", () => {
    const history = [
      { user_id: "u1", training_level: "altitude", changed_at: "2025-01-01T00:00:00Z" },
      { user_id: "u1", training_level: "licensed", changed_at: "2025-03-01T00:00:00Z" },
      { user_id: "u1", training_level: "licensed", changed_at: "2025-09-01T00:00:00Z" },
    ];
    expect(licensedCompletionsInYear(history, 2025)).toBe(1);
  });

  it("is case-insensitive for the level value", () => {
    const history = [{ user_id: "u1", training_level: "Licensed", changed_at: "2025-05-01T00:00:00Z" }];
    expect(licensedCompletionsInYear(history, 2025)).toBe(1);
  });

  it("ignores non-licensed transitions", () => {
    const history = [{ user_id: "u1", training_level: "grundkurs", changed_at: "2025-05-01T00:00:00Z" }];
    expect(licensedCompletionsInYear(history, 2025)).toBe(0);
  });
});
