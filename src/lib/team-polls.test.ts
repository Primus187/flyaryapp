import { describe, expect, it } from "vitest";
import { countResponsesByOption, findOwnResponse, isPollClosed, parseOptionsInput } from "./team-polls";

describe("isPollClosed", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("is never closed when there is no deadline", () => {
    expect(isPollClosed(null, now)).toBe(false);
  });

  it("is closed once the deadline has passed", () => {
    expect(isPollClosed("2026-06-15T11:00:00Z", now)).toBe(true);
    expect(isPollClosed("2026-06-15T13:00:00Z", now)).toBe(false);
  });

  it("treats the exact deadline instant as closed", () => {
    expect(isPollClosed("2026-06-15T12:00:00Z", now)).toBe(true);
  });
});

describe("countResponsesByOption", () => {
  it("counts responses per option, defaulting missing options to zero", () => {
    const counts = countResponsesByOption(
      ["Ja", "Nein"],
      [
        { userId: "a", response: "Ja" },
        { userId: "b", response: "Ja" },
        { userId: "c", response: "Nein" },
      ],
    );
    expect(counts).toEqual({ Ja: 2, Nein: 1 });
  });

  it("ignores responses that don't match a known option", () => {
    const counts = countResponsesByOption(["Ja", "Nein"], [{ userId: "a", response: "Vielleicht" }]);
    expect(counts).toEqual({ Ja: 0, Nein: 0 });
  });
});

describe("findOwnResponse", () => {
  it("returns the matching user's response", () => {
    const responses = [{ userId: "a", response: "Ja" }, { userId: "b", response: "Nein" }];
    expect(findOwnResponse(responses, "b")).toBe("Nein");
  });

  it("returns null when the user hasn't responded", () => {
    expect(findOwnResponse([], "a")).toBeNull();
  });
});

describe("parseOptionsInput", () => {
  it("splits on commas and trims whitespace", () => {
    expect(parseOptionsInput("Ja, Nein ,  Vielleicht")).toEqual(["Ja", "Nein", "Vielleicht"]);
  });

  it("drops empty entries and de-duplicates", () => {
    expect(parseOptionsInput("Ja,,Ja, Nein")).toEqual(["Ja", "Nein"]);
  });
});
