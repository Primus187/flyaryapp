import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Users, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import EmptyState from "@/components/layout/EmptyState";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeading from "@/components/layout/SectionHeading";
import EventListItem from "@/components/events/EventListItem";

const CATEGORIES = ["height_flight", "basic_course", "experienced", "camp_air", "lecture"] as const;

interface Group { id: string; name: string; }
interface EventRow { id: string; group_id: string; title: string; status: string; event_date: string; event_type: string | null; event_category: string | null; meeting_point: string | null; max_participants: number | null; signup_deadline: string | null; groups: { name: string } | null; }
interface SignupRow { event_id: string; user_id: string; signed_up: boolean; }

function EventsSkeleton() {
  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between"><Skeleton className="h-8 w-24" /><Skeleton className="h-9 w-24 rounded-md" /></div>
      <Skeleton className="h-10 w-full rounded-md" />
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
    </div>
  );
}

export default function Events() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [isAdmin, setIsAdmin] = useState<Record<string, boolean>>({});
  const [canCreate, setCanCreate] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";

  useEffect(() => {
    if (!user) return;
    const fetchGroups = async () => {
      const { data: members } = await supabase.from("group_members").select("group_id, role, groups(id, name, group_type)").eq("user_id", user.id);
      if (members) {
        const g = members.map((m: any) => m.groups).filter(Boolean); setGroups(g);
        const adminMap: Record<string, boolean> = {}; const canCreateMap: Record<string, boolean> = {};
        members.forEach((m: any) => { if (m.groups) { adminMap[m.groups.id] = m.role === "admin"; canCreateMap[m.groups.id] = m.role === "admin" || m.groups.group_type === "pilot_group"; } });
        setIsAdmin(adminMap); setCanCreate(canCreateMap);
      }
      setLoading(false);
    };
    fetchGroups();
  }, [user]);

  useEffect(() => {
    if (!user || groups.length === 0) return;
    const fetchEvents = async () => {
      let query = supabase.from("flight_events").select("id, group_id, title, status, event_date, event_type, event_category, meeting_point, max_participants, signup_deadline, groups(name)").order("event_date", { ascending: true });
      if (selectedGroup !== "all") query = query.eq("group_id", selectedGroup);
      const { data } = await query; if (data) setEvents(data as any);
      const eventIds = (data || []).map((e: any) => e.id);
      if (eventIds.length > 0) { const { data: sups } = await supabase.from("event_signups").select("event_id, user_id, signed_up").in("event_id", eventIds); if (sups) setSignups(sups); }
    };
    fetchEvents();
  }, [user, groups, selectedGroup]);

  const toggleSignup = async (eventId: string) => {
    if (!user) return;
    const existing = signups.find(s => s.event_id === eventId && s.user_id === user.id);
    if (existing) { const newVal = !existing.signed_up; await supabase.from("event_signups").update({ signed_up: newVal, updated_at: new Date().toISOString() }).eq("event_id", eventId).eq("user_id", user.id); setSignups(prev => prev.map(s => s.event_id === eventId && s.user_id === user.id ? { ...s, signed_up: newVal } : s)); }
    else { await supabase.from("event_signups").insert({ event_id: eventId, user_id: user.id, signed_up: true }); setSignups(prev => [...prev, { event_id: eventId, user_id: user.id, signed_up: true }]); }
  };

  const anyCanCreate = Object.values(canCreate).some(Boolean);
  const now = new Date();
  const visible = selectedCategory === "all" ? events : events.filter(e => e.event_category === selectedCategory);
  const upcoming = visible.filter(e => new Date(e.event_date) >= now);
  const past = visible.filter(e => new Date(e.event_date) < now);

  if (loading) return <EventsSkeleton />;

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title={t("events.title")}
        action={anyCanCreate ? (
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/events/new")}><Plus className="h-4 w-4" /> {t("events.newEvent")}</Button>
        ) : undefined}
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("events.noGroups")}
          description={t("emptyState.eventsDesc")}
          actionLabel={t("events.manageGroups")}
          onAction={() => navigate("/groups")}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("events.allGroups")} /></SelectTrigger>
              <SelectContent><SelectItem value="all">{t("events.allGroups")}</SelectItem>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("events.allCategories")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("events.allCategories")}</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{t(`events.categories.${c}`, { defaultValue: c })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {upcoming.length === 0 && past.length === 0 && (
            <EmptyState icon={Calendar} title={t("events.noEvents")} description={t("emptyState.noEventsDesc")} />
          )}
          {upcoming.length > 0 && <div className="space-y-2">{upcoming.map(ev => <EventCard key={ev.id} event={ev} signups={signups} userId={user!.id} onToggle={toggleSignup} onNavigate={() => navigate(`/events/${ev.id}`)} t={t} locale={locale} />)}</div>}
          {past.length > 0 && (<div className="space-y-2"><SectionHeading title={t("events.pastEvents")} className="mt-4" />{past.map(ev => <EventCard key={ev.id} event={ev} signups={signups} userId={user!.id} onToggle={toggleSignup} onNavigate={() => navigate(`/events/${ev.id}`)} t={t} locale={locale} past />)}</div>)}
        </>
      )}
      {anyCanCreate && (
        <Button
          size="icon"
          className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg"
          onClick={() => navigate("/events/new")}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
    </PageContainer>
  );
}

function EventCard({ event, signups, userId, onToggle, onNavigate, t, locale, past }: {
  event: EventRow; signups: SignupRow[]; userId: string; onToggle: (id: string) => void; onNavigate: () => void; t: any; locale: string; past?: boolean;
}) {
  const mySignup = signups.find(s => s.event_id === event.id && s.user_id === userId);
  const isSignedUp = mySignup?.signed_up ?? false;
  const totalSignedUp = signups.filter(s => s.event_id === event.id && s.signed_up).length;

  return (
    <EventListItem
      title={event.title}
      date={event.event_date}
      status={event.status}
      category={event.event_category}
      groupName={event.groups?.name}
      meetingPoint={event.meeting_point}
      signedUpCount={totalSignedUp}
      maxParticipants={event.max_participants}
      past={past}
      locale={locale}
      onClick={onNavigate}
      action={!past && event.status !== "cancelled" ? (
        <Button
          variant={isSignedUp ? "default" : "outline"}
          size="sm"
          className={`shrink-0 gap-1 ${isSignedUp ? "bg-green-600 hover:bg-green-700" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggle(event.id); }}
        >
          {isSignedUp ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {isSignedUp ? t("events.signedUpLabel") : t("events.signUp")}
        </Button>
      ) : undefined}
    />
  );
}
