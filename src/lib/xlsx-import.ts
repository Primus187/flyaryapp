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
}

function parseDate(raw: any): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  // If it's already a JS Date (xlsx auto-parses)
  if (raw instanceof Date) {
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  // DD.MM.YYYY
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}

function parseDuration(raw: any): number | null {
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

function parseNum(raw: any): number | null {
  if (raw == null || raw === "") return null;
  const n = parseFloat(String(raw).replace(",", "."));
  return isNaN(n) ? null : n;
}

export function parseXlsx(data: ArrayBuffer): ParsedFlight[] {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(sheet);

  return rows
    .filter((r: any) => r["Datum"])
    .map((r: any) => ({
      date: parseDate(r["Datum"]),
      takeoff: String(r["Start"] || "").trim(),
      takeoffCountry: String(r["Start Land"] || "").trim(),
      landing: String(r["Landung"] || "").trim(),
      landingCountry: String(r["Landung Land"] || "").trim(),
      durationMinutes: parseDuration(r["Flugdauer"]),
      distanceKm: parseNum(r["Km"]),
      glider: String(r["Gleitschirm"] || "").trim(),
      comments: String(r["Beschreibung"] || "").trim(),
    }));
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
