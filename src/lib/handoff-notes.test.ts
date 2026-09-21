import { describe, expect, it } from "vitest";
import { latestNextStepPerStudent } from "./handoff-notes";

describe("latestNextStepPerStudent", () => {
  it("picks the flagged note from the most recent event", () => {
    const notes = [
      { event_id: "e1", student_user_id: "s1", flight_number: null, note: "Grundkurs abschliessen", is_next_step: true },
      { event_id: "e2", student_user_id: "s1", flight_number: null, note: "Höhenflüge starten", is_next_step: true },
    ];
    const eventDateById = { e1: "2026-06-01", e2: "2026-06-15" };
    expect(latestNextStepPerStudent(notes, eventDateById)).toEqual({ s1: "Höhenflüge starten" });
  });

  it("ignores per-flight notes (only the day summary counts)", () => {
    const notes = [{ event_id: "e1", student_user_id: "s1", flight_number: 2, note: "gut geflogen", is_next_step: true }];
    expect(latestNextStepPerStudent(notes, { e1: "2026-06-01" })).toEqual({});
  });

  it("ignores notes not flagged as next step", () => {
    const notes = [{ event_id: "e1", student_user_id: "s1", flight_number: null, note: "normale Notiz", is_next_step: false }];
    expect(latestNextStepPerStudent(notes, { e1: "2026-06-01" })).toEqual({});
  });

  it("ignores empty or whitespace-only notes", () => {
    const notes = [{ event_id: "e1", student_user_id: "s1", flight_number: null, note: "   ", is_next_step: true }];
    expect(latestNextStepPerStudent(notes, { e1: "2026-06-01" })).toEqual({});
  });

  it("skips notes whose event date is unknown", () => {
    const notes = [{ event_id: "missing", student_user_id: "s1", flight_number: null, note: "x", is_next_step: true }];
    expect(latestNextStepPerStudent(notes, {})).toEqual({});
  });

  it("handles multiple students independently", () => {
    const notes = [
      { event_id: "e1", student_user_id: "s1", flight_number: null, note: "für s1", is_next_step: true },
      { event_id: "e1", student_user_id: "s2", flight_number: null, note: "für s2", is_next_step: true },
    ];
    expect(latestNextStepPerStudent(notes, { e1: "2026-06-01" })).toEqual({ s1: "für s1", s2: "für s2" });
  });
});
