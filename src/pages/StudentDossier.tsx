import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleMode } from "@/contexts/RoleModeContext";
import { useSchoolGroups } from "@/hooks/use-school-access";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { dossierSections, examPercent, fetchDossier, type DossierSection, type Overview } from "@/lib/student-dossier";
import { matchesTrainingFilter, trainingFilter, type TrainingFilter } from "@/lib/training-level";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StudentEquipmentCheck from "@/components/school/StudentEquipmentCheck";
import SchoolProofPanel from "@/components/school/SchoolProofPanel";

// The training proof (6.2) has its own RPC, so it is not one of the dossier RPC sections.
const tabs = [...dossierSections, "proof"] as const;
type Tab = typeof tabs[number];

export default function StudentDossier() {
  const { groupId = "", studentId = "" } = useParams();
  const { t } = useTranslation();
  const groups = useSchoolGroups();
  const { setMode, setSchoolGroupId } = useRoleMode();
  const school = groups.data?.find(group => group.id === groupId && group.canManage);
  useEffect(() => {
    if (school) { setSchoolGroupId(school.id); setMode("school"); }
  }, [school, setSchoolGroupId, setMode]);
  if (groups.isPending) return <PageContainer><p role="status">{t("common.loading")}</p></PageContainer>;
  if (groups.isError) return <PageContainer><Retry onRetry={() => void groups.refetch()} /></PageContainer>;
  if (!school) return <PageContainer><PageHeader title={t("dossier.title")} back="/school/students" /><p role="alert">{t("dossier.noAccess")}</p></PageContainer>;
  return <Dossier key={`${groupId}:${studentId}`} groupId={groupId} studentId={studentId} schoolName={school.name} />;
}

function Retry({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return <div role="alert" className="space-y-2"><p>{t("dossier.loadFailed")}</p><Button variant="outline" onClick={onRetry}>{t("performance.retry")}</Button></div>;
}
function Empty() { const { t } = useTranslation(); return <p className="text-sm text-muted-foreground py-4">{t("dossier.empty")}</p>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-card p-4 space-y-3"><h2 className="font-semibold">{title}</h2>{children}</section>;
}
function useFormat() {
  const { i18n } = useTranslation();
  return {
    date: (value: string | null) => value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString(i18n.language) : "—",
    money: (value: number) => new Intl.NumberFormat(i18n.language, { style: "currency", currency: "CHF" }).format(Number(value)),
  };
}
function Visibility({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  return <Badge variant="outline">{t(visible ? "dossier.shared" : "dossier.internal")}</Badge>;
}
interface Context { groupId: string; studentId: string }
function useDossierSection<S extends DossierSection>({ groupId, studentId }: Context, section: S) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["student-dossier", user?.id, groupId, studentId, section], enabled: !!user,
    queryFn: ({ signal }) => fetchDossier(groupId, studentId, section, 0, signal), staleTime: 0, gcTime: 0 });
}

function Dossier({ groupId, studentId, schoolName }: Context & { schoolName: string }) {
  const { t } = useTranslation();
  const [section, setSection] = useState<Tab>("overview");
  const overview = useDossierSection({ groupId, studentId }, "overview");
  const context = { groupId, studentId };
  return <PageContainer className="space-y-5">
    <PageHeader back="/school/students" title={overview.data?.name || t("dossier.title")} subtitle={`${schoolName} · ${t("dossier.title")}`} />
    {overview.isPending ? <p role="status">{t("common.loading")}</p> : overview.isError ? <Retry onRetry={() => void overview.refetch()} /> : <>
      <div className="flex flex-wrap gap-2"><Badge>{t(`school.studentStatus.${overview.data.status.status}`)}</Badge><Badge variant="secondary">{overview.data.level ? t(`dossier.levels.${overview.data.level}`, { defaultValue: overview.data.level }) : t("dossier.noLevel")}</Badge><Badge variant="outline">{overview.data.flightCount} {t("school.flights")}</Badge></div>
      <Tabs value={section} onValueChange={value => setSection(value as Tab)}>
        <div className="overflow-x-auto pb-2"><TabsList aria-label={t("dossier.title")} className="w-max">{tabs.map(key => <TabsTrigger key={key} value={key}>{t(`dossier.sections.${key}`)}</TabsTrigger>)}</TabsList></div>
        <TabsContent value="overview"><OverviewPanel {...context} data={overview.data} /></TabsContent>
        <TabsContent value="training"><TrainingPanel {...context} level={overview.data.level} /></TabsContent>
        <TabsContent value="flights"><PagedPanel {...context} section="flights" /></TabsContent>
        <TabsContent value="notes"><PagedPanel {...context} section="notes" /></TabsContent>
        <TabsContent value="equipment"><EquipmentPanel {...context} gliderInfo={overview.data.gliderInfo} /></TabsContent>
        <TabsContent value="billing"><PagedPanel {...context} section="billing" /></TabsContent>
        <TabsContent value="proof"><SchoolProofPanel {...context} /></TabsContent>
      </Tabs>
    </>}
  </PageContainer>;
}

