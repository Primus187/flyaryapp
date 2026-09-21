import { useEffect, useMemo, useState } from "react";
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

const CERT_TYPES = ["instructor", "launch_leader", "biplace_1", "biplace_2", "biplace_3", "first_aid"] as const;
const TEAM_FUNCTIONS = ["school_lead", "instructor", "launch_helper"] as const;
/** SHV: mindestens 15 Unterrichtstage pro Jahr. */
const MIN_TEACHING_DAYS = 15;
const WARN_DAYS = 90;

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
  teachingDays: number;
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
  const year = new Date().getFullYear();

  const load = async () => {
    setLoading(true);
    const [funcRes, certRes, eventRes] = await Promise.all([
      supabase.from("group_member_functions").select("user_id, function").eq("group_id", groupId),
      supabase.from("instructor_certifications").select("id, user_id, cert_type, issued_at, valid_until").eq("group_id", groupId),
      supabase
        .from("flight_events")
        .select("id, event_date")
        .eq("group_id", groupId)
        .gte("event_date", `${year}-01-01`)
        .neq("status", "cancelled"),
    ]);

    const funcs = (funcRes.data || []).filter((f) => (TEAM_FUNCTIONS as readonly string[]).includes(f.function));
    const userIds = Array.from(new Set(funcs.map((f) => f.user_id)));

    const eventIds = (eventRes.data || []).map((e) => e.id);
    let staffRows: { user_id: string; event_id: string }[] = [];
    if (eventIds.length > 0) {
      const { data } = await supabase.from("event_staff").select("user_id, event_id").in("event_id", eventIds);
      staffRows = data || [];
    }

    const nameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, pilot_name").in("user_id", userIds);
      (profs || []).forEach((p) => { nameMap[p.user_id] = p.pilot_name || "—"; });
    }

    setPeople(
      userIds
        .map((uid) => ({
          userId: uid,
          name: nameMap[uid] || "—",
          functions: funcs.filter((f) => f.user_id === uid).map((f) => f.function),
          teachingDays: new Set(staffRows.filter((s) => s.user_id === uid).map((s) => s.event_id)).size,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setCerts((certRes.data || []) as Cert[]);
    setLoading(false);
  };

  useEffect(() => {
    if (groupId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const certFor = (userId: string, type: string) => certs.find((c) => c.user_id === userId && c.cert_type === type);

  const expiryState = (valid_until: string | null) => {
    if (!valid_until) return "none" as const;
    const diff = Math.ceil((new Date(valid_until).getTime() - Date.now()) / 86400000);
    if (diff < 0) return "expired" as const;
    if (diff <= WARN_DAYS) return "soon" as const;
    return "valid" as const;
  };

  const warnings = useMemo(() => {
    const list: string[] = [];
    people.forEach((p) => {
      const isInstructor = p.functions.includes("instructor");
      if (isInstructor) {
        const cert = certFor(p.userId, "instructor");
        const state = expiryState(cert?.valid_until ?? null);
        if (!cert || state === "none") list.push(t("school.certs.warnMissing", { name: p.name }));
        else if (state === "expired") list.push(t("school.certs.warnExpired", { name: p.name }));
        else if (state === "soon") list.push(t("school.certs.warnSoon", { name: p.name, date: cert!.valid_until }));
        if (p.teachingDays < MIN_TEACHING_DAYS) {
          list.push(t("school.certs.warnDays", { name: p.name, days: p.teachingDays, min: MIN_TEACHING_DAYS, year }));
        }
      }
    });
    return list;
  }, [people, certs, t, year]);

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
    if (!editUser) return;
    setSaving(true);
    for (const ty of CERT_TYPES) {
      const entry = draft[ty];
      const existing = certFor(editUser.userId, ty);
      const hasValue = entry.issued_at || entry.valid_until;
      if (hasValue) {
        await supabase.from("instructor_certifications").upsert(
          {
            group_id: groupId,
            user_id: editUser.userId,
            cert_type: ty,
            issued_at: entry.issued_at || null,
            valid_until: entry.valid_until || null,
          },
          { onConflict: "group_id,user_id,cert_type" },
        );
      } else if (existing) {
        await supabase.from("instructor_certifications").delete().eq("id", existing.id);
      }
    }
    setSaving(false);
    setEditUser(null);
    toast({ title: t("school.certs.saved") });
    load();
  };

  if (loading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  if (people.length === 0) {
    return <EmptyState icon={Users} title={t("school.certs.noTeam")} description={t("school.certs.noTeamHint")} />;
  }

  return (
    <div className="space-y-3 pt-3">
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
                {t("school.certs.teachingDays", { count: p.teachingDays, year })}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CERT_TYPES.map((ty) => {
                const c = certFor(p.userId, ty);
                if (!c) return null;
                const state = expiryState(c.valid_until);
                return (
                  <Badge
                    key={ty}
                    variant={state === "expired" ? "destructive" : state === "soon" ? "secondary" : "default"}
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

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
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
                    value={draft[ty]?.issued_at || ""}
                    onChange={(e) => setDraft({ ...draft, [ty]: { ...draft[ty], issued_at: e.target.value } })}
                  />
                  <Input
                    type="date"
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
