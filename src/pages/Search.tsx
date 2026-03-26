import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Search as SearchIcon, Plane, MapPin, Calendar, User } from "lucide-react";

type Tab = "all" | "flights" | "locations" | "events" | "pilots";

interface FlightResult { id: string; date: string; glider: string | null; takeoff_name: string | null; landing_name: string | null; comments: string | null; }
interface LocationResult { id: string; name: string; type: string; altitude: number | null; }
interface EventResult { id: string; title: string; event_date: string; event_type: string | null; }
interface PilotResult { user_id: string; pilot_name: string; avatar_url: string | null; }

export default function SearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [flights, setFlights] = useState<FlightResult[]>([]);
  const [locations, setLocations] = useState<LocationResult[]>([]);
  const [events, setEvents] = useState<EventResult[]>([]);
  const [pilots, setPilots] = useState<PilotResult[]>([]);
  const [loading, setLoading] = useState(false);

  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setLoading(true);
      const [flightsRes, locsRes, eventsRes] = await Promise.all([
        supabase.from("flights").select("id, date, glider, comments, locations!flights_takeoff_location_id_fkey(name), land:locations!flights_landing_location_id_fkey(name)").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("locations").select("id, name, type, altitude").eq("user_id", user.id).order("name"),
        supabase.from("flight_events").select("id, title, event_date, event_type, group_id"),
      ]);
      if (flightsRes.data) setFlights(flightsRes.data.map((f: any) => ({ ...f, takeoff_name: f.locations?.name || null, landing_name: f.land?.name || null })));
      if (locsRes.data) setLocations(locsRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);

      // Load pilots from groups
      const { data: memberships } = await supabase.from("group_members").select("group_id").eq("user_id", user.id);
      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map(m => m.group_id);
        const { data: members } = await supabase.from("group_members").select("user_id").in("group_id", groupIds);
        if (members) {
          const uids = [...new Set(members.map(m => m.user_id))];
          const { data: profiles } = await supabase.from("profiles").select("user_id, pilot_name, avatar_url").in("user_id", uids);
          if (profiles) setPilots(profiles.filter(p => p.pilot_name) as PilotResult[]);
        }
      }
      setLoading(false);
    };
    loadData();
  }, [user]);

  const q = query.toLowerCase().trim();

  const filteredFlights = useMemo(() => {
    if (!q) return [];
    return flights.filter(f =>
      f.date?.includes(q) || f.glider?.toLowerCase().includes(q) ||
      f.takeoff_name?.toLowerCase().includes(q) || f.landing_name?.toLowerCase().includes(q) ||
      f.comments?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [flights, q]);

  const filteredLocations = useMemo(() => {
    if (!q) return [];
    return locations.filter(l => l.name.toLowerCase().includes(q)).slice(0, 20);
  }, [locations, q]);

  const filteredEvents = useMemo(() => {
    if (!q) return [];
    return events.filter(e => e.title.toLowerCase().includes(q) || e.event_type?.toLowerCase().includes(q)).slice(0, 20);
  }, [events, q]);

  const filteredPilots = useMemo(() => {
    if (!q) return [];
    return pilots.filter(p => p.pilot_name?.toLowerCase().includes(q)).slice(0, 20);
  }, [pilots, q]);

  const totalResults = filteredFlights.length + filteredLocations.length + filteredEvents.length + filteredPilots.length;

  const formatDuration = (min: number | null) => { if (!min) return ""; const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };
  const typeLabel = (ty: string) => ty === "takeoff" ? t("locations.takeoff") : ty === "landing" ? t("locations.landingPlace") : t("locations.both");

  const showFlights = tab === "all" || tab === "flights";
  const showLocations = tab === "all" || tab === "locations";
  const showEvents = tab === "all" || tab === "events";
  const showPilots = tab === "all" || tab === "pilots";

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold tracking-tight">{t("search.title")}</h1>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t("search.placeholder")}
          className="pl-9"
          autoFocus
        />
      </div>

      {q && (
        <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">{t("common.all")}</TabsTrigger>
            <TabsTrigger value="flights" className="flex-1">{t("dashboard.flights")}</TabsTrigger>
            <TabsTrigger value="locations" className="flex-1">{t("locations.title")}</TabsTrigger>
            <TabsTrigger value="pilots" className="flex-1">{t("search.pilots")}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {q && totalResults === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-8">{t("search.noResults")}</p>
      )}

      {q && showFlights && filteredFlights.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Plane className="h-3 w-3" /> {t("dashboard.flights")} ({filteredFlights.length})
          </h2>
          <div className="space-y-1.5">
            {filteredFlights.map(f => (
              <Card key={f.id} className="border-0 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/flights/${f.id}`)}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{f.takeoff_name || "–"}{f.landing_name ? ` → ${f.landing_name}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{new Date(f.date).toLocaleDateString(locale)}{f.glider ? ` · ${f.glider}` : ""}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {q && showLocations && filteredLocations.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> {t("locations.title")} ({filteredLocations.length})
          </h2>
          <div className="space-y-1.5">
            {filteredLocations.map(l => (
              <Card key={l.id} className="border-0 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/locations/${l.id}`)}>
                <CardContent className="p-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{typeLabel(l.type)}{l.altitude ? ` · ${l.altitude}m` : ""}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {q && showEvents && filteredEvents.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="h-3 w-3" /> {t("events.title")} ({filteredEvents.length})
          </h2>
          <div className="space-y-1.5">
            {filteredEvents.map(e => (
              <Card key={e.id} className="border-0 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/events/${e.id}`)}>
                <CardContent className="p-3">
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(e.event_date).toLocaleDateString(locale)}{e.event_type ? ` · ${e.event_type}` : ""}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {q && showPilots && filteredPilots.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <User className="h-3 w-3" /> {t("search.pilots")} ({filteredPilots.length})
          </h2>
          <div className="space-y-1.5">
            {filteredPilots.map(p => (
              <Card key={p.user_id} className="border-0 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/pilot/${p.user_id}`)}>
                <CardContent className="p-3">
                  <p className="text-sm font-medium">{p.pilot_name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!q && !loading && (
        <p className="text-sm text-muted-foreground text-center py-8">{t("search.hint")}</p>
      )}
    </div>
  );
}