function OverviewPanel({ data, groupId, studentId }: Context & { data: Overview }) {
  const { t } = useTranslation();
  const { date } = useFormat();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [level, setLevel] = useState(data.level || "");
  useEffect(() => setLevel(data.level || ""), [data.level]);
  const saveLevel = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_member_training_level" as never, { _group_id: groupId, _user_id: studentId, _training_level: level } as never);
      if (error) throw error;
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["student-dossier"] }), queryClient.invalidateQueries({ queryKey: ["school-dashboard"] })]);
      toast({ title: t("school.people.saved") });
    } catch { toast({ title: t("journeys.saveFailed"), variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return <div className="space-y-4">
    {data.nextStep && <Panel title={t("dossier.nextStep")}><p className="whitespace-pre-wrap break-words">{data.nextStep.note}</p><Link className="text-primary text-sm underline" to={`/events/${data.nextStep.eventId}#coaching`}>{date(data.nextStep.date)} · {t("dossier.openDay")}</Link></Panel>}
    <Panel title={t("dossier.sections.training")}>
      <label className="block text-sm" htmlFor="dossier-level">{t("dossier.level")}</label>
      <div className="flex gap-2"><select id="dossier-level" className="min-w-0 flex-1 rounded-md border bg-background p-2 text-sm" value={level} onChange={e => setLevel(e.target.value)} disabled={saving}>
        {!level && <option value="">{t("dossier.noLevel")}</option>}
        {[...new Set([...(data.level ? [data.level] : []), "ground", "altitude", "exam_ready", "licensed"])].map(value => <option key={value} value={value}>{t(`dossier.levels.${value}`, { defaultValue: value })}</option>)}
      </select><Button onClick={() => void saveLevel()} disabled={saving || !level || level === data.level}>{t("common.save")}</Button></div>
      <p className="text-sm">{t("dossier.examProgress", { done: data.examDone, total: data.examTotal })}</p>
      <Progress aria-label={t("dossier.sections.training")} value={examPercent(data.examDone, data.examTotal)} />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <dt>{t("dossier.lastFlight")}</dt><dd>{date(data.lastFlight)}</dd>
        <dt>{t("dossier.shv")}</dt><dd>{data.shvNumber || "—"}</dd>
        <dt>{t("profile.examTheoryDate")}</dt><dd>{date(data.theoryDate)}</dd>
        <dt>{t("profile.examPracticalDate")}</dt><dd>{date(data.practicalDate)}</dd>
      </dl>
    </Panel>
    <Panel title={t("dossier.status")}><p>{t(`school.studentStatus.${data.status.status}`)}{data.status.date && ` · ${date(data.status.date)}`}</p>{data.status.reason && <p className="whitespace-pre-wrap break-words text-sm">{data.status.reason}</p>}</Panel>
    <Panel title={t("dossier.upcoming")}>{data.upcoming.length ? data.upcoming.map(event => <Link key={event.id} to={`/events/${event.id}`} className="block rounded-lg border p-3 text-sm"><span className="font-medium">{event.title}</span><span className="block text-muted-foreground">{date(event.event_date)}{event.status === "waitlist" ? ` · ${t("events.waitlist")}` : ""}</span></Link>) : <Empty />}</Panel>
  </div>;
}

function TrainingPanel(context: Context & { level: string | null }) {
  const { t } = useTranslation();
  const query = useDossierSection(context, "training");
  const [filter, setFilter] = useState<TrainingFilter>(() => trainingFilter(context.level));
  if (query.isPending) return <p role="status">{t("common.loading")}</p>;
  if (query.isError) return <Retry onRetry={() => void query.refetch()} />;
  const rows = query.data.rows.filter(row => matchesTrainingFilter(row.training_level, filter));
  return <div className="space-y-4"><p className="text-xs text-muted-foreground">{t("dossier.trainingHint")}</p>
    <select aria-label={t("dossier.level")} className="rounded-md border bg-background p-2" value={filter} onChange={e => setFilter(e.target.value as TrainingFilter)}>{(["all", "grundkurs", "brevetkurs", "siku"] as const).map(value => <option key={value} value={value}>{t(`dossier.levels.${value}`)}</option>)}</select>
    {!rows.length && <Empty />}
    {[...new Set(rows.map(row => row.category))].map(category => <Panel key={category} title={category}>{rows.filter(row => row.category === category).map(row => <div key={row.id} className="border-t pt-3 first:border-0 first:pt-0"><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{row.name}{row.is_exam_maneuver && <Badge variant="outline" className="ml-2">SHV</Badge>}</p><span className="text-sm shrink-0">{row.rating}/3</span></div>{row.notes && <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground mt-1">{row.notes}</p>}</div>)}</Panel>)}
  </div>;
}

function EquipmentPanel(context: Context & { gliderInfo: string | null }) {
  const { t } = useTranslation();
  const { date } = useFormat();
  const query = useDossierSection(context, "equipment");
  if (query.isPending) return <p role="status">{t("common.loading")}</p>;
  if (query.isError) return <Retry onRetry={() => void query.refetch()} />;
  return <div className="space-y-4">
    <Panel title={t("school.gear.tab")}><StudentEquipmentCheck groupId={context.groupId} studentUserId={context.studentId} /></Panel>
    <Panel title={t("dossier.loans")}>
      {!query.data.loans.length && <Empty />}
      {query.data.loans.map(loan => <article key={loan.id} className="border-t pt-3 first:border-0 first:pt-0 text-sm space-y-1"><div className="flex justify-between gap-2"><h3 className="font-medium">{loan.name}</h3><Badge variant={loan.returned_on ? "secondary" : "outline"}>{t(loan.returned_on ? "dossier.returned" : "dossier.onLoan")}</Badge></div><p className="text-muted-foreground">{[loan.inventory_number, loan.size].filter(Boolean).join(" · ")}</p><p>{t("dossier.assigned")}: {date(loan.assigned_on)} · {t("dossier.due")}: {date(loan.due_on)}</p>{loan.returned_on && <p>{t("dossier.returned")}: {date(loan.returned_on)}</p>}<p>{t("dossier.nextCheck")}: {date(loan.next_check_date)}</p>{loan.note && <p className="whitespace-pre-wrap break-words">{loan.note}</p>}</article>)}
    </Panel>
    <Panel title={t("dossier.ownEquipment")}><p className="text-xs text-muted-foreground">{t("dossier.ownHint")}</p>{context.gliderInfo && <p className="whitespace-pre-wrap break-words text-sm">{context.gliderInfo}</p>}{!query.data.own.length && <Empty />}
      {query.data.own.map(glider => <article key={glider.id} className="border-t pt-3 text-sm space-y-1"><h3 className="font-medium">{glider.manufacturer} {glider.model} {glider.size}</h3><p>{t("dossier.lastCheck")}: {date(glider.last_check_date)}</p><p>{t("dossier.nextCheck")}: {date(glider.next_check_date)}</p><p>{t("dossier.reserveRepack")}: {date(glider.reserve_repack_date)}</p></article>)}
    </Panel>
  </div>;
}

function PagedPanel({ groupId, studentId, section }: Context & { section: "flights" | "notes" | "billing" }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { date, money } = useFormat();
  const query = useInfiniteQuery({ queryKey: ["student-dossier", user?.id, groupId, studentId, section], enabled: !!user, initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => ({ section, data: await fetchDossier(groupId, studentId, section, pageParam, signal) }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.rows.length, 0);
      return last.data.rows.length && loaded < last.data.total ? loaded : undefined;
    }, staleTime: 0, gcTime: 0 });
  if (query.isPending) return <p role="status">{t("common.loading")}</p>;
  if (query.isError && !query.data) return <Retry onRetry={() => void query.refetch()} />;
  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">{t(`dossier.${section}Hint`)}</p>
    {query.data?.pages[0].data.total === 0 && <Empty />}
    {query.data?.pages.map((page, index) => <div key={index} className="space-y-3">
      {section === "billing" && "open" in page.data && index === 0 && <div className="grid grid-cols-2 gap-3"><Panel title={t("dossier.open")}><p className="text-xl font-semibold">{money(page.data.open)}</p></Panel><Panel title={t("dossier.paid")}><p className="text-xl font-semibold">{money(page.data.paid)}</p></Panel></div>}
      {page.data.rows.map(row => <article key={row.id} className="rounded-xl border bg-card p-4 space-y-2">
        {"takeoff" in row ? <>
          <Link className="font-medium text-primary underline" to={`/flights/${row.id}`}>{date(row.date)} · {row.takeoff || t("common.unknown")}{row.landing ? ` → ${row.landing}` : ""}</Link>
          <p className="text-xs text-muted-foreground">{[row.glider, row.duration_minutes != null ? `${row.duration_minutes} min` : null, row.altitude_gain != null ? `${row.altitude_gain} m` : null].filter(Boolean).join(" · ")}</p>
          {row.comments && <p className="text-sm whitespace-pre-wrap break-words">{row.comments}</p>}
          {row.notes.map(note => <div key={note.id} className="border-l-2 border-primary/40 pl-3 space-y-1"><p className="text-xs text-muted-foreground">{note.author || t("common.unknown")} · {date(note.date)}</p><Visibility visible={note.visible} /><p className="text-sm whitespace-pre-wrap break-words">{note.note}</p></div>)}
        </> : "flight_number" in row ? <>
          <Link className="font-medium text-primary underline" to={`/events/${row.event_id}#coaching`}>{date(row.event_date)} · {row.title}</Link>
          <div className="flex flex-wrap gap-2"><Badge variant="secondary">{row.flight_number === -1 ? t("journeys.pausedToday") : row.flight_number === null ? t("dossier.daySummary") : t("dossier.flightSlot", { number: row.flight_number })}</Badge><Visibility visible={row.visible} />{row.is_next_step && <Badge>{t("dossier.nextStep")}</Badge>}</div>
          <p className="text-sm whitespace-pre-wrap break-words">{row.note}</p><p className="text-xs text-muted-foreground">{row.author || t("common.unknown")}</p>
        </> : <>
          <div className="flex justify-between gap-3"><h3 className="font-medium">{row.description || t(`school.billing.types.${row.item_type}`, { defaultValue: row.item_type })}</h3><span className="font-semibold shrink-0">{money(row.amount)}</span></div>
          <p className="text-xs text-muted-foreground">{date(row.billing_date)} · {row.quantity} × {money(row.unit_amount)}</p><Badge variant={row.paid_at ? "secondary" : "outline"}>{row.paid_at ? `${t("dossier.paid")} · ${date(row.paid_at)}` : t("dossier.open")}</Badge>{row.note && <p className="text-sm whitespace-pre-wrap break-words">{row.note}</p>}
        </>}
      </article>)}
    </div>)}
    {query.isError && <Retry onRetry={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())} />}
    {query.hasNextPage && <Button variant="outline" className="w-full" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>{t(query.isFetching ? "common.loading" : "dossier.loadMore")}</Button>}
  </div>;
}
