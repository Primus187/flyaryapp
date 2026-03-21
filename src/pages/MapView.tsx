import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

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

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map(([lat, lng]) => [lat, lng])), { padding: [30, 30] });
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    }
  }, [map, points]);
  return null;
}

export default function MapView() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<any[]>([]);
  const [trackPoints, setTrackPoints] = useState<[number, number][]>([]);

  const flightId = searchParams.get("flight");

  useEffect(() => {
    if (!user) return;
    supabase.from("locations").select("*").eq("user_id", user.id).then(({ data }) => {
      if (data) setLocations(data);
    });

    if (flightId) {
      supabase.from("igc_tracks").select("track_data").eq("flight_id", flightId).maybeSingle().then(({ data }) => {
        if (data?.track_data?.points) {
          setTrackPoints(data.track_data.points.map((p: any) => [p.lat, p.lng]));
        }
      });
    }
  }, [user, flightId]);

  const center: [number, number] = trackPoints.length > 0
    ? trackPoints[Math.floor(trackPoints.length / 2)]
    : locations.length > 0
      ? [locations[0].latitude, locations[0].longitude]
      : [46.8, 8.2]; // Swiss center

  return (
    <div className="h-screen w-full relative">
      <MapContainer center={center} zoom={10} className="h-full w-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          maxZoom={17}
        />

        {locations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.latitude, loc.longitude]}
            icon={loc.type === "landing" ? landingIcon : takeoffIcon}
          >
            <Popup>
              <div className="text-sm">
                <strong>{loc.name}</strong>
                <br />
                <span className="text-xs capitalize">{loc.type}</span>
                {loc.altitude && <span className="text-xs"> · {loc.altitude}m</span>}
              </div>
            </Popup>
          </Marker>
        ))}

        {trackPoints.length > 0 && (
          <>
            <Polyline positions={trackPoints} pathOptions={{ color: "hsl(199, 89%, 38%)", weight: 3 }} />
            <FitBounds points={trackPoints} />
          </>
        )}

        {trackPoints.length === 0 && locations.length > 0 && (
          <FitBounds points={locations.map((l) => [l.latitude, l.longitude] as [number, number])} />
        )}
      </MapContainer>

      {/* Back button overlay */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-[1000] bg-card/90 backdrop-blur-sm rounded-full p-2 shadow-lg"
      >
        ←
      </button>
    </div>
  );
}
