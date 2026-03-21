import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const takeoffIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const landingIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

interface LocationPoint {
  name?: string;
  latitude: number;
  longitude: number;
}

interface Props {
  takeoff?: LocationPoint | null;
  landing?: LocationPoint | null;
  trackPoints?: [number, number][];
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    }
  }, [map, points]);
  return null;
}

const isValid = (loc?: LocationPoint | null): loc is LocationPoint =>
  !!loc && (loc.latitude !== 0 || loc.longitude !== 0);

export default function FlightDetailMap({ takeoff, landing, trackPoints = [] }: Props) {
  const hasTrack = trackPoints.length > 0;
  const hasTakeoff = isValid(takeoff);
  const hasLanding = isValid(landing);

  if (!hasTakeoff && !hasLanding && !hasTrack) return null;

  const boundsPoints: [number, number][] = hasTrack
    ? trackPoints
    : [
        ...(hasTakeoff ? [[takeoff.latitude, takeoff.longitude] as [number, number]] : []),
        ...(hasLanding ? [[landing.latitude, landing.longitude] as [number, number]] : []),
      ];

  const center: [number, number] = boundsPoints.length > 0
    ? boundsPoints[Math.floor(boundsPoints.length / 2)]
    : [46.8, 8.2];

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-sm" style={{ height: 250 }}>
      <MapContainer center={center} zoom={12} className="h-full w-full" zoomControl={false}>
        <TileLayer
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution="OpenTopoMap"
          maxZoom={17}
        />
        {hasTakeoff && (
          <Marker position={[takeoff.latitude, takeoff.longitude]} icon={takeoffIcon}>
            <Popup><span className="text-sm font-medium">{takeoff.name || "Start"}</span></Popup>
          </Marker>
        )}
        {hasLanding && (
          <Marker position={[landing.latitude, landing.longitude]} icon={landingIcon}>
            <Popup><span className="text-sm font-medium">{landing.name || "Landung"}</span></Popup>
          </Marker>
        )}
        {hasTrack && (
          <Polyline positions={trackPoints} pathOptions={{ color: "hsl(199, 89%, 38%)", weight: 3 }} />
        )}
        <FitBounds points={boundsPoints} />
      </MapContainer>
    </div>
  );
}
