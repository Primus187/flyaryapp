import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, GraduationCap, Link2, Link2Off, LogOut, Mail, Plus } from "lucide-react";
import { toast } from "sonner";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import LoadingState from "@/components/layout/LoadingState";
import EmptyState from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createLeadInvite, createSchool, fetchSchools, LEAD_LANGUAGES, leadInviteLink, leadInviteMailto, leaveSchool, revokeLeadInvite,
  schoolFormValid, schoolState, type LeadLanguage, type SchoolRow,
} from "@/lib/ops-schools";
import { cn } from "@/lib/utils";

/** "create" sets up a new school, a school row asks for a new lead link for it. */
type FormTarget = "create" | SchoolRow;

/** Betriebsbereich "Schulen" (plan §6, migration 0085): set up schools and hand them over to their lead. */
export default function AdminSchools() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<SchoolRow[] | null>(null);
  const [form, setForm] = useState<FormTarget | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<LeadLanguage>("de");
  const [busy, setBusy] = useState(false);
  // Links created in this session, per school (only shown once: the database keeps just the hash).
  const [links, setLinks] = useState<Record<string, { link: string; email: string; language: string }>>({});

  const load = useCallback(async () => {
    try { setRows(await fetchSchools()); } catch { toast.error(t("common.error")); setRows([]); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const when = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(i18n.language, { dateStyle: "short" }) : "–";

  const openForm = (target: FormTarget) => {
    setForm(target);
    setName(""); setDescription("");
    setEmail(target !== "create" ? target.open_invite?.email ?? "" : "");
    setLanguage(target !== "create" && LEAD_LANGUAGES.includes(target.open_invite?.language as LeadLanguage) ? target.open_invite!.language as LeadLanguage : "de");
  };

  const submit = async () => {
    if (!form) return;
    const title = form === "create" ? name : form.name;
    if (!schoolFormValid(title, email)) return;
    setBusy(true);
    try {
      if (form === "create") {
        const created = await createSchool(name, description, email, language);
        setLinks((cur) => ({ ...cur, [created.group_id]: { link: leadInviteLink(window.location.origin, created.token), email: email.trim(), language } }));
        toast.success(t("adminSchools.created", { name: name.trim() }));
      } else {
        const token = await createLeadInvite(form.id, email, language);
        setLinks((cur) => ({ ...cur, [form.id]: { link: leadInviteLink(window.location.origin, token), email: email.trim(), language } }));
        toast.success(t("adminSchools.linkCreated"));
      }
      setForm(null);
      await load();
    } catch {
      toast.error(t("common.error"));
    }
    setBusy(false);
  };

  const withdraw = async (row: SchoolRow) => {
    if (!confirm(t("adminSchools.revokeConfirm", { email: row.open_invite?.email ?? "" }))) return;
    try { await revokeLeadInvite(row.id); } catch { toast.error(t("common.error")); return; }
    setLinks((cur) => { const next = { ...cur }; delete next[row.id]; return next; });
    toast.success(t("adminSchools.revoked"));
    void load();
  };

  const leave = async (row: SchoolRow) => {
    if (!confirm(t("adminSchools.leaveConfirm", { name: row.name }))) return;
    try { await leaveSchool(row.id); } catch { toast.error(t("common.error")); return; }
    toast.success(t("adminSchools.left", { name: row.name }));
    void load();
  };

  const copy = async (link: string) => {
    try { await navigator.clipboard.writeText(link); toast.success(t("adminWaitlist.copied")); } catch { toast.error(t("common.error")); }
  };

  const formTitle = form === "create" || form === null ? t("adminSchools.createTitle") : t("adminSchools.linkTitle", { name: form.name });
  const formValid = form !== null && schoolFormValid(form === "create" ? name : form.name, email);

  return (
    <PageContainer className="space-y-4">
      <PageHeader title={t("adminSchools.title")} subtitle={t("adminSchools.subtitle")} back="/admin"
        action={<Button size="sm" className="gap-1" onClick={() => openForm("create")}><Plus className="h-4 w-4" />{t("adminSchools.create")}</Button>} />

      {rows === null ? <LoadingState header={false} /> : rows.length === 0 ? (
        <EmptyState icon={GraduationCap} title={t("adminSchools.empty")} description={t("adminSchools.emptyHint")} />
      ) : rows.map((row) => {
        const state = schoolState(row);
        const fresh = links[row.id];
        return (
          <Card key={row.id}>
            <CardContent className="space-y-1.5 p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{row.name}</p>
                <Badge variant={state === "handed_over" ? "secondary" : state === "invited" ? "outline" : "destructive"} className="shrink-0 text-[10px]">
                  {t(`adminSchools.state.${state}`)}
                </Badge>
              </div>
              {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
              <p className="text-xs text-muted-foreground">
                {t("adminSchools.stats", { members: row.members, team: row.team, lastFlight: when(row.last_flight_at) })}
              </p>
              <p className="text-xs">{t("adminSchools.admins")}: {row.admins.length ? row.admins.join(", ") : "–"}</p>
              {row.open_invite && (
                <p className="text-xs">{t("adminSchools.openInvite", { email: row.open_invite.email, date: when(row.open_invite.expires_at) })}</p>
              )}
              {fresh && (
                <div className="space-y-2 rounded-lg bg-muted p-2.5">
                  <p className="text-[11px] text-muted-foreground">{t("adminSchools.linkHint")}</p>
                  <p className="break-all font-mono text-[11px]">{fresh.link}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => void copy(fresh.link)}><Copy className="h-3.5 w-3.5" />{t("adminWaitlist.copy")}</Button>
                    <Button size="sm" className="h-7 gap-1" asChild>
                      <a href={leadInviteMailto(fresh.email, row.name, fresh.language, fresh.link)}><Mail className="h-3.5 w-3.5" />{t("adminWaitlist.mail")}</a>
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant={state === "needs_lead" ? "default" : "outline"} className="h-7 gap-1" onClick={() => openForm(row)}>
                  <Link2 className="h-3.5 w-3.5" />{row.open_invite ? t("adminSchools.newLink") : t("adminSchools.inviteLead")}
                </Button>
                {row.open_invite && (
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => void withdraw(row)}>
                    <Link2Off className="h-3.5 w-3.5" />{t("adminSchools.revoke")}
                  </Button>
                )}
                {row.i_am_member && (
                  <Button size="sm" variant={state === "admin_still_member" ? "default" : "outline"} className="h-7 gap-1"
                    disabled={row.other_admins === 0} title={row.other_admins === 0 ? t("adminSchools.leaveNeedsLead") : undefined}
                    onClick={() => void leave(row)}>
                    <LogOut className="h-3.5 w-3.5" />{t("adminSchools.leave")}
                  </Button>
                )}
              </div>
              {row.i_am_member && row.other_admins === 0 && <p className="text-[11px] text-muted-foreground">{t("adminSchools.leaveNeedsLead")}</p>}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={form !== null} onOpenChange={(open) => { if (!open) setForm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formTitle}</DialogTitle>
            <DialogDescription>{t("adminSchools.formHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {form === "create" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="school-name" className="text-xs">{t("adminSchools.name")}</Label>
                  <Input id="school-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="school-description" className="text-xs">{t("adminSchools.description")}</Label>
                  <Input id="school-description" value={description} maxLength={500} placeholder={t("common.optional")} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="lead-email" className="text-xs">{t("adminSchools.leadEmail")}</Label>
              <Input id="lead-email" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium">{t("adminSchools.language")}</p>
              <div className="flex gap-2">
                {LEAD_LANGUAGES.map((l) => (
                  <button key={l} type="button" onClick={() => setLanguage(l)}
                    className={cn("rounded-full border px-3 py-1 text-xs font-medium", language === l ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground")}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>{t("common.cancel")}</Button>
            <Button disabled={!formValid || busy} onClick={() => void submit()}>
              {form === "create" ? t("adminSchools.createSubmit") : t("adminSchools.linkSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
