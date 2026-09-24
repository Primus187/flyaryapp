// @vitest-environment node
import { describe, expect, it } from "vitest";
import { monthsBetween, safetyHints, type SafetyInput } from "./marketplace-safety";

const now = new Date("2026-09-24T12:00:00Z");
const offer = (over: Partial<SafetyInput>): SafetyInput =>
  ({ category: "glider", condition: "used", listing_type: "offer", attributes: {}, ...over });
const codes = (input: SafetyInput) => safetyHints(input, now).map((h) => h.code);

describe("monthsBetween", () => {
  it("counts whole months", () => {
    expect(monthsBetween(new Date("2026-01-17T00:00:00Z"), new Date("2026-02-16T00:00:00Z"))).toBe(0);
    expect(monthsBetween(new Date("2026-01-17T00:00:00Z"), new Date("2026-02-17T00:00:00Z"))).toBe(1);
    expect(monthsBetween(new Date("2025-03-01T00:00:00Z"), now)).toBe(18);
    expect(monthsBetween(now, new Date("2020-01-01T00:00:00Z"))).toBe(0);
  });
});

describe("safetyHints", () => {
  it("gives nothing for wanted listings", () => {
    expect(codes(offer({ listing_type: "wanted", condition: "for_parts" }))).toEqual([]);
  });

  it("for_parts shows only the not-airworthy warning", () => {
    expect(safetyHints(offer({ condition: "for_parts", category: "reserve" }), now))
      .toEqual([{ code: "not_airworthy", severity: "warning" }]);
  });

  it("reserve: unknown, recent and overdue repack", () => {
    expect(codes(offer({ category: "reserve" }))).toEqual(["reserve_repack_unknown", "check_before_flight"]);
    expect(codes(offer({ category: "reserve", attributes: { last_repack: "2026-03" } }))).toEqual(["check_before_flight"]);
    expect(safetyHints(offer({ category: "reserve", attributes: { last_repack: "2026-02" } }), now)[0])
      .toEqual({ code: "reserve_repack_overdue", severity: "warning", months: 7 });
  });

  it("wing: missing and old check, expert class", () => {
    expect(codes(offer({}))).toEqual(["wing_check_missing", "check_before_flight"]);
    expect(safetyHints(offer({ category: "tandem", attributes: { last_check: "2024-06-15", certification: "b" } }), now))
      .toEqual([{ code: "wing_check_old", severity: "warning", months: 27 }, { code: "check_before_flight", severity: "info" }]);
    expect(codes(offer({ attributes: { last_check: "2026-01", certification: "ccc" } }))).toEqual(["expert_class", "check_before_flight"]);
  });

  it("new equipment is not flagged for a missing check or repack date", () => {
    expect(codes(offer({ condition: "new" }))).toEqual(["check_before_flight"]);
    expect(codes(offer({ condition: "new", category: "reserve" }))).toEqual(["check_before_flight"]);
  });

  it("the general check hint applies to flown or worn gear only", () => {
    expect(codes(offer({ category: "helmet" }))).toEqual(["check_before_flight"]);
    expect(codes(offer({ category: "instrument" }))).toEqual([]);
    expect(codes(offer({ category: "clothing" }))).toEqual([]);
  });
});
