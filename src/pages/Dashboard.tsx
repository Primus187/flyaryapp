import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Plane, Clock, MapPin, BarChart3 } from "lucide-react";

interface Stats {
  totalFlights: number;
  totalMinutes: number;
  uniqueTakeoffs: number;
  uniqueLandings: number;
}

interface RecentFlight {
  id: string;
  date: string;
  glider: string | null;
  duration_minutes: number | null;
  altitude_gain: number | null;
  takeoff_location: { name: string } | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ totalFlights: 0, totalMinutes: 0, uniqueTakeoffs: 0, uniqueLandings: 0 });
  const [recent, setRecent] = useState<RecentFlight[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: flights } = await supabase
        .from("flights")
        .select("id, date, glider, duration_minutes, altitude_gain, distance_km, takeoff_location_id, landing_location_id, locations!flights_takeoff_location_id_fkey(name)")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (flights) {
        const takeoffIds = new Set(flights.map(f => f.takeoff_location_id).filter(Boolean));
        const landingIds = new Set(flights.map(f => f.landing_location_id).filter(Boolean));
        setStats({
          totalFlights: flights.length,
          totalMinutes: flights.reduce((s, f) => s + (f.duration_minutes || 0), 0),
          uniqueTakeoffs: takeoffIds.size,
          uniqueLandings: landingIds.size,
        });
        setRecent(flights.slice(0, 5).map((f: any) => ({
          ...f,
          takeoff_location: f.locations,
        })));
      }
    };
    fetchData();
  }, [user]);

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flugtagebuch</h1>
          <p className="text-sm text-muted-foreground">Deine Übersicht</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/stats")} className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Stats
          </Button>
          <Button size="sm" onClick={() => navigate("/flights/new")} className="gap-1.5">
            <Plus className="h-4 w-4" /> Flug
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Plane, label: "Flüge", value: stats.totalFlights.toString() },
          { icon: Clock, label: "Flugzeit", value: formatDuration(stats.totalMinutes) },
          { icon: MapPin, label: "Startplätze", value: stats.uniqueTakeoffs.toString() },
          { icon: MapPin, label: "Landeplätze", value: stats.uniqueLandings.toString() },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label} className="border-0 shadow-sm bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-lg font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Letzte Flüge</h2>
        {recent.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground text-sm mb-3">Noch keine Flüge erfasst</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/flights/new")}>
                Ersten Flug erfassen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recent.map((f) => (
              <Card key={f.id} className="border-0 shadow-sm cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/flights/${f.id}`)}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{f.takeoff_location?.name || "–"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(f.date).toLocaleDateString("de-CH")} · {f.glider || "–"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{f.duration_minutes ? formatDuration(f.duration_minutes) : "–"}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{f.altitude_gain ? `+${f.altitude_gain}m` : ""}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ totalFlights: 0, totalMinutes: 0, totalAltitude: 0, totalDistance: 0 });
  const [recent, setRecent] = useState<RecentFlight[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: flights } = await supabase
        .from("flights")
        .select("id, date, glider, duration_minutes, altitude_gain, distance_km, takeoff_location_id, locations!flights_takeoff_location_id_fkey(name)")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (flights) {
        setStats({
          totalFlights: flights.length,
          totalMinutes: flights.reduce((s, f) => s + (f.duration_minutes || 0), 0),
          totalAltitude: flights.reduce((s, f) => s + (f.altitude_gain || 0), 0),
          totalDistance: flights.reduce((s, f) => s + (Number(f.distance_km) || 0), 0),
        });
        setRecent(flights.slice(0, 5).map((f: any) => ({
          ...f,
          takeoff_location: f.locations,
        })));
      }
    };
    fetchData();
  }, [user]);

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flugtagebuch</h1>
          <p className="text-sm text-muted-foreground">Deine Übersicht</p>
        </div>
        <Button size="sm" onClick={() => navigate("/flights/new")} className="gap-1.5">
          <Plus className="h-4 w-4" /> Flug
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Plane, label: "Flüge", value: stats.totalFlights.toString() },
          { icon: Clock, label: "Flugzeit", value: formatDuration(stats.totalMinutes) },
          { icon: Mountain, label: "Höhenmeter", value: `${stats.totalAltitude.toLocaleString()} m` },
          { icon: TrendingUp, label: "Strecke", value: `${stats.totalDistance.toFixed(1)} km` },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label} className="border-0 shadow-sm bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-lg font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Letzte Flüge</h2>
        {recent.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground text-sm mb-3">Noch keine Flüge erfasst</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/flights/new")}>
                Ersten Flug erfassen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recent.map((f) => (
              <Card key={f.id} className="border-0 shadow-sm cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/flights/${f.id}`)}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{f.takeoff_location?.name || "–"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(f.date).toLocaleDateString("de-CH")} · {f.glider || "–"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{f.duration_minutes ? formatDuration(f.duration_minutes) : "–"}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{f.altitude_gain ? `+${f.altitude_gain}m` : ""}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
