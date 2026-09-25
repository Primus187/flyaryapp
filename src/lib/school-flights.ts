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

/** Rating of a maneuver on one flight: 1 = again, 2 = okay, 3 = solid. */
export type ManeuverRating = 1 | 2 | 3;
export const MANEUVER_RATINGS: ManeuverRating[] = [1, 2, 3];

/** Default feedback snippets (i18n keys under flightDay.snippets). */
export const FEEDBACK_SNIPPETS = [
  "launchClean", "launchEarlyAbort", "lookIntoTurn", "approachClean", "approachLate", "flareLate", "flareGood", "legsDown",
] as const;

/** Appends a snippet as a new sentence; an empty text gets the snippet alone. */
export function appendSnippet(text: string, snippet: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed) return snippet;
  return `${trimmed}${/[.!?]$/.test(trimmed) ? " " : ". "}${snippet}`;
}

/** Tapping the selected rating again clears it. */
export function toggleRating(ratings: Record<string, ManeuverRating>, itemId: string, rating: ManeuverRating): Record<string, ManeuverRating> {
  const next = { ...ratings };
  if (next[itemId] === rating) delete next[itemId]; else next[itemId] = rating;
  return next;
}

export const ratingsPayload = (ratings: Record<string, ManeuverRating>) =>
  Object.entries(ratings).map(([item_id, rating]) => ({ item_id, rating }));

export type BoardAction = "land" | "count" | "add";

/** Main button of a student row: land the flight in the air, else +1 on the practice slope
 *  (basic course), else record a flight. */
export function boardAction(studentFlights: SchoolFlight[], eventCategory: string | null | undefined): BoardAction {
  if (studentFlights.some((f) => f.status === "in_air")) return "land";
  return eventCategory === "basic_course" ? "count" : "add";
}

/** Maps database errors of the flight RPCs to i18n keys under flightDay.errors. */
export function schoolFlightErrorKey(message: string | undefined): string {
  if (!message) return "generic";
  if (message.includes("Flight day is closed")) return "closed";
  if (message.includes("already in the air")) return "alreadyInAir";
  if (message.includes("not in the air")) return "notInAir";
  if (message.includes("not signed up")) return "notSignedUp";
  if (message.includes("Flight day access required")) return "noAccess";
  return "generic";
}
