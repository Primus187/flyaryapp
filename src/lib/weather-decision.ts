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
