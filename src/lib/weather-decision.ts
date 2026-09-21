export type WeatherDecisionStatus = "confirmed" | "weather_pending" | "cancelled";

/** The flight_events.status value a weather decision should sync into, if any. */
export function syncedEventStatus(status: WeatherDecisionStatus): "confirmed" | "cancelled" | null {
  if (status === "confirmed") return "confirmed";
  if (status === "cancelled") return "cancelled";
  return null;
}

/**
 * True when a decision deadline has passed without a status ever having been decided.
 * Once staff sets any status (including re-opening to weather_pending after deciding),
 * decidedAt is set and the reminder no longer applies for that round.
 */
export function isDeadlineOverdue(deadline: string | null, decidedAt: string | null, now: Date): boolean {
  if (!deadline || decidedAt) return false;
  return new Date(deadline).getTime() <= now.getTime();
}

/**
 * Formats a stored (UTC) timestamp for a `<input type="datetime-local">` value, in the
 * viewer's local timezone. A plain string slice of the ISO value would instead show the raw
 * UTC wall-clock time, shifted by the viewer's UTC offset from what was actually entered.
 */
export function toLocalDatetimeInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
