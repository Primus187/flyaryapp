import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeading from "@/components/layout/SectionHeading";
import RoleModeSwitcher from "@/components/RoleModeSwitcher";
import { GraduationCap, CalendarDays, MessageCircle, Users, ClipboardList, Package, Coins, Receipt, BarChart3, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import SchoolOverview from "@/components/school/SchoolOverview";
import SchoolStudents from "@/components/school/SchoolStudents";
import SchoolDays from "@/components/school/SchoolDays";
import SchoolPeople from "@/components/school/SchoolPeople";
import SchoolEquipment from "@/components/school/SchoolEquipment";
import SchoolStats from "@/components/school/SchoolStats";
import SchoolBilling from "@/components/school/SchoolBilling";
import SchoolCredits from "@/components/school/SchoolCredits";
import GroupChat from "@/components/GroupChat";

interface SchoolGroup {
  id: string;
  name: string;
}

type Section = "days" | "chat" | "people" | "students" | "equipment" | "credits" | "billing" | "stats";

const SECTION_GROUPS: { titleKey: string; items: { key: Section; icon: any; labelKey: string }[] }[] = [
  {
    titleKey: "school.hub.operations",
    items: [
      { key: "days", icon: CalendarDays, labelKey: "school.flightDays" },
      { key: "chat", icon: MessageCircle, labelKey: "events.chat" },
    ],
  },
  {
    titleKey: "school.hub.people",
    items: [
      { key: "people", icon: Users, labelKey: "school.people.title" },
      { key: "students", icon: ClipboardList, labelKey: "school.students" },
    ],
  },
  {
    titleKey: "school.hub.admin",
    items: [
      { key: "equipment", icon: Package, labelKey: "school.equipment.title" },
      { key: "credits", icon: Coins, labelKey: "school.credits.title" },
      { key: "billing", icon: Receipt, labelKey: "school.billing.title" },
      { key: "stats", icon: BarChart3, labelKey: "school.stats.title" },
    ],
  },
];

export default function SchoolDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const activeSection = (SECTION_GROUPS.flatMap((g) => g.items).find((i) => i.key === section)?.key ?? null) as Section | null;

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

  // Load school groups where the user is admin, instructor or school lead
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [adminRes, functionRes] = await Promise.all([
        supabase.from("group_members").select("group_id").eq("user_id", user.id).eq("role", "admin"),
        supabase
          .from("group_member_functions")
          .select("group_id, function")
          .eq("user_id", user.id)
          .in("function", ["instructor", "school_lead"]),
      ]);

      const groupIds = Array.from(new Set([
        ...(adminRes.data || []).map((m) => m.group_id),
        ...(functionRes.data || []).map((m) => m.group_id),
      ]));

      if (!groupIds.length) {
        setLoading(false);
        return;
      }

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

  const renderSection = () => {
    switch (activeSection) {
      case "days":
        return <SchoolDays events={eventInfos} />;
      case "chat":
        return <GroupChat groupId={selectedGroupId} canAnnounce={true} />;
      case "people":
        return <SchoolPeople groupId={selectedGroupId} canManage={true} />;
      case "students":
        return <SchoolStudents students={studentInfos} />;
      case "equipment":
        return <SchoolEquipment groupId={selectedGroupId} />;
      case "credits":
        return <SchoolCredits groupId={selectedGroupId} />;
      case "billing":
        return <SchoolBilling groupId={selectedGroupId} />;
      case "stats":
        return <SchoolStats groupId={selectedGroupId} />;
      default:
        return null;
    }
  };

  if (activeSection) {
    const item = SECTION_GROUPS.flatMap((g) => g.items).find((i) => i.key === activeSection)!;
    return (
      <PageContainer className="space-y-4">
        <PageHeader
          back="/school"
          title={t(item.labelKey)}
          subtitle={schoolGroups.find((g) => g.id === selectedGroupId)?.name}
        />
        {renderSection()}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <RoleModeSwitcher />
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

      <SchoolOverview
        groupId={selectedGroupId}
        studentCount={studentMembers.length}
        nextEvent={nextEvent}
        openNotesCount={openNotesCount}
      />

      {SECTION_GROUPS.map((group) => (
        <section key={group.titleKey}>
          <SectionHeading title={t(group.titleKey)} />
          <div className="grid grid-cols-2 gap-3">
            {group.items.map(({ key, icon: Icon, labelKey }) => (
              <button
                key={key}
                type="button"
                onClick={() => navigate(`/school/${key}`)}
                className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/60 shadow-sm hover:bg-muted/50 active:scale-[0.97] transition-all text-left"
              >
                <Icon className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm font-medium leading-tight">{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </PageContainer>
  );
}
