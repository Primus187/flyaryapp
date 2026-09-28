import { describe, expect, it } from "vitest";
import { isNumberedName, mainDirection, suggestSiteNames } from "./site-name-suggestions";

describe("mainDirection", () => {
  it("averages the compass points", () => {
    expect(mainDirection(["S", "SW"])).toBe("Süd");
    expect(mainDirection(["N", "NE", "NW"])).toBe("Nord");
    expect(mainDirection(["E", "SE"])).toBe("Ost");
    expect(mainDirection(["W"])).toBe("West");
  });

  it("gives nothing when directions cancel out or are missing", () => {
    expect(mainDirection(["N", "S"])).toBeNull();
    expect(mainDirection([])).toBeNull();
  });
});

describe("suggestSiteNames", () => {
  const site = (id: string, name: string, wind: string[], type = "takeoff") => ({ id, name, type, wind_directions: wind });

  it("names the takeoffs of one area after their wind direction (Kronberg in the DHV data)", () => {
    const s = suggestSiteNames([
      site("1", "Kronberg 1", ["N", "NE", "NW"]),
      site("2", "Kronberg 2", ["S", "SW"]),
      site("3", "Kronberg 3", ["W"]),
      site("4", "Kronberg 4", ["N", "NW"]),
      site("5", "Säntis", ["SW", "W"]),
      site("6", "Schwende 1", [], "landing"),
    ]);
    expect(Object.fromEntries(s)).toEqual({ 1: "Kronberg Nord", 2: "Kronberg Süd", 3: "Kronberg West", 4: "Kronberg Nordwest" });
  });

  it("keeps a number when two takeoffs face the same way", () => {
    const s = suggestSiteNames([site("a", "Hoher Kasten 2", ["W"]), site("b", "Hoher Kasten 1", ["W"]), site("c", "Hoher Kasten 4", ["E", "SE"])]);
    expect(Object.fromEntries(s)).toEqual({ a: "Hoher Kasten West 2", b: "Hoher Kasten West 1", c: "Hoher Kasten Ost" });
  });

  it("knows which names are numbered", () => {
    expect(isNumberedName("Hoher Kasten 4")).toBe(true);
    expect(isNumberedName("Belalp 2 (Winter)")).toBe(false);
    expect(isNumberedName("Säntis")).toBe(false);
  });
});
