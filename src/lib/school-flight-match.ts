/** Taking the school's flights over into the logbook (my_school_flight_imports, migration 0057). */
export interface ImportFlight {
  id: string;
  number: number;
  startedAt: string | null;
  landedAt: string | null;
  takeoff: string | null;
  landing: string | null;
}

export interface ImportCandidate {
  id: string;
  createdAt: string;
  durationMinutes: number | null;
  takeoff: string | null;
}

export interface ImportDay {
  eventId: string;
  title: string;
  date: string;
  groupId: string;
  flights: ImportFlight[];
  candidates: ImportCandidate[];
}

/** schoolFlightId → own logbook entry to link, or null to create a new entry. */
export type ImportLinks = Record<string, string | null>;

/**
 * Suggested links: the student's own entries of that day in the order they were made, paired with
 * the school's flights in flight order; school flights beyond them become new entries. When the
 * student logged more flights than the school, the extra own entries stay untouched.
 */
export function suggestLinks(day: Pick<ImportDay, "flights" | "candidates">): ImportLinks {
  const flights = [...day.flights].sort((a, b) => a.number - b.number);
  const own = [...day.candidates].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return Object.fromEntries(flights.map((f, i) => [f.id, own[i]?.id ?? null]));
}

/** An own entry may be linked to one school flight only; picking it elsewhere frees it here. */
export function setLink(links: ImportLinks, schoolFlightId: string, flightId: string | null): ImportLinks {
  const next: ImportLinks = {};
  for (const [id, target] of Object.entries(links)) next[id] = flightId !== null && target === flightId ? null : target;
  next[schoolFlightId] = flightId;
  return next;
}

export const linksPayload = (links: ImportLinks) =>
  Object.entries(links).map(([schoolFlightId, flightId]) => ({ schoolFlightId, flightId }));
