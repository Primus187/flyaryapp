/** Flights of a school flying day (event_school_flights, migration 0050). */
export type SchoolFlightStatus = "in_air" | "landed" | "aborted";

export interface SchoolFlight {
  id: string;
  student_user_id: string;
  seq: number;
  status: SchoolFlightStatus;
  started_at: string | null;
  landed_at: string | null;
}

/** Choices for the optional "land?" hint per flying day; null = off (the default). */
export const LANDING_HINT_OPTIONS = [null, 15, 30, 45, 60, 90] as const;
export type LandingHintMinutes = (typeof LANDING_HINT_OPTIONS)[number];

const minutesBetween = (from: string, to: Date) => Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 60_000));

/** A flight counts once it has started or landed; aborted launches never count. */
export const countsAsFlight = (flight: SchoolFlight) => flight.status !== "aborted";

/**
 * Display numbers per student (1, 2, 3 …) in seq order. seq keeps gaps after a deletion and
 * aborted launches get no number, so the numbering shown stays consecutive.
 */
export function flightNumbers(flights: SchoolFlight[]): Record<string, number> {
  const next: Record<string, number> = {};
  const numbers: Record<string, number> = {};
  [...flights].sort((a, b) => a.seq - b.seq).forEach((flight) => {
    if (!countsAsFlight(flight)) return;
    next[flight.student_user_id] = (next[flight.student_user_id] || 0) + 1;
    numbers[flight.id] = next[flight.student_user_id];
  });
  return numbers;
}

/** Flights per student, aborted launches excluded. */
export function flightCountByStudent(flights: SchoolFlight[]): Record<string, number> {
  const counts: Record<string, number> = {};
  flights.filter(countsAsFlight).forEach((flight) => {
    counts[flight.student_user_id] = (counts[flight.student_user_id] || 0) + 1;
  });
  return counts;
}

/** Minutes since take-off of a flight in the air, else null. */
export function airborneMinutes(flight: SchoolFlight, now: Date): number | null {
  return flight.status === "in_air" && flight.started_at ? minutesBetween(flight.started_at, now) : null;
}

/** Flight time of a landed flight, null when the start was not recorded. */
export function flightDurationMinutes(flight: SchoolFlight): number | null {
  if (flight.status !== "landed" || !flight.started_at || !flight.landed_at) return null;
  return minutesBetween(flight.started_at, new Date(flight.landed_at));
}

/** Flights in the air, longest airborne first. */
export function flightsInAir(flights: SchoolFlight[]): SchoolFlight[] {
  return flights
    .filter((flight) => flight.status === "in_air" && flight.started_at)
    .sort((a, b) => new Date(a.started_at!).getTime() - new Date(b.started_at!).getTime());
}

/** True when the optional hint is on and the flight has been in the air at least that long. */
export function landingHintDue(flight: SchoolFlight, now: Date, hintMinutes: LandingHintMinutes): boolean {
  const minutes = airborneMinutes(flight, now);
  return hintMinutes !== null && minutes !== null && minutes >= hintMinutes;
}
