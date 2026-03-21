export interface IGCPoint {
  lat: number;
  lng: number;
  altitude: number;
  pressureAltitude: number;
  time: string;
}

export interface IGCData {
  points: IGCPoint[];
  date: string | null;
  pilot: string | null;
  glider: string | null;
  maxAltitude: number;
  minAltitude: number;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
}

function parseLatitude(raw: string): number {
  const deg = parseInt(raw.slice(0, 2));
  const min = parseInt(raw.slice(2, 7)) / 1000;
  const dir = raw[7];
  const lat = deg + min / 60;
  return dir === "S" ? -lat : lat;
}

function parseLongitude(raw: string): number {
  const deg = parseInt(raw.slice(0, 3));
  const min = parseInt(raw.slice(3, 8)) / 1000;
  const dir = raw[8];
  const lng = deg + min / 60;
  return dir === "W" ? -lng : lng;
}

export function parseIGC(content: string): IGCData {
  const lines = content.split(/\r?\n/);
  const points: IGCPoint[] = [];
  let date: string | null = null;
  let pilot: string | null = null;
  let glider: string | null = null;

  for (const line of lines) {
    if (line.startsWith("HFDTE") || line.startsWith("HDTE")) {
      const match = line.match(/(\d{2})(\d{2})(\d{2})/);
      if (match) {
        const [, dd, mm, yy] = match;
        const year = parseInt(yy) > 80 ? `19${yy}` : `20${yy}`;
        date = `${year}-${mm}-${dd}`;
      }
    }
    if (line.startsWith("HFPLT") || line.startsWith("HPLT")) {
      pilot = line.split(":").slice(1).join(":").trim() || null;
    }
    if (line.startsWith("HFGTY") || line.startsWith("HGTY")) {
      glider = line.split(":").slice(1).join(":").trim() || null;
    }
    if (line.startsWith("B")) {
      const time = line.slice(1, 7);
      const latRaw = line.slice(7, 15);
      const lngRaw = line.slice(15, 24);
      const pressAlt = parseInt(line.slice(25, 30));
      const gpsAlt = parseInt(line.slice(30, 35));
      
      if (!isNaN(pressAlt) && !isNaN(gpsAlt)) {
        points.push({
          lat: parseLatitude(latRaw),
          lng: parseLongitude(lngRaw),
          altitude: gpsAlt,
          pressureAltitude: pressAlt,
          time: `${time.slice(0,2)}:${time.slice(2,4)}:${time.slice(4,6)}`,
        });
      }
    }
  }

  let maxAltitude = 0;
  let minAltitude = Infinity;
  for (const p of points) {
    if (p.altitude > maxAltitude) maxAltitude = p.altitude;
    if (p.altitude < minAltitude) minAltitude = p.altitude;
  }
  if (points.length === 0) minAltitude = 0;
  const startTime = points[0]?.time ?? null;
  const endTime = points[points.length - 1]?.time ?? null;

  let durationMinutes = 0;
  if (startTime && endTime) {
    const [sh, sm, ss] = startTime.split(":").map(Number);
    const [eh, em, es] = endTime.split(":").map(Number);
    durationMinutes = Math.round(((eh * 3600 + em * 60 + es) - (sh * 3600 + sm * 60 + ss)) / 60);
  }

  return { points, date, pilot, glider, maxAltitude, minAltitude, startTime, endTime, durationMinutes };
}
