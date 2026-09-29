import { describe, expect, it } from "vitest";
import {
  changeActor, findGliderByLabel, flightTimesForSave, formatChangeValue, gliderLabel, igcFlightTimes, isoToLocalTime, localTimeToIso,
} from "./flight-proof";

const t = (key: string, options?: Record<string, unknown>) => (options?.defaultValue as string | undefined) ?? key;
const pi3 = { id: "g1", manufacturer: "Advance", model: "Pi3", size: "21" };
const alpha = { id: "g2", manufacturer: "Advance", model: "Alpha 7", size: null };

describe("glider labels", () => {
  it("builds the stored label", () => {
    expect(gliderLabel(pi3)).toBe("Advance Pi3 (21)");
    expect(gliderLabel(alpha)).toBe("Advance Alpha 7");
  });

  it("finds the glider behind a label only when exactly one matches", () => {
    expect(findGliderByLabel([pi3, alpha], "advance pi3 (21)")).toBe(pi3);
    expect(findGliderByLabel([pi3, alpha], " Advance Pi3 ")).toBe(pi3);
    expect(findGliderByLabel([pi3, { ...pi3, id: "g3", size: "23" }], "Advance Pi3")).toBeNull();
    expect(findGliderByLabel([pi3], "Borrowed wing")).toBeNull();
    expect(findGliderByLabel([pi3], "")).toBeNull();
  });
});

describe("flight times", () => {
  it("round-trips a local takeoff time", () => {
    const iso = localTimeToIso("2025-01-18", "13:05");
    expect(iso).not.toBeNull();
    expect(isoToLocalTime(iso)).toBe("13:05");
    expect(new Date(iso!).getDate()).toBe(18);
  });

  it("refuses incomplete or impossible times", () => {
    expect(localTimeToIso("2025-01-18", "")).toBeNull();
    expect(localTimeToIso("2025-01-18", "25:00")).toBeNull();
    expect(localTimeToIso("18.01.2025", "13:05")).toBeNull();
    expect(isoToLocalTime(null)).toBe("");
    expect(isoToLocalTime("nonsense")).toBe("");
  });

  it("reads takeoff and landing from IGC UTC times, across midnight too", () => {
    expect(igcFlightTimes("2025-06-09", "10:15:00", "12:16:59")).toEqual({
      takeoffAt: "2025-06-09T10:15:00.000Z", landingAt: "2025-06-09T12:16:59.000Z",
    });
    expect(igcFlightTimes("2025-06-09", "23:50:00", "00:20:00")?.landingAt).toBe("2025-06-10T00:20:00.000Z");
    expect(igcFlightTimes("2025-06-09", "10:15:00", null)).toEqual({ takeoffAt: "2025-06-09T10:15:00.000Z", landingAt: null });
    expect(igcFlightTimes(null, "10:15:00", "11:00:00")).toBeNull();
  });

  it("keeps the landing only when it is not before the takeoff", () => {
    const takeoff = localTimeToIso("2025-06-09", "12:00")!;
    const later = new Date(new Date(takeoff).getTime() + 30 * 60_000).toISOString();
    const earlier = new Date(new Date(takeoff).getTime() - 30 * 60_000).toISOString();
    expect(flightTimesForSave("2025-06-09", "12:00", later)).toEqual({ takeoff_at: takeoff, landing_at: later });
    expect(flightTimesForSave("2025-06-09", "12:00", earlier)).toEqual({ takeoff_at: takeoff, landing_at: null });
    expect(flightTimesForSave("2025-06-09", "", later)).toEqual({ takeoff_at: null, landing_at: later });
  });
});

describe("change history texts", () => {
  it("formats logged values", () => {
    expect(formatChangeValue("takeoff_location", { id: "l", name: "Bergbo" }, t)).toBe("Bergbo");
    expect(formatChangeValue("takeoff_location", { id: "l", name: null }, t)).toBe("flightProof.unknownPlace");
    expect(formatChangeValue("glider", { id: null, label: "Advance Pi3 (21)" }, t)).toBe("Advance Pi3 (21)");
    expect(formatChangeValue("duration_minutes", 12, t)).toBe("12 min");
    expect(formatChangeValue("is_solo_shv", true, t)).toBe("flightProof.yes");
    expect(formatChangeValue("flight_kind", "altitude", t)).toBe("flightProof.kind.altitude");
    expect(formatChangeValue("landing_location", null, t)).toBe("—");
    expect(formatChangeValue("date", "2025-01-18", t)).toBe(new Date(2025, 0, 18).toLocaleDateString("de-CH"));
  });

  it("names the person, or the tool when no person made the change", () => {
    expect(changeActor({ changed_by: "u1", origin: "app" }, { u1: "Anna" }, t)).toBe("Anna");
    expect(changeActor({ changed_by: "u2", origin: "app" }, {}, t)).toBe("flightProof.unknownPerson");
    expect(changeActor({ changed_by: null, origin: "site_merge" }, {}, t)).toBe("site_merge");
  });
});
