import { describe, expect, it } from "vitest";
import { latestStatusPerStudent, normalizeStudentStatus } from "./student-status";

describe("normalizeStudentStatus", () => {
  it("passes through known statuses", () => {
    expect(normalizeStudentStatus("paused")).toBe("paused");
    expect(normalizeStudentStatus("cancelled")).toBe("cancelled");
  });

  it("defaults anything else to active", () => {
    expect(normalizeStudentStatus("active")).toBe("active");
    expect(normalizeStudentStatus(null)).toBe("active");
    expect(normalizeStudentStatus(undefined)).toBe("active");
    expect(normalizeStudentStatus("unknown-value")).toBe("active");
  });
});

describe("latestStatusPerStudent", () => {
  it("keeps the first (newest) row per student and ignores older ones", () => {
    const rows = [
      { student_id: "s1", status: "paused", reason: "Verletzung", changed_at: "2026-06-01T00:00:00Z" },
      { student_id: "s1", status: "active", reason: null, changed_at: "2026-01-01T00:00:00Z" },
    ];
    expect(latestStatusPerStudent(rows)).toEqual({
      s1: { status: "paused", reason: "Verletzung", changed_at: "2026-06-01T00:00:00Z" },
    });
  });

  it("normalizes unexpected status values", () => {
    const rows = [{ student_id: "s1", status: "something-else", reason: null, changed_at: null }];
    expect(latestStatusPerStudent(rows).s1.status).toBe("active");
  });

  it("skips rows without a student id", () => {
    const rows = [{ student_id: "", status: "paused", reason: null, changed_at: null }];
    expect(latestStatusPerStudent(rows)).toEqual({});
  });

  it("handles multiple students independently", () => {
    const rows = [
      { student_id: "s1", status: "paused", reason: null, changed_at: "2026-06-01T00:00:00Z" },
      { student_id: "s2", status: "cancelled", reason: "Umzug", changed_at: "2026-05-01T00:00:00Z" },
    ];
    const result = latestStatusPerStudent(rows);
    expect(result.s1.status).toBe("paused");
    expect(result.s2).toEqual({ status: "cancelled", reason: "Umzug", changed_at: "2026-05-01T00:00:00Z" });
  });
});
