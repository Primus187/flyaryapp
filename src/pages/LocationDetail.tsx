import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Pencil, Trash2, MapPin, Mountain, Navigation, FileText, Plane } from "lucide-react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const markerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const typeLabel = (t: string) => t === "takeoff" ? "Startplatz" : t === "landing" ? "Landeplatz" : "Beides";
const typeColor = (t: string) => t === "takeoff" ? "text-secondary" : t === "landing" ? "text-destructive" : "text-primary";

export default function LocationDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [location, setLocation] = useState<any>(null);
  const [flights, setFlights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    const load = async () => {
      const [locRes, flightsRes] = await Promise.all([
        supabase.from("locations").select("*").eq("id", id).eq("user_id", user.id).single(),
        supabase
          .from("flights")
          .select("*, takeoff:takeoff_location_id(name), landing:landing_location_id(name)")
          .eq("user_id", user.id)
          .or(`takeoff_location_id.eq.${id},landing_location_id.eq.${id}`)
          .order("date", { ascending: false }),
      ]);
      if (locRes.data) setLocation(locRes.data);
      if (flightsRes.data) setFlights(flightsRes.data);
      setLoading(false);
    };
    load();
  }, [user, id]);

  const handleDelete = async () => {
    if (!confirm("Ort löschen?")) return;
    await supabase.from("locations").delete().eq("id", id!);
    toast({ title: "Ort gelöscht" });
    navigate("/locations");
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Laden...</div>;
  if (!location) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Ort nicht gefunden</div>;

  const hasCoords = location.latitude !== 0 || location.longitude !== 0;

  const formatDuration = (min: number | null) => {
    if (!min) return "—";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  const getCounterLocation = (flight: any) => {
    if (flight.takeoff_location_id === id) {
      return flight.landing?.name ? `→ ${flight.landing.name}` : "";
    }
    return flight.takeoff?.name ? `${flight.takeoff.name} →` : "";
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/locations")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold tracking-tight">{location.name}</h1>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/locations`)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Map */}
      {hasCoords && (
        <div className="rounded-xl overflow-hidden border border-border shadow-sm" style={{ height: 220 }}>
          <MapContainer
            center={[location.latitude, location.longitude]}
            zoom={13}
            className="h-full w-full"
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution="OpenTopoMap"
              maxZoom={17}
            />
            <Marker position={[location.latitude, location.longitude]} icon={markerIcon} />
          </MapContainer>
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
              <MapPin className="h-3 w-3" /> Typ
            </div>
            <p className={`text-sm font-medium ${typeColor(location.type)}`}>{typeLabel(location.type)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
              <Mountain className="h-3 w-3" /> Höhe
            </div>
            <p className="text-sm font-medium">{location.altitude ? `${location.altitude} m` : "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
              <Navigation className="h-3 w-3" /> Koordinaten
            </div>
            <p className="text-sm font-medium">
              {hasCoords ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : "Nicht gesetzt"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
              <Plane className="h-3 w-3" /> Flüge
            </div>
            <p className="text-sm font-medium">{flights.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {location.description && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
              <FileText className="h-3 w-3" /> Beschreibung
            </div>
            <p className="text-sm">{location.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Flights */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Flüge an diesem Ort</h2>
        {flights.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Noch keine Flüge</p>
        ) : (
          <div className="space-y-2">
            {flights.map((f) => (
              <Card
                key={f.id}
                className="border-0 shadow-sm cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/flights/${f.id}`)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(f.date), "dd. MMM yyyy", { locale: de })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getCounterLocation(f)}
                      {f.duration_minutes && <span> · {formatDuration(f.duration_minutes)}</span>}
                      {f.glider && <span> · {f.glider}</span>}
                    </p>
                  </div>
                  <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground rotate-180" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
