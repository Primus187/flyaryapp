import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Users, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Group { id: string; name: string; }
interface EventRow {
  id: string;
  group_id: string;
  title: string;
  status: string;
  event_date: string;
  event_type: string | null;
  meeting_point: string | null;
  max_participants: number | null;
  signup_deadline: string | null;
  groups: { name: string } | null;
}
interface SignupRow { event_id: string; user_id: string; signed_up: boolean; }

export default function Events() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [isAdmin, setIsAdmin] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchGroups = async () => {
      const { data: members } = await supabase
        .from("group_members")
        .select("group_id, role, groups(id, name)")
        .eq("user_id", user.id);
      if (members) {
        const g = members.map((m: any) => m.groups).filter(Boolean);
        setGroups(g);
        const adminMap: Record<string, boolean> = {};
        members.forEach((m: any) => { if (m.groups) adminMap[m.groups.id] = m.role === "admin"; });
        setIsAdmin(adminMap);
      }
      setLoading(false);
    };
    fetchGroups();
  }, [user]);

  useEffect(() => {
    if (!user || groups.length === 0) return;
    const fetchEvents = async () => {
      let query = supabase
        .from("flight_events")
        .select("id, group_id, title, status, event_date, event_type, meeting_point, max_participants, signup_deadline, groups(name)")
        .order("event_date", { ascending: true });
      if (selectedGroup !== "all") query = query.eq("group_id", selectedGroup);

      const { data } = await query;
      if (data) setEvents(data as any);

      const eventIds = (data || []).map((e: any) => e.id);
      if (eventIds.length > 0) {
        const { data: sups } = await supabase.from("event_signups").select("event_id, user_id, signed_up").in("event_id", eventIds);
        if (sups) setSignups(sups);
      }
    };
    fetchEvents();
  }, [user, groups, selectedGroup]);

  const toggleSignup = async (eventId: string) => {
    if (!user) return;
    const existing = signups.find(s => s.event_id === eventId && s.user_id === user.id);
    if (existing) {
      const newVal = !existing.signed_up;
      await supabase.from("event_signups").update({ signed_up: newVal, updated_at: new Date().toISOString() }).eq("event_id", eventId).eq("user_id", user.id);
      setSignups(prev => prev.map(s => s.event_id === eventId && s.user_id === user.id ? { ...s, signed_up: newVal } : s));
    } else {
      await supabase.from("event_signups").insert({ event_id: eventId, user_id: user.id, signed_up: true });
      setSignups(prev => [...prev, { event_id: eventId, user_id: user.id, signed_up: true }]);
    }
  };

  const statusLabel = (s: string) => s === "confirmed" ? "Bestätigt" : s === "cancelled" ? "Abgesagt" : "Angekündigt";
  const statusVariant = (s: string): "default" | "secondary" | "destructive" => s === "confirmed" ? "default" : s === "cancelled" ? "destructive" : "secondary";

  const isPast = (d: string) => new Date(d) < new Date();
  const anyAdmin = Object.values(isAdmin).some(Boolean);

  const now = new Date();
  const upcoming = events.filter(e => new Date(e.event_date) >= now);
  const past = events.filter(e => new Date(e.event_date) < now);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Laden...</div>;

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Termine</h1>
        {anyAdmin && (
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/events/new")}>
            <Plus className="h-4 w-4" /> Termin
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Du bist noch keiner Gruppe beigetreten</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/groups")}>
            Gruppen verwalten
          </Button>
        </div>
      ) : (
        <>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Alle Gruppen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Gruppen</SelectItem>
              {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {upcoming.length === 0 && past.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Noch keine Termine</p>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-2">
              {upcoming.map(ev => <EventCard key={ev.id} event={ev} signups={signups} userId={user!.id} onToggle={toggleSignup} onNavigate={() => navigate(`/events/${ev.id}`)} />)}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4">Vergangene Termine</h2>
              {past.map(ev => <EventCard key={ev.id} event={ev} signups={signups} userId={user!.id} onToggle={toggleSignup} onNavigate={() => navigate(`/events/${ev.id}`)} past />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EventCard({ event, signups, userId, onToggle, onNavigate, past }: {
  event: EventRow; signups: SignupRow[]; userId: string;
  onToggle: (id: string) => void; onNavigate: () => void; past?: boolean;
}) {
  const mySignup = signups.find(s => s.event_id === event.id && s.user_id === userId);
  const isSignedUp = mySignup?.signed_up ?? false;
  const totalSignedUp = signups.filter(s => s.event_id === event.id && s.signed_up).length;
  const statusLabel = event.status === "confirmed" ? "Bestätigt" : event.status === "cancelled" ? "Abgesagt" : "Angekündigt";
  const statusColor = event.status === "confirmed" ? "bg-green-100 text-green-800 hover:bg-green-100/80" : event.status === "cancelled" ? "bg-red-100 text-red-800 hover:bg-red-100/80" : "bg-blue-100 text-blue-800 hover:bg-blue-100/80";

  return (
    <Card className={`border-0 shadow-sm transition-colors ${past ? "opacity-60" : "hover:bg-accent/50 cursor-pointer"}`}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2" onClick={onNavigate}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-medium text-sm truncate">{event.title}</p>
              <Badge className={`text-[10px] shrink-0 ${statusColor}`}>{statusLabel}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(event.event_date).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              {event.event_type && ` · ${event.event_type}`}
              {event.groups?.name && ` · ${event.groups.name}`}
            </p>
            {event.meeting_point && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> {event.meeting_point}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              <Users className="h-3 w-3 inline mr-1" />
              {totalSignedUp}{event.max_participants ? `/${event.max_participants}` : ""} angemeldet
            </p>
          </div>
          {!past && event.status !== "cancelled" && (
            <Button
              variant={isSignedUp ? "default" : "outline"}
              size="sm"
              className={`shrink-0 gap-1 ${isSignedUp ? "bg-green-600 hover:bg-green-700" : ""}`}
              onClick={(e) => { e.stopPropagation(); onToggle(event.id); }}
            >
              {isSignedUp ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {isSignedUp ? "Dabei" : "Anmelden"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
