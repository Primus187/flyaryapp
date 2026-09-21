import { describe, expect, it } from "vitest";
import { isDeadlineOverdue, syncedEventStatus } from "./weather-decision";

describe("syncedEventStatus", () => {
  it("maps confirmed and cancelled 1:1 to the existing flight_events.status values", () => {
    expect(syncedEventStatus("confirmed")).toBe("confirmed");
    expect(syncedEventStatus("cancelled")).toBe("cancelled");
  });

  it("has no synced value for weather_pending", () => {
    expect(syncedEventStatus("weather_pending")).toBe(null);
  });
});

describe("isDeadlineOverdue", () => {
  const now = new Date("2026-09-21T18:00:00Z");

  it("is false without a deadline", () => {
    expect(isDeadlineOverdue(null, null, now)).toBe(false);
  });

  it("is true once the deadline has passed and nothing was ever decided", () => {
    expect(isDeadlineOverdue("2026-09-21T17:00:00Z", null, now)).toBe(true);
  });

  it("is false while the deadline is still in the future", () => {
    expect(isDeadlineOverdue("2026-09-21T19:00:00Z", null, now)).toBe(false);
  });

  it("is false once a decision has been recorded, even past the deadline", () => {
    expect(isDeadlineOverdue("2026-09-21T17:00:00Z", "2026-09-21T16:00:00Z", now)).toBe(false);
  });

  it("treats an exactly-matching deadline as overdue", () => {
    expect(isDeadlineOverdue("2026-09-21T18:00:00Z", null, now)).toBe(true);
  });
});
