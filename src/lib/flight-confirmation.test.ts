import { describe, expect, it } from "vitest";
import { canSubmit, confirmableIds, groupByStudent, isConfirmedDeleteError, skippedSummary, type SchoolConfirmationRow } from "./flight-confirmation";

const row = (flightId: string, studentId: string, extra: Partial<SchoolConfirmationRow> = {}): SchoolConfirmationRow => ({
  flightId, studentId, studentName: studentId === "a" ? "Anna" : null, status: "submitted", submittedAt: "2026-09-29T08:00:00Z",
  decidedAt: null, instructorName: null, canConfirm: true, changedAfterConfirmation: false, cancelled: false, flight: null, ...extra,
});

describe("flight confirmation helpers", () => {
  it("allows submitting only flights that are not open or confirmed", () => {
    expect(canSubmit(null)).toBe(true);
    expect(canSubmit("returned")).toBe(true);
    expect(canSubmit("revoked")).toBe(true);
    expect(canSubmit("withdrawn")).toBe(true);
    expect(canSubmit("submitted")).toBe(false);
    expect(canSubmit("confirmed")).toBe(false);
  });

  it("counts skip reasons", () => {
    expect(skippedSummary([{ id: "1", reason: "not_qualified" }, { id: "2", reason: "cancelled" }, { id: "3", reason: "not_qualified" }]))
      .toEqual([["cancelled", 1], ["not_qualified", 2]]);
    expect(skippedSummary([])).toEqual([]);
  });

  it("recognises the delete refusal for confirmed flights", () => {
    expect(isConfirmedDeleteError({ message: "Confirmed flights cannot be deleted; cancel them instead" })).toBe(true);
    expect(isConfirmedDeleteError({ message: "network error" })).toBe(false);
    expect(isConfirmedDeleteError(null)).toBe(false);
  });

  it("groups the school's list by student", () => {
    const groups = groupByStudent([row("1", "a"), row("2", "a"), row("3", "b")], "Unbekannt");
    expect(groups.map((g) => [g.studentName, g.rows.length])).toEqual([["Anna", 2], ["Unbekannt", 1]]);
  });

  it("sends only flights the viewer may confirm", () => {
    const rows = [row("1", "a"), row("2", "a", { canConfirm: false }), row("3", "a", { cancelled: true }), row("4", "a")];
    expect(confirmableIds(rows, new Set(["1", "2", "3"]))).toEqual(["1"]);
  });
});
