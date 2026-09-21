import { describe, expect, it } from "vitest";
import { hasAnyMedicalData, hasEmergencyContact, hasMedicalConsent, parseEmergencyAccessError } from "./emergency-access";

describe("hasEmergencyContact", () => {
  it("is true when name or phone is set", () => {
    expect(hasEmergencyContact({ emergencyContactName: "Mutter", emergencyContactPhone: null })).toBe(true);
    expect(hasEmergencyContact({ emergencyContactName: null, emergencyContactPhone: "079 123 45 67" })).toBe(true);
  });

  it("is false when both are blank or whitespace-only", () => {
    expect(hasEmergencyContact({ emergencyContactName: null, emergencyContactPhone: null })).toBe(false);
    expect(hasEmergencyContact({ emergencyContactName: "  ", emergencyContactPhone: "" })).toBe(false);
  });
});

describe("hasMedicalConsent", () => {
  it("is true only when a consent timestamp is present", () => {
    expect(hasMedicalConsent({ healthDataConsentAt: "2026-01-01T00:00:00Z" })).toBe(true);
    expect(hasMedicalConsent({ healthDataConsentAt: null })).toBe(false);
  });
});

describe("hasAnyMedicalData", () => {
  it("is true when at least one medical field is set", () => {
    expect(hasAnyMedicalData({ bloodType: "A+", allergies: null, medicalNotes: null })).toBe(true);
    expect(hasAnyMedicalData({ bloodType: null, allergies: null, medicalNotes: "Asthma" })).toBe(true);
  });

  it("is false when all medical fields are blank", () => {
    expect(hasAnyMedicalData({ bloodType: null, allergies: "", medicalNotes: "  " })).toBe(false);
  });
});

describe("parseEmergencyAccessError", () => {
  it("recognizes each known RPC exception message", () => {
    expect(parseEmergencyAccessError("event not found")).toBe("event_not_found");
    expect(parseEmergencyAccessError("not authorized")).toBe("not_authorized");
    expect(parseEmergencyAccessError("target is not a participant of this event")).toBe("not_participant");
  });

  it("falls back to unknown for unrecognized or missing messages", () => {
    expect(parseEmergencyAccessError("boom")).toBe("unknown");
    expect(parseEmergencyAccessError(null)).toBe("unknown");
    expect(parseEmergencyAccessError(undefined)).toBe("unknown");
  });
});
