export interface IGCPoint {
  lat: number;
  lng: number;
  altitude: number;
  pressureAltitude: number;
  time: string;
}

export type XcShape = "free" | "free_3tp" | "fai_triangle" | "flat_triangle";

export interface XcOptimization {
  shape: XcShape;
  distanceKm: number;       // Best optimized distance
  scoreKm: number;          // Distance with shape multiplier (FAI=1.4, flat=1.2, free=1.0)
  turnpoints: { lat: number; lng: number; index: number }[]; // start, tp1, tp2, tp3, end
  isFai: boolean;
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
  maxClimbRate: number;    // m/s
  maxSinkRate: number;     // m/s (negative)
  avgSpeedKmh: number;
  totalDistanceKm: number;
  xcDistanceKm: number;    // Best optimized XC distance (km)
  xcOptimization: XcOptimization | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeXcDistance(points: IGCPoint[]): number {
  // Downsample to ~500 points for O(n²) brute-force
  const step = Math.max(1, Math.floor(points.length / 500));
  const sampled = points.filter((_, i) => i % step === 0);
  let maxDist = 0;
  for (let i = 0; i < sampled.length; i++) {
    for (let j = i + 1; j < sampled.length; j++) {
      const d = haversineKm(sampled[i].lat, sampled[i].lng, sampled[j].lat, sampled[j].lng);
      if (d > maxDist) maxDist = d;
    }
  }
  return Math.round(maxDist * 100) / 100;
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
  let maxClimbRate = 0;
  let maxSinkRate = 0;
  let totalDistanceKm = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.altitude > maxAltitude) maxAltitude = p.altitude;
    if (p.altitude < minAltitude) minAltitude = p.altitude;

    if (i > 0) {
      const prev = points[i - 1];
      // Time diff in seconds
      const [ph, pm, ps] = prev.time.split(":").map(Number);
      const [ch, cm, cs] = p.time.split(":").map(Number);
      const dt = (ch * 3600 + cm * 60 + cs) - (ph * 3600 + pm * 60 + ps);
      if (dt > 0) {
        const vario = (p.altitude - prev.altitude) / dt;
        if (vario > maxClimbRate) maxClimbRate = vario;
        if (vario < maxSinkRate) maxSinkRate = vario;
      }
      totalDistanceKm += haversineKm(prev.lat, prev.lng, p.lat, p.lng);
    }
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

  const avgSpeedKmh = durationMinutes > 0 ? totalDistanceKm / (durationMinutes / 60) : 0;

  const xcDistanceKm = computeXcDistance(points);

  return { points, date, pilot, glider, maxAltitude, minAltitude, startTime, endTime, durationMinutes, maxClimbRate: Math.round(maxClimbRate * 10) / 10, maxSinkRate: Math.round(maxSinkRate * 10) / 10, avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10, totalDistanceKm: Math.round(totalDistanceKm * 100) / 100, xcDistanceKm };
}
