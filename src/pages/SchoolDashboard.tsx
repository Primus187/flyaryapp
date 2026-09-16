import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import SchoolOverview from "@/components/school/SchoolOverview";
import SchoolStudents from "@/components/school/SchoolStudents";
import SchoolDays from "@/components/school/SchoolDays";
import SchoolPeople from "@/components/school/SchoolPeople";
import SchoolEquipment from "@/components/school/SchoolEquipment";
import SchoolStats from "@/components/school/SchoolStats";
import GroupChat from "@/components/GroupChat";

interface SchoolGroup {
  id: string;
  name: string;
}

export default function SchoolDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [schoolGroups, setSchoolGroups] = useState<SchoolGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Data states
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [signups, setSignups] = useState<any[]>([]);
  const [dayNotes, setDayNotes] = useState<any[]>([]);
  const [flights, setFlights] = useState<any[]>([]);
  const [trainingProgress, setTrainingProgress] = useState<any[]>([]);
  const [examItemCount, setExamItemCount] = useState(0);

  // Load school groups where user is admin
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: memberRows } = await supabase
        .from("group_members")
        .select("group_id, role")
        .eq("user_id", user.id)
        .eq("role", "admin");

      if (!memberRows?.length) {
        setLoading(false);
        return;
      }

      const groupIds = memberRows.map((m) => m.group_id);
      const { data: groups } = await supabase
        .from("groups")
        .select("id, name, group_type")
        .in("id", groupIds)
        .eq("group_type", "school");

      const schoolGrps = (groups || []).map((g) => ({ id: g.id, name: g.name }));
      setSchoolGroups(schoolGrps);
      if (schoolGrps.length > 0) {
        setSelectedGroupId(schoolGrps[0].id);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Load group data when selected group changes
  useEffect(() => {
    if (!selectedGroupId || !user) return;
    const load = async () => {
      const [membersRes, eventsRes, examItems] = await Promise.all([
        supabase.from("group_members").select("user_id, role").eq("group_id", selectedGroupId),
        supabase.from("flight_events").select("id, title, event_date, status").eq("group_id", selectedGroupId).order("event_date", { ascending: false }),
        supabase.from("training_items").select("id").eq("is_exam_maneuver", true),
      ]);

      const memberList = membersRes.data || [];
      const eventList = eventsRes.data || [];
      setMembers(memberList);
      setEvents(eventList);
      setExamItemCount((examItems.data || []).length);

      const studentUserIds = memberList.filter((m) => m.role === "member").map((m) => m.user_id);
      const eventIds = eventList.map((e) => e.id);

      if (studentUserIds.length > 0) {
        const [profilesRes, flightsRes, progressRes] = await Promise.all([
          supabase.from("profiles").select("user_id, pilot_name, training_level").in("user_id", studentUserIds),
          supabase.from("flights").select("id, user_id, date").eq("group_id", selectedGroupId).in("user_id", studentUserIds),
          supabase.from("training_progress").select("user_id, item_id, rating").in("user_id", studentUserIds),
        ]);
        setProfiles(profilesRes.data || []);
        setFlights(flightsRes.data || []);
        setTrainingProgress(progressRes.data || []);
      } else {
        setProfiles([]);
        setFlights([]);
        setTrainingProgress([]);
      }

      if (eventIds.length > 0) {
        const [signupsRes, notesRes] = await Promise.all([
          supabase.from("event_signups").select("event_id, user_id, signed_up").in("event_id", eventIds).eq("signed_up", true),
          supabase.from("student_day_notes" as any).select("event_id, student_user_id, flight_number, note").in("event_id", eventIds),
        ]);
        setSignups(signupsRes.data || []);
        setDayNotes((notesRes.data as any[]) || []);
      } else {
        setSignups([]);
        setDayNotes([]);
      }
    };
    load();
  }, [selectedGroupId, user]);

  // Derived data
  const studentMembers = useMemo(() => members.filter((m) => m.role === "member"), [members]);

  const studentInfos = useMemo(() => {
    return studentMembers.map((m) => {
      const profile = profiles.find((p) => p.user_id === m.user_id);
      const studentFlights = flights.filter((f) => f.user_id === m.user_id);
      const studentProgress = trainingProgress.filter((tp) => tp.user_id === m.user_id && tp.rating >= 3);
      const examProgress = examItemCount > 0 ? Math.round((studentProgress.length / examItemCount) * 100) : 0;
      const summaries = dayNotes.filter((n: any) => n.student_user_id === m.user_id && n.flight_number === null && n.note);
      const lastSummary = summaries.length > 0 ? summaries[0].note : null;

      return {
        userId: m.user_id,
        pilotName: profile?.pilot_name || "",
        trainingLevel: profile?.training_level,
        flightCount: studentFlights.length,
        examProgress: Math.min(examProgress, 100),
        lastSummary,
      };
    });
  }, [studentMembers, profiles, flights, trainingProgress, dayNotes, examItemCount]);

  const eventInfos = useMemo(() => {
    return events.map((ev) => {
      const participantCount = signups.filter((s) => s.event_id === ev.id).length;
      const notesCount = dayNotes.filter((n: any) => n.event_id === ev.id).length;
      return { ...ev, participantCount, notesCount };
    });
  }, [events, signups, dayNotes]);

  const nextEvent = useMemo(() => {
    const upcoming = events.filter((e) => new Date(e.event_date) >= new Date() && e.status !== "cancelled");
    return upcoming.length > 0 ? upcoming[upcoming.length - 1] : null;
  }, [events]);

  const openNotesCount = useMemo(() => {
    // Events in the last 30 days without any notes
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentEvents = events.filter((e) => new Date(e.event_date) >= thirtyDaysAgo && new Date(e.event_date) <= new Date());
    return recentEvents.filter((e) => !dayNotes.some((n: any) => n.event_id === e.id)).length;
  }, [events, dayNotes]);

  if (loading) {
    return (
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (schoolGroups.length === 0) {
    return (
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto text-center space-y-3">
        <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto" />
        <h1 className="text-xl font-bold">{t("school.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("school.noSchool")}</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-6 w-6 text-primary" />
        {schoolGroups.length === 1 ? (
          <h1 className="text-xl font-bold truncate">{schoolGroups[0].name}</h1>
        ) : (
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="border-0 shadow-none text-xl font-bold p-0 h-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {schoolGroups.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1 text-xs">{t("school.overview")}</TabsTrigger>
          <TabsTrigger value="people" className="flex-1 text-xs">{t("school.people.title")}</TabsTrigger>
          <TabsTrigger value="students" className="flex-1 text-xs">{t("school.students")}</TabsTrigger>
          <TabsTrigger value="days" className="flex-1 text-xs">{t("school.flightDays")}</TabsTrigger>
          <TabsTrigger value="equipment" className="flex-1 text-xs">{t("school.equipment.title")}</TabsTrigger>
          <TabsTrigger value="stats" className="flex-1 text-xs">{t("school.stats.title")}</TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 text-xs">{t("events.chat")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SchoolOverview
            groupId={selectedGroupId}
            studentCount={studentMembers.length}
            nextEvent={nextEvent}
            openNotesCount={openNotesCount}
          />
        </TabsContent>

        <TabsContent value="people">
          <SchoolPeople groupId={selectedGroupId} canManage={true} />
        </TabsContent>

        <TabsContent value="students">
          <SchoolStudents students={studentInfos} />
        </TabsContent>

        <TabsContent value="days">
          <SchoolDays events={eventInfos} />
        </TabsContent>

        <TabsContent value="equipment">
          <SchoolEquipment groupId={selectedGroupId} />
        </TabsContent>

        <TabsContent value="stats">
          <SchoolStats groupId={selectedGroupId} />
        </TabsContent>

        <TabsContent value="chat">
          <GroupChat groupId={selectedGroupId} canAnnounce={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
