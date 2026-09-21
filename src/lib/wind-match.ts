export const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type CompassPoint = (typeof COMPASS_POINTS)[number];

/** Rounds a wind direction in degrees (0-360, meteorological "from" convention) to the nearest 8-point compass direction. */
export function degreesToCompassPoint(degrees: number): CompassPoint {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return COMPASS_POINTS[index];
}

export type WindMatchStatus = "match" | "borderline" | "unsuitable";

/**
 * Compares a current wind direction against a location's optimal directions.
 * "borderline" covers the two compass points directly adjacent to an optimal one (45° off);
 * anything else, or no optimal directions configured, is "unsuitable".
 */
export function windMatchStatus(currentDegrees: number, optimalDirections: string[]): WindMatchStatus {
  const current = degreesToCompassPoint(currentDegrees);
  const currentIndex = COMPASS_POINTS.indexOf(current);
  const optimalIndices = optimalDirections
    .map((d) => COMPASS_POINTS.indexOf(d as CompassPoint))
    .filter((i) => i >= 0);

  if (optimalIndices.includes(currentIndex)) return "match";

  const isBorderline = optimalIndices.some((i) => {
    const diff = Math.abs(i - currentIndex);
    return diff === 1 || diff === COMPASS_POINTS.length - 1;
  });
  return isBorderline ? "borderline" : "unsuitable";
}

export interface OpenMeteoWind {
  directionDegrees: number;
  speedKmh: number;
}

/** Extracts current wind direction/speed from an Open-Meteo `/v1/forecast?current=wind_direction_10m,wind_speed_10m` response. */
export function parseOpenMeteoWind(json: unknown): OpenMeteoWind | null {
  const current = (json as { current?: { wind_direction_10m?: unknown; wind_speed_10m?: unknown } } | null)?.current;
  const direction = current?.wind_direction_10m;
  const speed = current?.wind_speed_10m;
  if (typeof direction !== "number" || typeof speed !== "number") return null;
  return { directionDegrees: direction, speedKmh: speed };
}
