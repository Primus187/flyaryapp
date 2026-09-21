import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmptyState from "@/components/layout/EmptyState";
import { BadgeCheck, AlertTriangle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { startOfDay, subYears } from "date-fns";
import { certificationExpiry, countTeachingDays, MIN_TEACHING_DAYS, teachingWindowStart } from "@/lib/instructor-certifications";

const CERT_TYPES = ["instructor", "launch_leader", "biplace_1", "biplace_2", "biplace_3", "first_aid"] as const;
const TEAM_FUNCTIONS = ["school_lead", "instructor", "launch_helper"] as const;

interface Props {
  groupId: string;
  canManage?: boolean;
}

interface Cert {
  id: string;
  user_id: string;
  cert_type: string;
  issued_at: string | null;
  valid_until: string | null;
}

interface Person {
  userId: string;
  name: string;
  functions: string[];
  teachingDates: string[];
}

export default function TeamCertifications({ groupId, canManage = true }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [editUser, setEditUser] = useState<Person | null>(null);
  const [draft, setDraft] = useState<Record<string, { issued_at: string; valid_until: string }>>({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadVersion = useRef(0);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError(false);
    try {
      const now = new Date();
      const [funcRes, certRes, staffRes] = await Promise.all([
        supabase.from("group_member_functions").select("user_id, function", { count: "exact" }).eq("group_id", groupId),
        supabase.from("instructor_certifications").select("id, user_id, cert_type, issued_at, valid_until", { count: "exact" }).eq("group_id", groupId),
        supabase
          .from("event_staff")
          .select("user_id, flight_events!inner(event_date)", { count: "exact" })
          .eq("role", "instructor")
          .eq("flight_events.group_id", groupId)
          .gte("flight_events.event_date", startOfDay(subYears(now, 3)).toISOString())
          .lte("flight_events.event_date", now.toISOString())
          .eq("flight_events.status", "confirmed"),
      ]);
      if ([funcRes, certRes, staffRes].some((result) => result.error || result.data === null || (result.count != null && result.count > result.data.length))) {
        throw new Error("Incomplete certification data");
      }

      const funcs = (funcRes.data || []).filter((f) => (TEAM_FUNCTIONS as readonly string[]).includes(f.function));
      const userIds = Array.from(new Set(funcs.map((f) => f.user_id)));

      const nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs, error } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", userIds);
        if (error) throw error;
        (profs || []).forEach((p) => { nameMap[p.user_id] = p.pilot_name || "—"; });
      }

      if (version !== loadVersion.current) return;
      setPeople(
        userIds
          .map((uid) => ({
            userId: uid,
            name: nameMap[uid] || "—",
            functions: funcs.filter((f) => f.user_id === uid).map((f) => f.function),
            teachingDates: (staffRes.data || []).filter((s) => s.user_id === uid).map((s) => s.flight_events.event_date),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setCerts((certRes.data || []) as Cert[]);
    } catch {
      if (version === loadVersion.current) setLoadError(true);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    setEditUser(null);
    if (groupId) void load();
    return () => { loadVersion.current += 1; };
  }, [groupId, load]);

  const certFor = (userId: string, type: string) => certs.find((c) => c.user_id === userId && c.cert_type === type);

  const warnings = (() => {
    const list: string[] = [];
    people.forEach((p) => {
      certs.filter((cert) => cert.user_id === p.userId && (cert.cert_type !== "instructor" || !p.functions.includes("instructor"))).forEach((cert) => {
        const state = certificationExpiry(cert.valid_until);
        if (state !== "valid") list.push(t(`school.certs.certificateWarning.${state}`, {
          name: p.name, type: t(`school.certs.types.${cert.cert_type}`), date: cert.valid_until,
        }));
      });
      const isInstructor = p.functions.includes("instructor");
      if (isInstructor) {
        const cert = certFor(p.userId, "instructor");
        const state = certificationExpiry(cert?.valid_until ?? null);
        if (!cert || state === "none") list.push(t("school.certs.warnMissing", { name: p.name }));
        else if (state === "expired") list.push(t("school.certs.warnExpired", { name: p.name }));
        else if (state === "soon") list.push(t("school.certs.warnSoon", { name: p.name, date: cert!.valid_until }));
        const days = countTeachingDays(cert?.issued_at ?? null, p.teachingDates);
        if (days === null) list.push(t("school.certs.warnIssueDate", { name: p.name }));
        else if (days < MIN_TEACHING_DAYS) {
          list.push(t("school.certs.warnDays", { name: p.name, days, min: MIN_TEACHING_DAYS, date: teachingWindowStart(cert?.issued_at ?? null) }));
        }
      }
    });
    return list;
  })();

  const openEdit = (p: Person) => {
    const d: Record<string, { issued_at: string; valid_until: string }> = {};
    CERT_TYPES.forEach((ty) => {
      const c = certFor(p.userId, ty);
      d[ty] = { issued_at: c?.issued_at || "", valid_until: c?.valid_until || "" };
    });
    setDraft(d);
    setEditUser(p);
  };

  const saveEdit = async () => {
    if (!editUser || !canManage || savingRef.current) return;
    if (CERT_TYPES.some((ty) => draft[ty].issued_at && draft[ty].valid_until && draft[ty].issued_at > draft[ty].valid_until)) {
      toast({ title: t("school.certs.invalidDates"), variant: "destructive" });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const version = loadVersion.current;
    try {
      for (const ty of CERT_TYPES) {
        const entry = draft[ty];
        const existing = certFor(editUser.userId, ty);
        if (entry.issued_at === (existing?.issued_at || "") && entry.valid_until === (existing?.valid_until || "")) continue;
        const hasValue = entry.issued_at || entry.valid_until;
        if (hasValue) {
          const { data, error } = await supabase.from("instructor_certifications").upsert(
            {
              group_id: groupId,
              user_id: editUser.userId,
              cert_type: ty,
              issued_at: entry.issued_at || null,
              valid_until: entry.valid_until || null,
            },
            { onConflict: "group_id,user_id,cert_type" },
          ).select("id, user_id, cert_type, issued_at, valid_until").single();
          if (version !== loadVersion.current) return;
          if (error) throw error;
          setCerts((previous) => [...previous.filter((cert) => !(cert.user_id === data.user_id && cert.cert_type === data.cert_type)), data]);
        } else if (existing) {
          const { error } = await supabase.from("instructor_certifications").delete().eq("id", existing.id).eq("group_id", groupId).select("id").single();
          if (version !== loadVersion.current) return;
          if (error) throw error;
          setCerts((previous) => previous.filter((cert) => cert.id !== existing.id));
        }
      }
      setEditUser(null);
      toast({ title: t("school.certs.saved") });
    } catch {
      toast({ title: t("school.certs.saveFailed"), description: t("school.certs.partialSaveHint"), variant: "destructive" });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (loadError) return <div role="alert" className="space-y-2 pt-3"><p className="text-sm">{t("school.certs.loadFailed")}</p><Button onClick={() => void load()}>{t("school.certs.retry")}</Button></div>;

  if (people.length === 0) {
    return <EmptyState icon={Users} title={t("school.certs.noTeam")} description={t("school.certs.noTeamHint")} />;
  }

  return (
    <div className="space-y-3 pt-3">
      <p className="text-xs text-muted-foreground">{t("school.certs.daysExplanation")}</p>
      {warnings.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-3 space-y-1">
            {warnings.map((w) => (
              <p key={w} className="text-xs text-amber-500 flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {w}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {people.map((p) => (
        <Card key={p.userId} className="border-border/60 bg-card/80">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.functions.map((f) => t(`school.functions.${f}`, { defaultValue: f })).join(" · ")}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {countTeachingDays(certFor(p.userId, "instructor")?.issued_at ?? null, p.teachingDates) === null
                  ? t("school.certs.daysUnknown")
                  : t("school.certs.teachingDays", { count: countTeachingDays(certFor(p.userId, "instructor")?.issued_at ?? null, p.teachingDates) })}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CERT_TYPES.map((ty) => {
                const c = certFor(p.userId, ty);
                if (!c) return null;
                const state = certificationExpiry(c.valid_until);
                return (
                  <Badge
                    key={ty}
                    variant={state === "expired" ? "destructive" : state === "soon" ? "secondary" : state === "none" ? "outline" : "default"}
                    className="text-[10px] gap-1"
                  >
                    <BadgeCheck className="h-3 w-3" />
                    {t(`school.certs.types.${ty}`)}
                    {c.valid_until ? ` · ${c.valid_until}` : ""}
                  </Badge>
                );
              })}
              {CERT_TYPES.every((ty) => !certFor(p.userId, ty)) && (
                <span className="text-xs text-muted-foreground">{t("school.certs.none")}</span>
              )}
            </div>
            {canManage && (
              <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                {t("school.certs.edit")}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o && !saving) setEditUser(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {CERT_TYPES.map((ty) => (
              <div key={ty} className="space-y-1">
                <Label className="text-xs">{t(`school.certs.types.${ty}`)}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    disabled={saving}
                    aria-label={`${t(`school.certs.types.${ty}`)}: ${t("school.certs.issuedAt")}`}
                    value={draft[ty]?.issued_at || ""}
                    onChange={(e) => setDraft({ ...draft, [ty]: { ...draft[ty], issued_at: e.target.value } })}
                  />
                  <Input
                    type="date"
                    disabled={saving}
                    aria-label={`${t(`school.certs.types.${ty}`)}: ${t("school.certs.validUntil")}`}
                    value={draft[ty]?.valid_until || ""}
                    onChange={(e) => setDraft({ ...draft, [ty]: { ...draft[ty], valid_until: e.target.value } })}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">{t("school.certs.dateHint")}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={saveEdit} disabled={saving}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
