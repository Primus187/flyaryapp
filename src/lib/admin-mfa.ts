/**
 * Two-factor sign-in for Flyary admins (Betriebsbereich step 5, migration 0088): admin rights need a
 * session confirmed with a TOTP code (assurance level aal2). Supabase Auth MFA, authenticator apps.
 */
import { supabase } from "@/integrations/supabase/client";

export interface TotpFactor { id: string; name: string; createdAt: string }

/** What the Betriebsbereich has to ask for: set up a first factor, confirm the code, or nothing. */
export type MfaStep = "enroll" | "verify" | "ok";

export function mfaStep(verifiedFactors: number, currentLevel: string | null): MfaStep {
  if (currentLevel === "aal2") return "ok";
  return verifiedFactors > 0 ? "verify" : "enroll";
}

/** Six digits; spaces from copying out of the app are ignored. */
export function cleanCode(input: string): string | null {
  const code = input.replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** Supabase returns the QR code as SVG, depending on the version already as data URL. */
export function qrImageSrc(qr: string): string {
  return qr.startsWith("data:") ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`;
}

/** A name for a new factor that differs from the existing ones (Supabase requires distinct names). */
export function nextFactorName(existing: string[], base = "Flyary Admin"): string {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export async function loadMfa(): Promise<{ factors: TotpFactor[]; unverified: string[]; currentLevel: string | null }> {
  const [{ data: list, error }, { data: level }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (error) throw error;
  const all = list?.all ?? [];
  return {
    factors: all.filter((f) => f.factor_type === "totp" && f.status === "verified")
      .map((f) => ({ id: f.id, name: f.friendly_name ?? "TOTP", createdAt: f.created_at })),
    unverified: all.filter((f) => f.factor_type === "totp" && f.status !== "verified").map((f) => f.id),
    currentLevel: level?.currentLevel ?? null,
  };
}

/** Starts setting up an authenticator app; leftovers of an interrupted setup are removed first. */
export async function startEnroll(): Promise<{ factorId: string; qr: string; secret: string }> {
  const { factors, unverified } = await loadMfa();
  for (const id of unverified) await supabase.auth.mfa.unenroll({ factorId: id });
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp", issuer: "Flyary", friendlyName: nextFactorName(factors.map((f) => f.name)),
  });
  if (error || !data) throw error ?? new Error("enroll failed");
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirms a code; afterwards the session is aal2 (Supabase refreshes the tokens itself). */
export async function verifyCode(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
}

export async function removeFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
