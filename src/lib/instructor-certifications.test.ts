import { describe, expect, it } from "vitest";
import { certificationExpiry, countTeachingDays, teachingWindowStart } from "./instructor-certifications";

const now = new Date(2026, 8, 21, 12);

describe("certificate expiry", () => {
  it("keeps a certificate valid through its expiry day", () => {
    expect(certificationExpiry("2026-09-21", now)).toBe("soon");
    expect(certificationExpiry("2026-09-20", now)).toBe("expired");
  });
  it("includes the 90th day in the warning window", () => {
    expect(certificationExpiry("2026-12-20", now)).toBe("soon");
    expect(certificationExpiry("2026-12-21", now)).toBe("valid");
    expect(certificationExpiry(null, now)).toBe("none");
  });
});

describe("teaching days", () => {
  it("does not substitute a made-up renewal date", () => {
    expect(countTeachingDays(null, ["2026-09-01"], now)).toBeNull();
  });
  it("counts one day across multiple events and excludes days before renewal and future events", () => {
    expect(countTeachingDays("2025-01-01", [
      "2024-12-31", "2025-01-01T09:00:00", "2025-01-01T15:00:00",
      "2026-09-20", "2026-09-21T09:00:00", "2026-09-21T15:00:00", "2026-09-22",
    ], now)).toBe(3);
  });
  it("caps the counting window at three years", () => {
    expect(teachingWindowStart("2020-01-01", now)).toBe("2023-09-21");
    expect(countTeachingDays("2020-01-01", ["2023-09-20", "2023-09-21", "2024-01-01"], now)).toBe(2);
  });
  it("uses local calendar days for event timestamps", () => {
    const first = new Date(2026, 8, 20, 0, 15).toISOString();
    const second = new Date(2026, 8, 20, 23, 45).toISOString();
    expect(countTeachingDays("2026-09-20", [first, second], now)).toBe(1);
  });
});
