import { useCallback, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

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
  showSearch?: boolean;
}

function ClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef({ lat: 0, lng: 0 });
  if (Math.abs(prevRef.current.lat - lat) > 0.0001 || Math.abs(prevRef.current.lng - lng) > 0.0001) {
    prevRef.current = { lat, lng };
    map.flyTo([lat, lng], 14, { duration: 0.8 });
  }
  return null;
}

export default function LocationMapPicker({ latitude, longitude, onSelect, showSearch = false }: Props) {
  const hasCoords = latitude !== 0 || longitude !== 0;
  const center: [number, number] = hasCoords ? [latitude, longitude] : [46.8, 7.6];
  const zoom = hasCoords ? 14 : 9;
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleClick = useCallback(
    (lat: number, lng: number) => {
      onSelect(Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6);
      setResults([]);
      setQuery("");
    },
    [onSelect]
  );

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value.trim())}&limit=5&addressdetails=0`
        );
        const data = await res.json();
        setResults(data || []);
      } catch { setResults([]); }
      setSearching(false);
    }, 400);
  };

  const handleSelectResult = (r: { lat: string; lon: string; display_name: string }) => {
    const lat = Math.round(parseFloat(r.lat) * 1e6) / 1e6;
    const lng = Math.round(parseFloat(r.lon) * 1e6) / 1e6;
    onSelect(lat, lng);
    setQuery(r.display_name.split(",")[0]);
    setResults([]);
  };

  return (
    <div className="space-y-1.5">
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />}
          <Input
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Ort suchen…"
            className="pl-8 h-8 text-xs"
          />
          {results.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-40 overflow-y-auto">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectResult(r)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 truncate"
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="rounded-md overflow-hidden border" style={{ height: 220 }}>
        <MapContainer center={center} zoom={zoom} className="h-full w-full" zoomControl={false}>
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            attribution="OpenTopoMap"
            maxZoom={17}
          />
          <ClickHandler onSelect={handleClick} />
          {hasCoords && <Marker position={[latitude, longitude]} />}
          {hasCoords && <FlyTo lat={latitude} lng={longitude} />}
        </MapContainer>
      </div>
    </div>
  );
}
