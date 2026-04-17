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


function downsample<T>(arr: T[], target: number): { sampled: T[]; indices: number[] } {
  const step = Math.max(1, Math.floor(arr.length / target));
  const sampled: T[] = [];
  const indices: number[] = [];
  for (let i = 0; i < arr.length; i += step) {
    sampled.push(arr[i]);
    indices.push(i);
  }
  return { sampled, indices };
}

/**
 * Compute optimized XC distance per FAI/XContest-style scoring:
 *  - Free flight (start → tp1 → tp2 → tp3 → end), 5 points, ×1.0
 *  - Flat triangle (closed, tp1→tp2→tp3→tp1), ×1.2
 *  - FAI triangle (closed + each leg ≥ 28% of total), ×1.4
 * Closing tolerance: closing leg ≤ 20% of triangle perimeter (XContest rule).
 * Returns the highest-scoring shape.
 */
function computeXcOptimization(points: IGCPoint[]): XcOptimization | null {
  if (points.length < 2) return null;

  const { sampled, indices } = downsample(points, 120);
  const n = sampled.length;
  if (n < 2) return null;

  // Pairwise distances (km)
  const dist: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineKm(sampled[i].lat, sampled[i].lng, sampled[j].lat, sampled[j].lng);
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }

  // Best free distance with up to 3 turnpoints: maximize d(s,a)+d(a,b)+d(b,c)+d(c,e)
  // O(n^4) on n=120 ≈ 200M — too slow. Use a relaxed approach:
  // For every (a,b,c) with a<b<c, pick best s≤a (max d(s,a)) and best e≥c (max d(c,e)).
  // Precompute: bestStart[a] = argmax over s≤a of dist[s][a]; bestEnd[c] = argmax over e≥c of dist[c][e].
  const bestStartIdx = new Array(n).fill(0);
  const bestStartDist = new Array(n).fill(0);
  for (let a = 0; a < n; a++) {
    let best = 0, bestI = a;
    for (let s = 0; s <= a; s++) {
      if (dist[s][a] > best) { best = dist[s][a]; bestI = s; }
    }
    bestStartDist[a] = best;
    bestStartIdx[a] = bestI;
  }
  const bestEndIdx = new Array(n).fill(0);
  const bestEndDist = new Array(n).fill(0);
  for (let c = 0; c < n; c++) {
    let best = 0, bestI = c;
    for (let e = c; e < n; e++) {
      if (dist[c][e] > best) { best = dist[c][e]; bestI = e; }
    }
    bestEndDist[c] = best;
    bestEndIdx[c] = bestI;
  }

  let bestShape: XcShape = "free";
  let bestScore = 0;
  let bestDist = 0;
  let bestTps: number[] = [];
  let bestIsFai = false;

  // Also track simple free distance (2-point) as fallback
  let freeMax = 0, freeI = 0, freeJ = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (dist[i][j] > freeMax) { freeMax = dist[i][j]; freeI = i; freeJ = j; }
    }
  }
  bestShape = "free";
  bestDist = freeMax;
  bestScore = freeMax;
  bestTps = [freeI, freeI, freeJ, freeJ, freeJ];

  // Iterate triangle/3-tp candidates
  for (let a = 0; a < n - 2; a++) {
    for (let b = a + 1; b < n - 1; b++) {
      const dab = dist[a][b];
      if (dab < 1) continue;
      for (let c = b + 1; c < n; c++) {
        const dbc = dist[b][c];
        const dca = dist[c][a];
        const triPerim = dab + dbc + dca;
        if (triPerim < bestScore) continue; // optimistic prune

        // 3-turnpoint free distance
        const free3 = bestStartDist[a] + dab + dbc + bestEndDist[c];
        if (free3 > bestScore) {
          bestScore = free3;
          bestDist = free3;
          bestShape = "free_3tp";
          bestTps = [bestStartIdx[a], a, b, c, bestEndIdx[c]];
          bestIsFai = false;
        }

        // Triangle: closing leg = distance between start and end (must be small)
        // Use start = bestStartIdx[a], end = bestEndIdx[c], measure d(start,end)
        const sIdx = bestStartIdx[a];
        const eIdx = bestEndIdx[c];
        const closing = dist[sIdx][eIdx];
        if (closing <= 0.2 * triPerim) {
          // Valid closed triangle
          const minLeg = Math.min(dab, dbc, dca);
          const isFai = minLeg >= 0.28 * triPerim;
          const mult = isFai ? 1.4 : 1.2;
          const score = triPerim * mult;
          if (score > bestScore) {
            bestScore = score;
            bestDist = triPerim;
            bestShape = isFai ? "fai_triangle" : "flat_triangle";
            bestTps = [sIdx, a, b, c, eIdx];
            bestIsFai = isFai;
          }
        }
      }
    }
  }

  const turnpoints = bestTps.map((i) => ({
    lat: sampled[i].lat,
    lng: sampled[i].lng,
    index: indices[i] ?? 0,
  }));

  return {
    shape: bestShape,
    distanceKm: Math.round(bestDist * 100) / 100,
    scoreKm: Math.round(bestScore * 100) / 100,
    turnpoints,
    isFai: bestIsFai,
  };
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

  const xcOptimization = computeXcOptimization(points);
  const xcDistanceKm = xcOptimization?.scoreKm ?? 0;

  return { points, date, pilot, glider, maxAltitude, minAltitude, startTime, endTime, durationMinutes, maxClimbRate: Math.round(maxClimbRate * 10) / 10, maxSinkRate: Math.round(maxSinkRate * 10) / 10, avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10, totalDistanceKm: Math.round(totalDistanceKm * 100) / 100, xcDistanceKm, xcOptimization };
}
