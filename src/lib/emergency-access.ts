export interface EmergencyContactInfo {
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bloodType: string | null;
  allergies: string | null;
  medicalNotes: string | null;
  healthDataConsentAt: string | null;
}

export function hasEmergencyContact(info: Pick<EmergencyContactInfo, "emergencyContactName" | "emergencyContactPhone">): boolean {
  return !!(info.emergencyContactName?.trim() || info.emergencyContactPhone?.trim());
}

export function hasMedicalConsent(info: Pick<EmergencyContactInfo, "healthDataConsentAt">): boolean {
  return info.healthDataConsentAt !== null;
}

export function hasAnyMedicalData(info: Pick<EmergencyContactInfo, "bloodType" | "allergies" | "medicalNotes">): boolean {
  return !!(info.bloodType?.trim() || info.allergies?.trim() || info.medicalNotes?.trim());
}

export type EmergencyAccessErrorReason = "event_not_found" | "not_authorized" | "not_participant" | "unknown";

/** Maps the RAISE EXCEPTION message text from get_emergency_contact_info() to a UI-friendly reason. */
export function parseEmergencyAccessError(message: string | null | undefined): EmergencyAccessErrorReason {
  const m = (message || "").toLowerCase();
  if (m.includes("event not found")) return "event_not_found";
  if (m.includes("not authorized")) return "not_authorized";
  if (m.includes("not a participant")) return "not_participant";
  return "unknown";
}
