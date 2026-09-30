import { describe, expect, it } from "vitest";
import { cleanCode, mfaStep, nextFactorName, qrImageSrc } from "./admin-mfa";

describe("mfaStep", () => {
  it("asks to set up, to confirm, or nothing", () => {
    expect(mfaStep(0, "aal1")).toBe("enroll");
    expect(mfaStep(1, "aal1")).toBe("verify");
    expect(mfaStep(1, null)).toBe("verify");
    expect(mfaStep(2, "aal2")).toBe("ok");
  });
});

describe("cleanCode", () => {
  it("accepts six digits, also with spaces", () => {
    expect(cleanCode("123 456")).toBe("123456");
    expect(cleanCode(" 654321 ")).toBe("654321");
    expect(cleanCode("12345")).toBeNull();
    expect(cleanCode("12a456")).toBeNull();
  });
});

describe("factor setup helpers", () => {
  it("keeps a data URL and wraps plain SVG", () => {
    expect(qrImageSrc("data:image/svg+xml;utf-8,<svg/>")).toBe("data:image/svg+xml;utf-8,<svg/>");
    expect(qrImageSrc("<svg/>")).toBe("data:image/svg+xml;utf-8,%3Csvg%2F%3E");
  });

  it("gives every factor its own name", () => {
    expect(nextFactorName([])).toBe("Flyary Admin");
    expect(nextFactorName(["Flyary Admin"])).toBe("Flyary Admin 2");
    expect(nextFactorName(["Flyary Admin", "Flyary Admin 2"])).toBe("Flyary Admin 3");
  });
});
