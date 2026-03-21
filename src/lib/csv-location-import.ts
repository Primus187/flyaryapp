export interface ParsedLocation {
  name: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  country: string;
  type: "takeoff" | "landing" | "both";
  notes: string;
}

export function parseLocationsCsv(text: string): ParsedLocation[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const results: ParsedLocation[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    if (row.length < 4) continue;

    const get = (col: string) => {
      const idx = header.indexOf(col);
      return idx >= 0 && idx < row.length ? row[idx].trim() : "";
    };

    const name = get("name");
    if (!name) continue;

    // Determine type from name prefix
    let type: "takeoff" | "landing" | "both" = "both";
    let cleanName = name;
    if (name.startsWith("SP ")) {
      type = "takeoff";
      cleanName = name.slice(3).trim();
    } else if (name.startsWith("LP ")) {
      type = "landing";
      cleanName = name.slice(3).trim();
    }

    // Parse coordinates [lng, lat]
    let latitude = 0;
    let longitude = 0;
    const coordStr = get("coordinates");
    if (coordStr) {
      const match = coordStr.match(/\[?\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\]?/);
      if (match) {
        longitude = parseFloat(match[1]);
        latitude = parseFloat(match[2]);
      }
    }

    const altStr = get("altitude");
    const altitude = altStr ? parseInt(altStr, 10) : null;

    results.push({
      name: cleanName,
      latitude,
      longitude,
      altitude: altitude && !isNaN(altitude) ? altitude : null,
      country: get("country"),
      type,
      notes: get("notes"),
    });
  }

  return results;
}

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
