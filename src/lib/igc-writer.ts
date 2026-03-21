/**
 * Generate an IGC file from recorded GPS track points.
 */

export interface RecordedPoint {
  lat: number;
  lng: number;
  altitude: number; // GPS altitude in metres
  timestamp: number; // Unix ms
}

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function latToIGC(lat: number): string {
  const dir = lat >= 0 ? "N" : "S";
  const abs = Math.abs(lat);
  const deg = Math.floor(abs);
  const minWhole = (abs - deg) * 60;
  const minInt = Math.floor(minWhole);
  const minDec = Math.round((minWhole - minInt) * 1000);
  return `${pad(deg)}${pad(minInt)}${pad(minDec, 3)}${dir}`;
}

function lngToIGC(lng: number): string {
  const dir = lng >= 0 ? "E" : "W";
  const abs = Math.abs(lng);
  const deg = Math.floor(abs);
  const minWhole = (abs - deg) * 60;
  const minInt = Math.floor(minWhole);
  const minDec = Math.round((minWhole - minInt) * 1000);
  return `${pad(deg, 3)}${pad(minInt)}${pad(minDec, 3)}${dir}`;
}

export function generateIGC(
  points: RecordedPoint[],
  pilot = "",
  glider = ""
): string {
  if (points.length === 0) return "";

  const first = new Date(points[0].timestamp);
  const dd = pad(first.getUTCDate());
  const mm = pad(first.getUTCMonth() + 1);
  const yy = pad(first.getUTCFullYear() % 100);

  const lines: string[] = [
    "AXLV Lovable Flight Recorder",
    `HFDTE${dd}${mm}${yy}`,
    `HFPLTPILOTINCHARGE:${pilot}`,
    `HFGTYGLIDERTYPE:${glider}`,
    "HFDTM100GPSDATUM:WGS-84",
    "HFFTYFR TYPE:Lovable PWA",
    "I013638FXA",
  ];

  for (const p of points) {
    const d = new Date(p.timestamp);
    const hh = pad(d.getUTCHours());
    const mi = pad(d.getUTCMinutes());
    const ss = pad(d.getUTCSeconds());
    const lat = latToIGC(p.lat);
    const lng = lngToIGC(p.lng);
    const alt = Math.round(p.altitude);
    const altStr = pad(Math.max(0, alt), 5);
    // B record: time, lat, lng, A(valid), press alt (=gps alt), gps alt, FXA
    lines.push(`B${hh}${mi}${ss}${lat}${lng}A${altStr}${altStr}000`);
  }

  return lines.join("\r\n") + "\r\n";
}
