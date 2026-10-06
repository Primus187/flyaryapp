import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Download, Link2, Link2Off, Mail, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import LoadingState from "@/components/layout/LoadingState";
import EmptyState from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/csv-export";
import { waitlistCsv, type WaitlistRow } from "@/lib/waitlist";
import { inviteMailto, personalInviteLink } from "@/lib/app-access";
import { revokeInvite } from "@/lib/ops-access";

/** Test list tab of "Zugänge": pilot sign-ups from the website and the waiting room (migrations 0078, 0079, 0084). */
export default function WaitlistPanel() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<WaitlistRow[] | null>(null);
  const [showHandled, setShowHandled] = useState(false);
  // Accounts that may use the app (app_access), paused ones (0084) and personal links created in this session (shown once).
  const [withAccess, setWithAccess] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState<Set<string>>(new Set());
  const [links, setLinks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    let query = supabase.from("pilot_waitlist" as never)
      .select("id, name, email, language, role, disciplines, school, comment, consent_at, created_at, updated_at, handled_at, user_id, invited_at")
      .order("created_at", { ascending: false }).limit(500);
    if (!showHandled) query = query.is("handled_at", null);
    const { data, error } = await query;
    if (error) { toast.error(t("common.error")); setRows([]); return; }
    const list = (data ?? []) as unknown as WaitlistRow[];
    const ids = list.map((r) => r.user_id).filter((id): id is string => !!id);
    if (ids.length) {
      const { data: access } = await supabase.from("app_access" as never).select("user_id, revoked_at").in("user_id", ids);
      const list = (access ?? []) as { user_id: string; revoked_at: string | null }[];
      setWithAccess(new Set(list.filter((a) => !a.revoked_at).map((a) => a.user_id)));
      setPaused(new Set(list.filter((a) => a.revoked_at).map((a) => a.user_id)));
    } else { setWithAccess(new Set()); setPaused(new Set()); }
    setRows(list);
  }, [showHandled, t]);
  useEffect(() => { void load(); }, [load]);

  const markHandled = async (row: WaitlistRow) => {
    const { error } = await supabase.from("pilot_waitlist" as never).update({ handled_at: new Date().toISOString() } as never).eq("id", row.id);
    if (error) { toast.error(t("common.error")); return; }
    void load();
  };
  const grant = async (row: WaitlistRow) => {
    const { error } = await supabase.rpc("grant_app_access" as never, { _user_id: row.user_id } as never);
    if (error) { toast.error(t("common.error")); return; }
    toast.success(t("adminWaitlist.granted", { name: row.name }));
    void load();
  };
  const createLink = async (row: WaitlistRow) => {
    if (row.invited_at && !confirm(t("adminWaitlist.newLinkConfirm"))) return;
    const { data, error } = await supabase.rpc("create_access_invite" as never, { _waitlist_id: row.id } as never);
    if (error || typeof data !== "string") { toast.error(t("common.error")); return; }
    setLinks((cur) => ({ ...cur, [row.id]: personalInviteLink(window.location.origin, data) }));
    void load();
  };
  const withdraw = async (row: WaitlistRow) => {
    if (!confirm(t("adminWaitlist.revokeInviteConfirm", { name: row.name }))) return;
    try { await revokeInvite(row.id); } catch { toast.error(t("common.error")); return; }
    toast.success(t("adminWaitlist.inviteRevoked"));
    setLinks((cur) => { const next = { ...cur }; delete next[row.id]; return next; });
    void load();
  };
  const copy = async (link: string) => {
    try { await navigator.clipboard.writeText(link); toast.success(t("adminWaitlist.copied")); } catch { toast.error(t("common.error")); }
  };
  const remove = async (row: WaitlistRow) => {
    if (!confirm(t("adminWaitlist.deleteConfirm", { name: row.name }))) return;
    const { error } = await supabase.from("pilot_waitlist" as never).delete().eq("id", row.id);
    if (error) { toast.error(t("common.error")); return; }
    void load();
  };
  const exportCsv = () => {
    if (!rows?.length) return;
    downloadBlob(new Blob([waitlistCsv(rows)], { type: "text/csv;charset=utf-8" }), `flyary-testliste-${new Date().toISOString().slice(0, 10)}.csv`);
  };
  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t("adminWaitlist.subtitle")}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowHandled((v) => !v)}>{showHandled ? t("adminWaitlist.onlyOpen") : t("adminWaitlist.showHandled")}</Button>
        {rows && rows.length > 0 && (
          <Button size="sm" variant="outline" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" />{t("adminWaitlist.export")}</Button>
        )}
      </div>
      {rows === null ? <LoadingState header={false} /> : rows.length === 0 ? (
        <EmptyState icon={UserPlus} title={t("adminWaitlist.empty")} description={t("adminWaitlist.emptyHint")} />
      ) : rows.map((row) => (
        <Card key={row.id}>
          <CardContent className="space-y-1.5 p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{row.name}</p>
                <a className="text-xs text-primary break-all" href={`mailto:${row.email}`}>{row.email}</a>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">{when(row.created_at)}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-[10px]">{t(`adminWaitlist.role.${row.role}`)}</Badge>
              {row.disciplines.map((d) => <Badge key={d} variant="outline" className="text-[10px]">{t(`flightProof.discipline.${d}`)}</Badge>)}
              <Badge variant="outline" className="text-[10px]">{row.language.toUpperCase()}</Badge>
              {row.handled_at && <Badge className="text-[10px]">{t("adminWaitlist.handled")}</Badge>}
              {row.user_id && <Badge variant={paused.has(row.user_id) ? "destructive" : "outline"} className="text-[10px]">{paused.has(row.user_id) ? t("adminWaitlist.paused") : withAccess.has(row.user_id) ? t("adminWaitlist.hasAccess") : t("adminWaitlist.waiting")}</Badge>}
              {row.invited_at && !row.user_id && <Badge variant="outline" className="text-[10px]">{t("adminWaitlist.invitedOn", { date: when(row.invited_at) })}</Badge>}
            </div>
            {row.school && <p className="text-xs text-muted-foreground">{t("adminWaitlist.school")}: {row.school}</p>}
            {row.comment && <p className="text-xs whitespace-pre-wrap">{row.comment}</p>}
            {links[row.id] && (
              <div className="space-y-2 rounded-lg bg-muted p-2.5">
                <p className="text-[11px] text-muted-foreground">{t("adminWaitlist.linkHint")}</p>
                <p className="break-all font-mono text-[11px]">{links[row.id]}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => void copy(links[row.id])}><Copy className="h-3.5 w-3.5" />{t("adminWaitlist.copy")}</Button>
                  <Button size="sm" className="h-7 gap-1" asChild><a href={inviteMailto(row.email, row.name, row.language, links[row.id])}><Mail className="h-3.5 w-3.5" />{t("adminWaitlist.mail")}</a></Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {row.user_id && !withAccess.has(row.user_id) && !paused.has(row.user_id) && <Button size="sm" className="h-7 gap-1" onClick={() => void grant(row)}><ShieldCheck className="h-3.5 w-3.5" />{t("adminWaitlist.grant")}</Button>}
              {!row.user_id && <Button size="sm" variant={row.invited_at ? "outline" : "default"} className="h-7 gap-1" onClick={() => void createLink(row)}><Link2 className="h-3.5 w-3.5" />{row.invited_at ? t("adminWaitlist.newLink") : t("adminWaitlist.createLink")}</Button>}
              {row.invited_at && !row.user_id && <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => void withdraw(row)}><Link2Off className="h-3.5 w-3.5" />{t("adminWaitlist.revokeInvite")}</Button>}
              {!row.handled_at && <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => void markHandled(row)}><Check className="h-3.5 w-3.5" />{t("adminWaitlist.markHandled")}</Button>}
              <Button size="sm" variant="ghost" className="h-7" onClick={() => void remove(row)} aria-label={t("common.delete")}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
