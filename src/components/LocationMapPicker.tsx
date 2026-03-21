import { useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface Props {
  latitude: number;
  longitude: number;
  onSelect: (lat: number, lng: number) => void;
}

function ClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterOnChange({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prev = map.getCenter();
  if (Math.abs(prev.lat - lat) > 0.0001 || Math.abs(prev.lng - lng) > 0.0001) {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }
  return null;
}

export default function LocationMapPicker({ latitude, longitude, onSelect }: Props) {
  const hasCoords = latitude !== 0 || longitude !== 0;
  const center: [number, number] = hasCoords ? [latitude, longitude] : [46.8, 7.6]; // Default: Switzerland
  const zoom = hasCoords ? 14 : 9;

  const handleClick = useCallback(
    (lat: number, lng: number) => {
      onSelect(Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6);
    },
    [onSelect]
  );

  return (
    <div className="rounded-md overflow-hidden border" style={{ height: 220 }}>
      <MapContainer center={center} zoom={zoom} className="h-full w-full" zoomControl={false}>
        <TileLayer
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution="OpenTopoMap"
          maxZoom={17}
        />
        <ClickHandler onSelect={handleClick} />
        {hasCoords && <Marker position={[latitude, longitude]} />}
      </MapContainer>
    </div>
  );
}
