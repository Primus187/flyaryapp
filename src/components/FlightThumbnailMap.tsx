import { useMemo } from "react";

interface Props {
  points: [number, number][]; // [lat, lng]
  size?: number;
  className?: string;
}

/**
 * Lightweight SVG mini-map: scales lat/lng to fit a square, draws polyline + start/end markers.
 * No tile layer, no Leaflet dependency — designed for list rendering.
 */
export default function FlightThumbnailMap({ points, size = 64, className }: Props) {
  const path = useMemo(() => {
    if (points.length < 2) return null;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of points) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    const latRange = Math.max(maxLat - minLat, 0.0001);
    const lngRange = Math.max(maxLng - minLng, 0.0001);
    const range = Math.max(latRange, lngRange);
    const padding = size * 0.12;
    const inner = size - padding * 2;

    const project = (lat: number, lng: number): [number, number] => {
      const cx = (minLng + maxLng) / 2;
      const cy = (minLat + maxLat) / 2;
      const x = padding + inner / 2 + ((lng - cx) / range) * inner;
      const y = padding + inner / 2 - ((lat - cy) / range) * inner; // y flip
      return [x, y];
    };

    const projected = points.map(([lat, lng]) => project(lat, lng));
    const d = projected.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const start = projected[0];
    const end = projected[projected.length - 1];
    return { d, start, end };
  }, [points, size]);

  if (!path) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      <rect width={size} height={size} rx={size * 0.18} fill="hsl(var(--muted))" />
      <path
        d={path.d}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.95}
      />
      {/* Start marker (green) */}
      <circle cx={path.start[0]} cy={path.start[1]} r={3} fill="hsl(142 70% 45%)" stroke="hsl(var(--background))" strokeWidth={1} />
      {/* End marker (red) */}
      <circle cx={path.end[0]} cy={path.end[1]} r={3} fill="hsl(0 75% 55%)" stroke="hsl(var(--background))" strokeWidth={1} />
    </svg>
  );
}
