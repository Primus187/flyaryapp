import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { flownWith, gliderLabel, logbookHours, prefillFromGlider, type OwnGlider } from "./marketplace-prefill";

const alpha: OwnGlider = { id: "g", manufacturer: "Advance", model: "Alpha 7", size: "26", is_default: true };

describe("matching flights to a wing", () => {
  it("uses the flight form's label", () => {
    expect(gliderLabel(alpha)).toBe("Advance Alpha 7 (26)");
    expect(gliderLabel({ ...alpha, size: null })).toBe("Advance Alpha 7");
  });
  it.each([
    ["Advance Alpha 7 (26)", true],
    ["ADVANCE ALPHA7", true],
    ["Advance Alpha 7 (28)", false],
    ["Advance Alpha 6 (26)", false],
    ["Ozone Alpha 7 (26)", false],
    ["", false],
    [null, false],
  ])("%s → %s", (text, expected) => {
    expect(flownWith(text, alpha)).toBe(expected);
  });
  it("sums minutes into whole hours", () => {
    const flights = [
      { glider: "Advance Alpha 7 (26)", duration_minutes: 90 },
      { glider: "advance alpha 7", duration_minutes: 45 },
      { glider: "Ozone Rush 6", duration_minutes: 600 },
      { glider: "Advance Alpha 7 (26)", duration_minutes: null },
    ];
    expect(logbookHours(flights, alpha)).toBe(2);
    expect(logbookHours([], alpha)).toBe(0);
  });
});

describe("prefillFromGlider", () => {
  it("takes over the wing and marks logbook hours", () => {
    expect(prefillFromGlider(alpha, [{ glider: "Advance Alpha 7 (26)", duration_minutes: 125 }])).toEqual({
      category: "glider", title: "Advance Alpha 7 (26)", manufacturer: "Advance", model: "Alpha 7", size: "26",
      attributes: { flight_hours: 2, hours_from_logbook: true },
    });
  });
  it("leaves the hours out when the logbook has none", () => {
    expect(prefillFromGlider({ ...alpha, size: null }, []).attributes).toEqual({});
  });
});
