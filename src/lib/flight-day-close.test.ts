import { describe, expect, it } from "vitest";
import { bookingTotals, closeChecklist, defaultSelection, summarySuggestion, toggleId, type ClosePreview } from "./flight-day-close";

const preview = (patch: Partial<ClosePreview> = {}): ClosePreview => ({
  closedAt: null, closedBy: null, inAir: [], expected: [], missingTakeoff: 0, defaultTakeoff: null, summaries: [], loans: [],
  creditRate: 50, rentalRate: 30,
  credits: [{ userId: "helper", booked: false }, { userId: "helper2", booked: true }],
  rentals: [{ userId: "anna", hasLoan: true, booked: false }, { userId: "beat", hasLoan: false, booked: false }, { userId: "carla", hasLoan: true, booked: true }],
  ...patch,
});

describe("defaultSelection", () => {
  it("preselects open credits and rentals only for students with a loan", () => {
    expect(defaultSelection(preview())).toEqual({ credits: ["helper"], rentals: ["anna"], returns: [] });
  });
});

describe("bookingTotals", () => {
  it("counts only what is selected and not yet booked", () => {
    expect(bookingTotals(preview(), { credits: ["helper", "helper2"], rentals: ["anna", "beat", "carla"], returns: [] }))
      .toEqual({ credits: 1, rentals: 2, creditAmount: 50, rentalAmount: 60 });
  });

  it("books nothing for a rate of 0", () => {
    expect(bookingTotals(preview({ creditRate: 0, rentalRate: 0 }), { credits: ["helper"], rentals: ["anna"], returns: [] }))
      .toEqual({ credits: 0, rentals: 0, creditAmount: 0, rentalAmount: 0 });
  });
});

describe("summarySuggestion", () => {
  it("lists the day's feedback per flight", () => {
    expect(summarySuggestion(["Start sauber ", "Anflug zu spät"])).toBe("F1: Start sauber\nF2: Anflug zu spät");
    expect(summarySuggestion([])).toBe("");
  });
});

describe("closeChecklist", () => {
  it("blocks only while someone is in the air", () => {
    const open = preview({ inAir: [{ flightId: "f", studentId: "anna" }], expected: ["beat"], missingTakeoff: 2,
      summaries: [{ studentId: "anna", hasSummary: false, feedback: [] }, { studentId: "carla", hasSummary: true, feedback: [] }] });
    expect(closeChecklist(open)).toEqual({ inAir: 1, expected: 1, missingTakeoff: 2, missingSummaries: 1, canClose: false });
    expect(closeChecklist(preview({ expected: ["beat"] })).canClose).toBe(true);
  });
});

it("toggles ids", () => {
  expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
  expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
});
