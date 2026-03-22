import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface Goal {
  id: string;
  label: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  goal_type: string;
  location_name?: string;
}

interface Props {
  goals: Goal[];
  completedGoalIds?: Set<string>;
}

const GOAL_TYPE_COLORS: Record<string, string> = {
  start: "#22c55e",
  turnpoint: "#3b82f6",
  waypoint: "#f59e0b",
  goal: "#ef4444",
};

export default function ChallengeMap({ goals, completedGoalIds }: Props) {
  const goalsWithCoords = goals.filter(g => g.latitude && g.longitude);
  if (goalsWithCoords.length === 0) return null;

  // Calculate bounds
  const lats = goalsWithCoords.map(g => g.latitude!);
  const lngs = goalsWithCoords.map(g => g.longitude!);
  const bounds = L.latLngBounds(
    [Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01],
    [Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01]
  );

  return (
    <div className="rounded-xl overflow-hidden border" style={{ height: 200 }}>
      <MapContainer bounds={bounds} className="h-full w-full" zoomControl={false}>
        <TileLayer
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution="OpenTopoMap"
          maxZoom={17}
        />
        {goalsWithCoords.map(goal => {
          const color = GOAL_TYPE_COLORS[goal.goal_type] || "#6b7280";
          const isCompleted = completedGoalIds?.has(goal.id);
          return (
            <div key={goal.id}>
              <Circle
                center={[goal.latitude!, goal.longitude!]}
                radius={goal.radius_meters}
                pathOptions={{
                  color: isCompleted ? "#22c55e" : color,
                  fillColor: isCompleted ? "#22c55e" : color,
                  fillOpacity: isCompleted ? 0.3 : 0.15,
                  weight: 2,
                }}
              />
              <Marker position={[goal.latitude!, goal.longitude!]}>
                <Popup>
                  <span className="text-xs font-medium">
                    {goal.label || goal.location_name || "Waypoint"}
                  </span>
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}
