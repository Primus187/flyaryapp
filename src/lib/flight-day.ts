/** Check-in and day status of a school flying day (migration 0051). */
export type Presence = "expected" | "present" | "absent";
export type FlightDayRole = "instructor" | "helper";

export const PAUSE_REASONS = ["material", "fatigue", "injury", "weather", "other"] as const;
export type PauseReason = (typeof PAUSE_REASONS)[number];

export interface DaySignup {
  user_id: string;
  presence?: Presence | null;
}

export interface DayPause {
  student_user_id: string;
  reason: PauseReason;
  note: string | null;
}

export interface DayParticipant {
  userId: string;
  name: string;
  presence: Presence;
  pause: DayPause | null;
}

export interface PresenceSummary {
  present: number;
  absent: number;
  expected: number;
  paused: number;
  total: number;
}

/** Tap on a tile: expected/absent → present, present → expected (undo a mistaken tap). */
export const nextPresenceOnTap = (presence: Presence): Presence => (presence === "present" ? "expected" : "present");

/** Participants of the day: on site first, then not yet checked in, then paused, absent last;
 *  alphabetical within each group. */
export function dayParticipants(signups: DaySignup[], names: Record<string, string>, pauses: DayPause[]): DayParticipant[] {
  const pauseBy = new Map(pauses.map((p) => [p.student_user_id, p]));
  const rank = (p: DayParticipant) => (p.presence === "absent" ? 3 : p.pause ? 2 : p.presence === "present" ? 0 : 1);
  return signups
    .map((s) => ({ userId: s.user_id, name: names[s.user_id] || "", presence: s.presence || "expected", pause: pauseBy.get(s.user_id) || null }))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function presenceSummary(participants: DayParticipant[]): PresenceSummary {
  return {
    present: participants.filter((p) => p.presence === "present").length,
    absent: participants.filter((p) => p.presence === "absent").length,
    expected: participants.filter((p) => p.presence === "expected").length,
    paused: participants.filter((p) => p.pause).length,
    total: participants.length,
  };
}

/** The flying day tab opens by itself for the team on the day of the event (local calendar day). */
export function opensOnFlightDay(eventDate: string, now: Date, role: FlightDayRole | null): boolean {
  if (!role) return false;
  const day = new Date(eventDate);
  return day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth() && day.getDate() === now.getDate();
}
