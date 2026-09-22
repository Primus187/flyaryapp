import { useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useSchoolGroups } from "@/hooks/use-school-access";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeading from "@/components/layout/SectionHeading";
import RoleModeSwitcher from "@/components/RoleModeSwitcher";
import { useRoleMode } from "@/contexts/RoleModeContext";
import { canOpenSchoolSection } from "@/lib/school-sections";
import TeamHome from "@/components/school/TeamHome";
import { GraduationCap, CalendarDays, MessageCircle, Users, Users2, ClipboardList, Package, Coins, Receipt, BarChart3, ShieldAlert, CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { type StudentStatus } from "@/lib/student-status";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { performanceRpc, type SchoolDashboardData } from "@/lib/performance-api";
import { Button } from "@/components/ui/button";
import SchoolOverview from "@/components/school/SchoolOverview";
const SchoolStudents = lazy(() => import("@/components/school/SchoolStudents"));
const SchoolDays = lazy(() => import("@/components/school/SchoolDays"));
const SchoolPeople = lazy(() => import("@/components/school/SchoolPeople"));
const SchoolEquipment = lazy(() => import("@/components/school/SchoolEquipment"));
const SchoolStats = lazy(() => import("@/components/school/SchoolStats"));
const SchoolBilling = lazy(() => import("@/components/school/SchoolBilling"));
const SchoolCredits = lazy(() => import("@/components/school/SchoolCredits"));
const SchoolSafety = lazy(() => import("@/components/school/SchoolSafety"));
const TeamAvailability = lazy(() => import("@/components/school/TeamAvailability"));
const TeamPolls = lazy(() => import("@/components/school/TeamPolls"));
const GroupChat = lazy(() => import("@/components/GroupChat"));

type Section = "days" | "chat" | "teamChat" | "people" | "students" | "safety" | "availability" | "equipment" | "credits" | "billing" | "stats";

const SECTION_GROUPS: { titleKey: string; items: { key: Section; icon: any; labelKey: string }[] }[] = [
  {
    titleKey: "school.hub.operations",
    items: [
      { key: "days", icon: CalendarDays, labelKey: "school.flightDays" },
      { key: "chat", icon: MessageCircle, labelKey: "events.chat" },
      { key: "teamChat", icon: Users2, labelKey: "school.teamChat.title" },
    ],
  },
  {
    titleKey: "school.hub.people",
    items: [
      { key: "people", icon: Users, labelKey: "school.people.title" },
      { key: "students", icon: ClipboardList, labelKey: "school.students" },
      { key: "safety", icon: ShieldAlert, labelKey: "school.safety.title" },
      { key: "availability", icon: CalendarClock, labelKey: "school.availability.title" },
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
  const { toast } = useToast();
  const { section } = useParams<{ section?: string }>();
  const activeSection = (SECTION_GROUPS.flatMap((g) => g.items).find((i) => i.key === section)?.key ?? null) as Section | null;

  const groupQuery = useSchoolGroups();
  const schoolGroups = groupQuery.data || [];
  const { schoolGroupId: selectedGroupId, setSchoolGroupId: setSelectedGroupId, canManageSchool, setMode } = useRoleMode();
  useEffect(() => { if (selectedGroupId) setMode("school"); }, [selectedGroupId, setMode]);
  const loading = groupQuery.isPending;

  const queryClient = useQueryClient();
  const sectionData = useQuery({
    queryKey: ["school-dashboard", user?.id, selectedGroupId, activeSection || "overview"],
    enabled: !!selectedGroupId && !!user && canManageSchool,
    staleTime: 30_000,
    queryFn: ({ signal }) => performanceRpc<SchoolDashboardData>("school_dashboard_data", {
      _group_id: selectedGroupId, _section: activeSection || "overview", _viewer_id: user!.id,
    }, signal),
  });
  const handleStudentStatusChange = async (userId: string, status: StudentStatus, reason: string | null) => {
    if (!selectedGroupId || !user) return;
    const { error } = await supabase.from("student_status_history" as never).insert({
      group_id: selectedGroupId, student_id: userId, status, reason, changed_by: user.id, changed_at: new Date().toISOString(),
    } as never);
    if (error) {
      toast({ title: t("school.studentStatus.saveFailed"), description: error.message, variant: "destructive" });
      throw error;
    }
    await queryClient.invalidateQueries({ queryKey: ["school-dashboard", user.id, selectedGroupId] });
    await queryClient.invalidateQueries({ queryKey: ["inactive-students", user.id, selectedGroupId] });
  };

  useEffect(() => {
    if (groupQuery.data && !groupQuery.data.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(groupQuery.data[0]?.id || "");
    }
  }, [groupQuery.data, selectedGroupId, setSelectedGroupId]);

  const isSchoolAdmin = sectionData.data?.isAdmin ?? false;
  const studentInfos = sectionData.data?.students || [];
  const eventInfos = sectionData.data?.events || [];
  const nextEvent = sectionData.data?.nextEvent ?? null;
  const openNotesCount = sectionData.data?.openNotesCount ?? 0;

  if (loading || (selectedGroupId && canManageSchool && sectionData.isPending)) {
    return (
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (groupQuery.isError) return <PageContainer><p role="alert">{t("performance.loadFailed")}</p><Button onClick={() => void groupQuery.refetch()}>{t("performance.retry")}</Button></PageContainer>;

  if (schoolGroups.length === 0) {
    return (
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto text-center space-y-3">
        <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto" />
        <h1 className="text-xl font-bold">{t("school.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("school.noSchool")}</p>
      </div>
    );
  }

  if (sectionData.isError) return <PageContainer><PageHeader back="/school" title={t("school.title")} /><div role="alert" className="space-y-3"><p>{t("performance.loadFailed")}</p><Button onClick={() => void sectionData.refetch()}>{t("performance.retry")}</Button></div></PageContainer>;

  const renderSection = () => {
    if (!canOpenSchoolSection(activeSection, canManageSchool)) return <p role="alert">{t("journeys.staffOnly")}</p>;
    switch (activeSection) {
      case "days":
        return canManageSchool ? <SchoolDays events={eventInfos} /> : <TeamHome groupId={selectedGroupId} />;
      case "chat":
        return <GroupChat groupId={selectedGroupId} canAnnounce={true} />;
      case "teamChat":
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{t("school.teamChat.hint")}</p>
            <TeamPolls groupId={selectedGroupId} canManage={canManageSchool} />
            <GroupChat groupId={selectedGroupId} canAnnounce={canManageSchool} teamOnly />
          </div>
        );
      case "people":
        return <SchoolPeople groupId={selectedGroupId} canManage={true} isAdmin={isSchoolAdmin} />;
      case "students":
       return <SchoolStudents groupId={selectedGroupId} students={studentInfos} onStatusChange={handleStudentStatusChange} />;
      case "safety":
        return <SchoolSafety groupId={selectedGroupId} />;
      case "availability":
        return <TeamAvailability groupId={selectedGroupId} canManage={canManageSchool} />;
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
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}><div key={selectedGroupId}>{renderSection()}</div></Suspense>
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

      {canManageSchool ? <SchoolOverview
        groupId={selectedGroupId}
        studentCount={sectionData.data?.studentCount ?? 0}
        nextEvent={nextEvent}
        openNotesCount={openNotesCount}
        openBilling={sectionData.data?.openBilling ?? 0}
        licensedCount={sectionData.data?.licensedCount ?? 0}
        nextSignups={sectionData.data?.nextSignups ?? 0}
      /> : <TeamHome groupId={selectedGroupId} />}

      {SECTION_GROUPS.filter(group => group.items.some(item => canOpenSchoolSection(item.key, canManageSchool))).map((group) => (
        <section key={group.titleKey}>
          <SectionHeading title={t(group.titleKey)} />
          <div className="grid grid-cols-2 gap-3">
            {group.items.filter(item => canOpenSchoolSection(item.key, canManageSchool)).map(({ key, icon: Icon, labelKey }) => (
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
