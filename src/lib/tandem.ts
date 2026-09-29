/** Flightbook replacement, step 4b: tandem flights and passenger confirmation (migration 0076). */

export const TANDEM_KINDS = ["instruction", "practice", "passenger"] as const;
export type TandemKind = (typeof TANDEM_KINDS)[number];

/** The page a passenger opens to confirm the flight without an account. */
export function passengerLink(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/passenger/${encodeURIComponent(token)}`;
}

/** Tokens are 64 hex characters; anything else is not worth a request. */
export function isPlausibleToken(token: string | undefined): token is string {
  return !!token && /^[0-9a-f]{64}$/.test(token);
}

export interface PassengerInfo {
  date: string;
  durationMinutes: number | null;
  passengerName: string;
  pilotName: string | null;
  takeoff: string | null;
  landing: string | null;
  discipline: string;
  expired: boolean;
}
