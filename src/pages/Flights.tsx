import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plane, Plus } from "lucide-react";
import EmptyState from "@/components/EmptyState";

interface Flight { id: string; date: string; glider: string | null; duration_minutes: number | null; altitude_gain: number | null; distance_km: number | null; group_id: string | null; takeoff_location: { name: string } | null; landing_location: { name: string } | null; }
interface Group { id: string; name: string; }

function FlightsSkeleton() {
  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between"><Skeleton className="h-8 w-28" /><Skeleton className="h-9 w-20 rounded-md" /></div>
      <Skeleton className="h-10 w-full rounded-md" />
      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
    </div>
  );
}

export default function Flights() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("flights").select("id, date, glider, duration_minutes, altitude_gain, distance_km, group_id, locations!flights_takeoff_location_id_fkey(name), land:locations!flights_landing_location_id_fkey(name)").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("group_members").select("group_id, groups(id, name)").eq("user_id", user.id)
    ]).then(([flightsRes, groupsRes]) => {
      if (flightsRes.data) setFlights(flightsRes.data.map((f: any) => ({ ...f, takeoff_location: f.locations, landing_location: f.land })));
      if (groupsRes.data) setGroups(groupsRes.data.map((gm: any) => gm.groups).filter(Boolean));
      setLoading(false);
    });
  }, [user]);

  const filtered = flights.filter((f) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || f.takeoff_location?.name?.toLowerCase().includes(q) || f.glider?.toLowerCase().includes(q) || f.date.includes(q);
    const matchesGroup = groupFilter === "all" || (groupFilter === "none" ? f.group_id === null : f.group_id === groupFilter);
    return matchesSearch && matchesGroup;
  });
  const formatDuration = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };

  if (loading) return <FlightsSkeleton />;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("flights.title")}</h1>
        <Button size="sm" onClick={() => navigate("/flights/new")}>
          <Plus className="h-4 w-4 mr-1" />
          {t("dashboard.newFlight")}
        </Button>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("flights.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {groups.length > 0 && (
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              <SelectItem value="none">{t("flights.noGroup")}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      {filtered.length === 0 ? (
        flights.length === 0 ? (
          <EmptyState
            icon={Plane}
            title={t("dashboard.noFlights")}
            description={t("emptyState.flightsDesc")}
            actionLabel={t("dashboard.firstFlight")}
            onAction={() => navigate("/flights/new")}
          />
        ) : (
          <EmptyState icon={Plane} title={t("flights.noFlights")} />
        )
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <Card key={f.id} className="border-0 shadow-sm cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/flights/${f.id}`)}>
              <CardContent className="p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{f.takeoff_location?.name || t("common.unknown")}</p>
                    {f.landing_location?.name && <p className="text-xs text-muted-foreground">→ {f.landing_location.name}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(f.date).toLocaleDateString(locale)}</span>
                </div>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  {f.duration_minutes && <span>⏱ {formatDuration(f.duration_minutes)}</span>}
                  {f.altitude_gain && <span>↑ {f.altitude_gain}m</span>}
                  {f.distance_km && <span>↔ {Number(f.distance_km).toFixed(1)}km</span>}
                  {f.glider && <span>🪂 {f.glider}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
