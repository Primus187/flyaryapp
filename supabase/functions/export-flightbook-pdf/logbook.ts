// Pure logic of the personal logbook PDF, laid out like the Flightbook printout the SHV exam accepts
// (docs/technical/flightbook-replacement-plan.md, section "Vorlage Flightbook-Ausdruck").
// Kept free of Deno/jsPDF imports so Vitest can test it (src/lib/logbook-pdf.test.ts).

export interface LogbookPlace {
  id: string;
  name: string;
  altitude: number | null;
  country_code: string | null;
  description: string | null;
  official_site_id: string | null;
}

export interface LogbookFlight {
  id: string;
  flight_no: number;
  date: string;
  glider: string | null;
  discipline: string | null;
  duration_minutes: number | null;
  distance_km: number | null;
  altitude_gain: number | null;
  comments: string | null;
  group_id: string | null;
  is_solo_shv: boolean;
  takeoff: LogbookPlace | null;
  landing: LogbookPlace | null;
}

/**
 * Printed in the order of the stable flight number: a flight entered later is appended at the end,
 * so pages that were already stamped keep showing the same flights.
 */
export function sortForPrint(flights: LogbookFlight[]): LogbookFlight[] {
  return [...flights].sort((a, b) => a.flight_no - b.flight_no || a.date.localeCompare(b.date));
}

// The same official site counts once, even as two own places of the pilot (variants, merged names).
const siteKey = (p: LogbookPlace) => p.official_site_id ? `site:${p.official_site_id}` : `place:${p.id}`;

/**
 * The take-off and landing sites actually used by the printed flights, in order of first use.
 * A take-off site used for a top landing appears among the landing sites too (as in Flightbook).
 */
export function flownSites(flights: LogbookFlight[]): { takeoffs: LogbookPlace[]; landings: LogbookPlace[] } {
  const collect = (pick: (f: LogbookFlight) => LogbookPlace | null) => {
    const seen = new Map<string, LogbookPlace>();
    for (const f of flights) {
      const place = pick(f);
      if (place && !seen.has(siteKey(place))) seen.set(siteKey(place), place);
    }
    return [...seen.values()];
  };
  return { takeoffs: collect((f) => f.takeoff), landings: collect((f) => f.landing) };
}

/** "Diff." of the Flightbook printout: height of the take-off site minus height of the landing site. */
export function heightDifference(f: Pick<LogbookFlight, "takeoff" | "landing">): number | null {
  const from = f.takeoff?.altitude, to = f.landing?.altitude;
  return from == null || to == null ? null : from - to;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export interface LogbookSummary {
  takeoffSites: number;
  landingSites: number;
  flights: number;
  minutes: number;
  soloFlights: number;
}

export function logbookSummary(flights: LogbookFlight[]): LogbookSummary {
  const sites = flownSites(flights);
  return {
    takeoffSites: sites.takeoffs.length,
    landingSites: sites.landings.length,
    flights: flights.length,
    minutes: flights.reduce((s, f) => s + (f.duration_minutes || 0), 0),
    soloFlights: flights.filter((f) => f.is_solo_shv).length,
  };
}

/** Header lines of the cover page, in the order of the Flightbook printout. */
export function summaryLines(s: LogbookSummary): string[] {
  return [
    `Anzahl Startplätze: ${s.takeoffSites}`,
    `Anzahl Landeplätze: ${s.landingSites}`,
    `Anzahl Flüge: ${s.flights}`,
    `Flugstunden: ${formatDuration(s.minutes)}`,
    `Anzahl Alleinflüge: ${s.soloFlights}`,
  ];
}

/** Heading of the aircraft column: "Gleitschirm", "Delta" or "Fluggerät" when both occur. */
export function aircraftColumnLabel(flights: Pick<LogbookFlight, "discipline">[]): string {
  const hang = flights.some((f) => f.discipline === "hangglider");
  const para = flights.some((f) => f.discipline !== "hangglider");
  return hang && para ? "Fluggerät" : hang ? "Delta" : "Gleitschirm";
}

/** "3/15": the total shows whether a page of a stamped printout is missing. */
export function pageLabel(page: number, total: number): string {
  return `${page}/${total}`;
}
