import { describe, expect, it } from "vitest";
import { isDeadlineOverdue, syncedEventStatus, toLocalDatetimeInputValue } from "./weather-decision";

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

describe("toLocalDatetimeInputValue", () => {
  it("round-trips a locally-constructed date through its UTC ISO storage form, zero-padded", () => {
    const local = new Date(2026, 0, 5, 3, 7); // 2026-01-05 03:07 in whatever timezone the test runs
    expect(toLocalDatetimeInputValue(local.toISOString())).toBe("2026-01-05T03:07");
  });

  it("reflects the viewer's local time, not the raw UTC string prefix", () => {
    const iso = "2026-09-21T16:30:00.000Z";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    expect(toLocalDatetimeInputValue(iso)).toBe(expected);
  });
});
