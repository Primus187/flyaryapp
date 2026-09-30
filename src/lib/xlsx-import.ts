import * as XLSX from "xlsx";

export interface ParsedFlight {
  date: string; // YYYY-MM-DD
  takeoff: string;
  takeoffCountry: string;
  landing: string;
  landingCountry: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  glider: string;
  comments: string;
  /** The flight's number in Flightbook ("Nr"), kept as the imported flight's source reference. */
  sourceRef: string | null;
}

export interface ParseResult {
  flights: ParsedFlight[];
  /** Spreadsheet row numbers (1 = header) whose date could not be read; they are not imported. */
  invalidRows: number[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A flight date as YYYY-MM-DD, or null when it cannot be read. Never falls back to today: an
 * invented date would end up in the flight log as if it were the real one.
 */
export function parseDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  // xlsx turns date cells into JS Dates around midnight (local or UTC, sometimes seconds before);
  // toISOString() shifted them to the previous day east of UTC. Round to the nearest day instead.
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    const noon = new Date(raw.getTime() + 12 * 60 * 60 * 1000);
    return `${noon.getFullYear()}-${pad(noon.getMonth() + 1)}-${pad(noon.getDate())}`;
  }
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const [y, mo, d] = m ? [Number(m[3]), Number(m[2]), Number(m[1])]
    : /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").map(Number) : [NaN, NaN, NaN];
  const check = new Date(y, mo - 1, d);
  if (Number.isNaN(check.getTime()) || check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function parseDuration(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  // xlsx may parse time as fraction of day
  if (typeof raw === "number") {
    return Math.round(raw * 24 * 60);
  }
  const s = String(raw).trim();
  const m = s.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  return null;
}

function parseNum(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = parseFloat(String(raw).replace(",", "."));
  return isNaN(n) ? null : n;
}

/** Strip common SP/LP prefixes from location names */
function stripLocationPrefix(name: string): string {
  return name.replace(/^(SP|LP)\s+/i, "").trim();
}

/** Rows of a Flightbook export (header names as in Flightbook) to flights. */
export function parseRows(rows: Record<string, unknown>[]): ParseResult {
  const flights: ParsedFlight[] = [];
  const invalidRows: number[] = [];
  rows.forEach((r, index) => {
    if (r["Datum"] == null || r["Datum"] === "") return;
    const date = parseDate(r["Datum"]);
    if (!date) { invalidRows.push(index + 2); return; }
    const nr = r["Nr"];
    flights.push({
      date,
      takeoff: stripLocationPrefix(String(r["Start"] || "").trim()),
      takeoffCountry: String(r["Start Land"] || "").trim(),
      landing: stripLocationPrefix(String(r["Landung"] || "").trim()),
      landingCountry: String(r["Landung Land"] || "").trim(),
      durationMinutes: parseDuration(r["Flugdauer"]),
      distanceKm: parseNum(r["Km"]),
      glider: String(r["Gleitschirm"] || "").trim(),
      comments: String(r["Beschreibung"] || "").trim(),
      sourceRef: nr == null || String(nr).trim() === "" ? null : String(nr).trim(),
    });
  });
  return { flights, invalidRows };
}

export function parseXlsx(data: ArrayBuffer): ParseResult {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return parseRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet));
}

export function collectUniqueLocations(flights: ParsedFlight[]) {
  const map = new Map<string, { name: string; country: string; type: "takeoff" | "landing" | "both" }>();

  for (const f of flights) {
    if (f.takeoff) {
      const key = f.takeoff.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        if (existing.type === "landing") existing.type = "both";
      } else {
        map.set(key, { name: f.takeoff, country: f.takeoffCountry, type: "takeoff" });
      }
    }
    if (f.landing) {
      const key = f.landing.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        if (existing.type === "takeoff") existing.type = "both";
      } else {
        map.set(key, { name: f.landing, country: f.landingCountry, type: "landing" });
      }
    }
  }

  return Array.from(map.values());
}

/** A flight already in the logbook, as needed to recognise a repeated import. */
export interface ExistingFlight {
  date: string;
  duration_minutes: number | null;
  source: string | null;
  source_ref: string | null;
  takeoff_name: string | null;
  landing_name: string | null;
}

const flightKey = (date: string, takeoff: string | null, landing: string | null, minutes: number | null) =>
  `${date}|${(takeoff ?? "").trim().toLowerCase()}|${(landing ?? "").trim().toLowerCase()}|${minutes ?? ""}`;

/**
 * Splits parsed flights into new ones and ones already in the logbook, so that importing the same export
 * twice does not double the flights. Same Flightbook number, or same date, take-off, landing and
 * duration as an existing flight (or as an earlier row of the same file), counts as already present.
 */
export function splitDuplicates(parsed: ParsedFlight[], existing: ExistingFlight[]): { fresh: ParsedFlight[]; duplicates: ParsedFlight[] } {
  const refs = new Set(existing.filter((e) => e.source === "flightbook" && e.source_ref).map((e) => e.source_ref as string));
  const keys = new Set(existing.map((e) => flightKey(e.date, e.takeoff_name, e.landing_name, e.duration_minutes)));
  const fresh: ParsedFlight[] = [], duplicates: ParsedFlight[] = [];
  for (const f of parsed) {
    const key = flightKey(f.date, f.takeoff, f.landing, f.durationMinutes);
    if ((f.sourceRef && refs.has(f.sourceRef)) || keys.has(key)) { duplicates.push(f); continue; }
    fresh.push(f);
    keys.add(key);
    if (f.sourceRef) refs.add(f.sourceRef);
  }
  return { fresh, duplicates };
}

/** Number of flights and total flight time, for the comparison with the source system. */
export function totals(flights: ParsedFlight[]): { flights: number; minutes: number } {
  return { flights: flights.length, minutes: flights.reduce((sum, f) => sum + (f.durationMinutes ?? 0), 0) };
}
