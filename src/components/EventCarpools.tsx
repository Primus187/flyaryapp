import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Car, Plus, Trash2, UserPlus, UserMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Carpool {
  id: string;
  event_id: string;
  driver_user_id: string;
  seats: number;
  departure_place: string | null;
  departure_time: string | null;
}

interface Rider { id: string; carpool_id: string; user_id: string; }

interface Props {
  eventId: string;
  isSignedUp: boolean;
}

export default function EventCarpools({ eventId, isSignedUp }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [carpools, setCarpools] = useState<Carpool[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ seats: "3", departure_place: "", departure_time: "" });

  const load = async () => {
    const { data: cps } = await supabase.from("event_carpools" as any).select("*").eq("event_id", eventId);
    const carpoolList = (cps as any[]) || [];
    setCarpools(carpoolList);
    if (carpoolList.length > 0) {
      const { data: rds } = await supabase.from("event_carpool_riders" as any).select("*").in("carpool_id", carpoolList.map((c) => c.id));
      setRiders((rds as any[]) || []);
      const userIds = [...new Set([...carpoolList.map((c) => c.driver_user_id), ...(((rds as any[]) || []).map((r) => r.user_id))])];
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", userIds);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p.pilot_name || "Pilot"; });
        setNames(map);
      }
    } else {
      setRiders([]);
    }
  };

  useEffect(() => { load(); }, [eventId]);

  const myCarpool = carpools.find((c) => c.driver_user_id === user?.id);
  const myRiderEntry = riders.find((r) => r.user_id === user?.id);

  const createCarpool = async () => {
    if (!user) return;
    const seats = parseInt(form.seats) || 1;
    const { error } = await supabase.from("event_carpools" as any).insert({
      event_id: eventId,
      driver_user_id: user.id,
      seats,
      departure_place: form.departure_place.trim() || null,
      departure_time: form.departure_time || null,
    } as any);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } else {
      setShowAdd(false);
      await load();
    }
  };

  const deleteCarpool = async (id: string) => {
    await supabase.from("event_carpools" as any).delete().eq("id", id);
    await load();
  };

  const joinCarpool = async (carpoolId: string) => {
    if (!user) return;
    if (myRiderEntry) {
      await supabase.from("event_carpool_riders" as any).delete().eq("id", myRiderEntry.id);
    }
    const { error } = await supabase.from("event_carpool_riders" as any).insert({ carpool_id: carpoolId, user_id: user.id } as any);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } else {
      await load();
    }
  };

  const leaveCarpool = async () => {
    if (!myRiderEntry) return;
    await supabase.from("event_carpool_riders" as any).delete().eq("id", myRiderEntry.id);
    await load();
  };

  if (!isSignedUp && carpools.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Car className="h-3.5 w-3.5" /> {t("events.carpool.title")}
        </h2>
        {isSignedUp && !myCarpool && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3.5 w-3.5" /> {t("events.carpool.offer")}
          </Button>
        )}
      </div>

      {carpools.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground">{t("events.carpool.empty")}</p>
      )}

      {carpools.map((cp) => {
        const cpRiders = riders.filter((r) => r.carpool_id === cp.id);
        const freeSeats = cp.seats - cpRiders.length;
        const isMine = cp.driver_user_id === user?.id;
        const amRider = cpRiders.some((r) => r.user_id === user?.id);
        return (
          <Card key={cp.id} className="border-0 shadow-sm">
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{names[cp.driver_user_id] || "Pilot"}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant={freeSeats > 0 ? "secondary" : "destructive"} className="text-[9px] px-1.5 py-0 h-4">
                    {freeSeats > 0 ? t("events.carpool.freeSeats", { count: freeSeats }) : t("events.carpool.full")}
                  </Badge>
                  {isMine && (
                    <button onClick={() => deleteCarpool(cp.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {(cp.departure_place || cp.departure_time) && (
                <p className="text-[11px] text-muted-foreground">
                  {cp.departure_time ? cp.departure_time.slice(0, 5) : ""}{cp.departure_time && cp.departure_place ? " · " : ""}{cp.departure_place || ""}
                </p>
              )}
              {cpRiders.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cpRiders.map((r) => (
                    <Badge key={r.id} variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                      {names[r.user_id] || "Pilot"}
                    </Badge>
                  ))}
                </div>
              )}
              {isSignedUp && !isMine && (
                amRider ? (
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={leaveCarpool}>
                    <UserMinus className="h-3 w-3" /> {t("events.carpool.leave")}
                  </Button>
                ) : freeSeats > 0 ? (
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => joinCarpool(cp.id)}>
                    <UserPlus className="h-3 w-3" /> {t("events.carpool.join")}
                  </Button>
                ) : null
              )}
            </CardContent>
          </Card>
        );
      })}

      {showAdd && !myCarpool && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" min={1} max={8} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} placeholder={t("events.carpool.seats")} className="h-8 text-xs" />
              <Input type="time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} className="h-8 text-xs" />
              <Input value={form.departure_place} onChange={(e) => setForm({ ...form, departure_place: e.target.value })} placeholder={t("events.carpool.place")} className="h-8 text-xs" />
            </div>
            <Button size="sm" className="w-full h-8" onClick={createCarpool}>{t("events.carpool.offer")}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
