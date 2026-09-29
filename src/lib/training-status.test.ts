import { describe, expect, it } from "vitest";
import { allMet, progress, requirementLabelKey, valueText, type RequirementResult } from "./training-status";

const req = (rule: RequirementResult["rule"], value: number | null, threshold: number, met = false): RequirementResult =>
  ({ rule, value, threshold, met, source: "SHV", params: {} });

describe("training status display", () => {
  it("shows progress as a share of the threshold", () => {
    expect(progress(req("confirmed_altitude_flights", 20, 50))).toBeCloseTo(0.4);
    expect(progress(req("confirmed_altitude_flights", 60, 50, true))).toBe(1);
    expect(progress(req("licence_held_years", null, 2))).toBe(0);
    expect(progress(req("evidence_within_years", 4, 3))).toBe(0);
  });

  it("formats values with their unit", () => {
    expect(valueText(req("confirmed_altitude_flights", 4, 50))).toBe("4 / 50");
    expect(valueText(req("confirmed_long_flight_minutes", 59, 60))).toBe("59 / 60 min");
    expect(valueText(req("longest_flight_km_since_licence", 51.23, 50, true))).toBe("51.2 / 50 km");
    expect(valueText(req("licence_held_years", null, 2))).toBe("—");
    expect(valueText(req("evidence_within_years", 1, 3, true))).toBe("1");
  });

  it("tells repeated rules apart by their label", () => {
    expect(requirementLabelKey({ rule: "tandem_flights", params: { label: "tandem_practice" } })).toBe("trainingStatus.rule.tandem_practice");
    expect(requirementLabelKey({ rule: "confirmed_solo_flights", params: {} })).toBe("trainingStatus.rule.confirmed_solo_flights");
  });

  it("is complete only when every requirement is met", () => {
    const base = { discipline: "paraglider", licence: "pilot", confirmedWithoutKind: 0, confirmedPractice: 0, licenceIssuedAt: null };
    expect(allMet({ ...base, requirements: [req("confirmed_altitude_flights", 50, 50, true)] })).toBe(true);
    expect(allMet({ ...base, requirements: [req("confirmed_altitude_flights", 50, 50, true), req("confirmed_solo_flights", 0, 1)] })).toBe(false);
    expect(allMet({ ...base, requirements: [] })).toBe(false);
    expect(allMet(null)).toBe(false);
  });
});
