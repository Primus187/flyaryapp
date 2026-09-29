import { describe, expect, it } from "vitest";
import { isPlausibleToken, passengerLink } from "./tandem";

const token = "a".repeat(64);

describe("tandem passenger links", () => {
  it("builds the confirmation link", () => {
    expect(passengerLink("https://app.flyary.ch/", token)).toBe(`https://app.flyary.ch/passenger/${token}`);
    expect(passengerLink("http://localhost:8080", token)).toBe(`http://localhost:8080/passenger/${token}`);
  });

  it("accepts only 64 hex characters as token", () => {
    expect(isPlausibleToken(token)).toBe(true);
    expect(isPlausibleToken("A".repeat(64))).toBe(false);
    expect(isPlausibleToken("abc")).toBe(false);
    expect(isPlausibleToken(undefined)).toBe(false);
  });
});
