import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface TrackPoint {
  lat: number;
  lng: number;
  altitude: number;
  time: string;
}

interface Props {
  points: TrackPoint[];
  onHoverIndex?: (index: number | null) => void;
  animIndex?: number | null;
}

export default function FlightAltitudeProfile({ points, onHoverIndex, animIndex }: Props) {
  const data = useMemo(() => {
    // Downsample for chart performance
    const step = Math.max(1, Math.floor(points.length / 300));
    return points
      .filter((_, i) => i % step === 0 || i === points.length - 1)
      .map((p, idx) => ({
        idx: idx * step,
        time: p.time,
        altitude: p.altitude,
      }));
  }, [points]);

  // Map animIndex (original points index) to downsampled data index
  const animDataIndex = useMemo(() => {
    if (animIndex == null || data.length === 0) return null;
    const step = Math.max(1, Math.floor(points.length / 300));
    const mapped = Math.round(animIndex / step);
    return Math.min(mapped, data.length - 1);
  }, [animIndex, data, points.length]);

  if (data.length < 2) return null;

  let minAlt = Infinity, maxAlt = -Infinity;
  for (const d of data) {
    if (d.altitude < minAlt) minAlt = d.altitude;
    if (d.altitude > maxAlt) maxAlt = d.altitude;
  }
  const padding = Math.max(50, (maxAlt - minAlt) * 0.1);

  return (
    <div className="w-full rounded-xl border border-border bg-card p-3" style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          onMouseMove={(e: any) => {
            if (e?.activePayload?.[0]?.payload?.idx != null) {
              onHoverIndex?.(e.activePayload[0].payload.idx);
            }
          }}
          onMouseLeave={() => onHoverIndex?.(null)}
        >
          <defs>
            <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            domain={[Math.floor(minAlt - padding), Math.ceil(maxAlt + padding)]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={45}
            tickFormatter={(v: number) => `${v}m`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2 shadow-md text-xs">
                  <p className="font-medium">{d.time}</p>
                  <p>{d.altitude} m</p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="altitude"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#altGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
          />
          {animDataIndex != null && data[animDataIndex] && (
            <ReferenceLine
              x={data[animDataIndex].time}
              stroke="#ffffff"
              strokeWidth={1.5}
              ifOverflow="extendDomain"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
