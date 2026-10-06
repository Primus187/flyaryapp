import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Hourglass, KeyRound, LogOut, Mail, PauseCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { APP_ACCESS_KEY } from "@/hooks/use-app-access";
import { parseInviteInput, type AppAccess } from "@/lib/app-access";
import { deleteOwnAccount } from "@/lib/delete-account";

const ROLES = ["student", "pilot", "tandem_pilot", "instructor"] as const;
const DISCIPLINES = ["paraglider", "hangglider"] as const;
const WEBSITE = "https://www.flyary.ch";

/**
 * Pilot phase (migration 0079): a signed-in account without an invitation sees this instead of the app.
 * It can redeem an invitation (school/group code or personal link) or join the test list.
 * A paused account (migration 0084) only sees that its access is paused and how to reach Flyary.
 */
export default function WaitingRoom({ access }: { access: AppAccess }) {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const lang = ["de", "fr", "en"].includes(i18n.language?.slice(0, 2)) ? i18n.language.slice(0, 2) : "de";
  const linkedCode = location.pathname === "/groups" ? new URLSearchParams(location.search).get("invite") ?? "" : "";
  const [invite, setInvite] = useState(linkedCode);
  const [redeeming, setRedeeming] = useState(false);
  const [role, setRole] = useState<string>("");
  const [disciplines, setDisciplines] = useState<string[]>(["paraglider"]);
  const [school, setSchool] = useState("");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const name = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "";

  const refresh = () => queryClient.invalidateQueries({ queryKey: [APP_ACCESS_KEY] });

  const redeem = async () => {
    const parsed = parseInviteInput(invite);
    if (!parsed) { toast.error(t("access.inviteUnknown")); return; }
    if (parsed.kind === "personal") { navigate(`/welcome/${parsed.token}`); return; }
    if (parsed.kind === "lead") { navigate(`/welcome/lead/${parsed.token}`); return; }
    setRedeeming(true);
    const { data, error } = await supabase.rpc("join_group_by_invite_code", { _invite_code: parsed.code });
    setRedeeming(false);
    if (error) { toast.error(/invalid invite code/i.test(error.message) ? t("access.inviteUnknown") : t("common.error")); return; }
    const group = (data as { name: string }[] | null)?.[0];
    toast.success(t("access.joined", { name: group?.name ?? "" }));
    await refresh();
    navigate("/groups", { replace: true });
  };

  const join = async () => {
    if (!role || !consent) return;
    setSending(true);
    const { data, error } = await supabase.rpc("join_waitlist_from_app" as never, {
      _language: lang, _role: role, _disciplines: disciplines, _school: school, _comment: comment,
    } as never);
    setSending(false);
    if (error || data !== "ok") { toast.error(t("common.error")); return; }
    await refresh();
  };

  const remove = async () => {
    try {
      await deleteOwnAccount(t("profile.notLoggedIn"));
      navigate("/auth", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const toggle = (d: string) => setDisciplines((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-primary bg-accent text-accent-foreground" : "border-border bg-background text-muted-foreground"}`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(145deg, hsl(199 89% 28%) 0%, hsl(199 89% 38%) 35%, hsl(152 44% 40%) 100%)" }}>
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{name ? t("access.welcomeName", { name }) : t("access.welcome")}</h1>
            {!access.revoked && <p className="text-sm text-muted-foreground">{t("access.intro")}</p>}
          </div>

          {access.revoked ? (
            <section className="flex gap-3 rounded-lg bg-muted p-3 text-sm">
              <PauseCircle className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{t("access.revokedTitle")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("access.revokedText")}</p>
                <a href="mailto:info@flyary.ch" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"><Mail className="h-3.5 w-3.5" />info@flyary.ch</a>
              </div>
            </section>
          ) : (<>
          <section className="space-y-2">
            <Label htmlFor="invite" className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-primary" />{t("access.inviteTitle")}</Label>
            <p className="text-xs text-muted-foreground">{linkedCode ? t("access.inviteDetected") : t("access.inviteHint")}</p>
            <div className="flex gap-2">
              <Input id="invite" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder={t("access.invitePlaceholder")} />
              <Button onClick={() => void redeem()} disabled={redeeming || !invite.trim()}>{t("access.redeem")}</Button>
            </div>
          </section>

          <section className="space-y-3 border-t pt-5">
            {access.waitlisted ? (
              <div className="flex gap-3 rounded-lg bg-muted p-3 text-sm">
                <Hourglass className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">{t("access.waitlistedTitle")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{access.invited ? t("access.invitedText") : t("access.waitlistedText")}</p>
                </div>
              </div>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold"><Mail className="h-4 w-4 text-primary" />{t("access.waitlistTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("access.waitlistHint", { email: user?.email ?? "" })}</p>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium">{t("access.role")}</p>
                  <div className="flex flex-wrap gap-2">{ROLES.map((r) => <button key={r} type="button" aria-pressed={role === r} className={chip(role === r)} onClick={() => setRole(r)}>{t(`adminWaitlist.role.${r}`)}</button>)}</div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium">{t("access.disciplines")}</p>
                  <div className="flex flex-wrap gap-2">{DISCIPLINES.map((d) => <button key={d} type="button" aria-pressed={disciplines.includes(d)} className={chip(disciplines.includes(d))} onClick={() => toggle(d)}>{t(`flightProof.discipline.${d}`)}</button>)}</div>
                </div>
                <div className="space-y-1.5"><Label htmlFor="school" className="text-xs">{t("access.school")}</Label><Input id="school" value={school} maxLength={120} onChange={(e) => setSchool(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="comment" className="text-xs">{t("access.comment")}</Label><Textarea id="comment" value={comment} maxLength={1000} rows={2} onChange={(e) => setComment(e.target.value)} /></div>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                  <span>{t("access.consent")}</span>
                </label>
                <Button className="w-full gap-2" onClick={() => void join()} disabled={sending || !role || !consent}><Check className="h-4 w-4" />{t("access.join")}</Button>
              </>
            )}
          </section>
          </>)}

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
            <a href={`${WEBSITE}/${lang}/`} className="hover:text-primary">{t("access.about")}</a>
            <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-1 hover:text-primary"><LogOut className="h-3.5 w-3.5" />{t("access.signOut")}</button>
            {confirmDelete ? (
              <button type="button" onClick={() => void remove()} className="inline-flex items-center gap-1 font-medium text-destructive"><Trash2 className="h-3.5 w-3.5" />{t("access.deleteConfirm")}</button>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" />{t("settings.deleteAccount")}</button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
