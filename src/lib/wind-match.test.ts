import { describe, expect, it } from "vitest";
import { degreesToCompassPoint, parseOpenMeteoWind, windMatchStatus } from "./wind-match";

describe("degreesToCompassPoint", () => {
  it("maps cardinal and intercardinal degrees to the right point", () => {
    expect(degreesToCompassPoint(0)).toBe("N");
    expect(degreesToCompassPoint(45)).toBe("NE");
    expect(degreesToCompassPoint(90)).toBe("E");
    expect(degreesToCompassPoint(180)).toBe("S");
    expect(degreesToCompassPoint(315)).toBe("NW");
  });

  it("wraps 360 back to N", () => {
    expect(degreesToCompassPoint(360)).toBe("N");
  });

  it("rounds to the nearest point", () => {
    expect(degreesToCompassPoint(20)).toBe("N");
    expect(degreesToCompassPoint(30)).toBe("NE");
  });

  it("normalizes negative degrees", () => {
    expect(degreesToCompassPoint(-45)).toBe("NW");
  });
});

describe("windMatchStatus", () => {
  it("is a match when the current direction is in the optimal list", () => {
    expect(windMatchStatus(0, ["N", "S"])).toBe("match");
  });

  it("is borderline when adjacent to an optimal direction", () => {
    expect(windMatchStatus(45, ["N"])).toBe("borderline"); // NE, adjacent to N
    expect(windMatchStatus(315, ["N"])).toBe("borderline"); // NW, adjacent to N (wrap-around)
  });

  it("is unsuitable when far from every optimal direction", () => {
    expect(windMatchStatus(180, ["N"])).toBe("unsuitable"); // S, opposite of N
  });

  it("is unsuitable when no optimal directions are configured", () => {
    expect(windMatchStatus(0, [])).toBe("unsuitable");
  });

  it("ignores unrecognized direction strings in the optimal list", () => {
    expect(windMatchStatus(0, ["bogus"])).toBe("unsuitable");
  });
});

describe("parseOpenMeteoWind", () => {
  it("extracts direction and speed from a valid response", () => {
    const result = parseOpenMeteoWind({ current: { wind_direction_10m: 220, wind_speed_10m: 14.5 } });
    expect(result).toEqual({ directionDegrees: 220, speedKmh: 14.5 });
  });

  it("returns null when the expected fields are missing", () => {
    expect(parseOpenMeteoWind({})).toBeNull();
    expect(parseOpenMeteoWind({ current: {} })).toBeNull();
    expect(parseOpenMeteoWind(null)).toBeNull();
  });
});
