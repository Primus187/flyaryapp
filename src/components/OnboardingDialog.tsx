import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, MapPin, Plane, FileSpreadsheet, Cloud, ChevronRight, Sparkles, GraduationCap, CalendarDays, BadgeCheck, UserPlus, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ONBOARDING_KEY = "flyary-onboarding-done";

type Kind = "pilot" | "student" | "staff";
interface OnboardingState { show: boolean; kind: Kind; school: string | null }
interface Entry { icon: LucideIcon; title: string; desc: string; path: string }

/**
 * Welcome dialog per path (migration 0081): school students, the school team and pilots each see their own
 * introduction once per account. Falls back to the former per-browser flag if the server check fails.
 */
export default function OnboardingDialog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [closed, setClosed] = useState(false);
  const state = useQuery({
    queryKey: ["onboarding", user?.id],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async (): Promise<OnboardingState> => {
      const { data, error } = await supabase.rpc("my_onboarding" as never);
      if (error) throw error;
      return data as unknown as OnboardingState;
    },
  });
  const legacyDone = (() => { try { return !!localStorage.getItem(ONBOARDING_KEY); } catch { return true; } })();
  const kind: Kind = state.data?.kind ?? "pilot";
  const school = state.data?.school ?? "";
  const open = !closed && (state.data ? state.data.show : state.isError && !legacyDone);

  const close = () => {
    setClosed(true);
    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* private mode */ }
    // Supabase requests only run when awaited or then()-ed.
    if (state.data) void supabase.rpc("complete_onboarding" as never, { _kind: kind } as never).then(() => undefined);
  };
  const go = (path: string) => { close(); navigate(path); };

  const content: Record<Kind, { title: string; intro: string; fastLabel: string; fast: Entry[]; stepsLabel: string; steps: Entry[] }> = {
    pilot: {
      title: t("onboarding.welcome"), intro: t("onboarding.intro"),
      fastLabel: t("onboarding.fastTrack"),
      fast: [
        { icon: Cloud, title: t("onboarding.shortcutXcontestTitle"), desc: t("onboarding.shortcutXcontestDesc"), path: "/profile" },
        { icon: FileSpreadsheet, title: t("onboarding.shortcutXlsxTitle"), desc: t("onboarding.shortcutXlsxDesc"), path: "/import" },
      ],
      stepsLabel: t("onboarding.orStartFresh"),
      steps: [
        { icon: User, title: t("onboarding.step1Title"), desc: t("onboarding.step1Desc"), path: "/profile" },
        { icon: MapPin, title: t("onboarding.step2Title"), desc: t("onboarding.step2Desc"), path: "/locations" },
        { icon: Plane, title: t("onboarding.step3Title"), desc: t("onboarding.step3Desc"), path: "/flights/new" },
      ],
    },
    student: {
      title: t("onboarding.studentWelcome", { school }), intro: t("onboarding.studentIntro"),
      fastLabel: t("onboarding.studentStart"),
      fast: [
        { icon: User, title: t("onboarding.studentProfileTitle"), desc: t("onboarding.studentProfileDesc"), path: "/profile" },
        { icon: GraduationCap, title: t("onboarding.studentTrainingTitle"), desc: t("onboarding.studentTrainingDesc"), path: "/training" },
        { icon: CalendarDays, title: t("onboarding.studentEventsTitle"), desc: t("onboarding.studentEventsDesc"), path: "/events" },
      ],
      stepsLabel: t("onboarding.fastTrack"),
      steps: [{ icon: FileSpreadsheet, title: t("onboarding.shortcutXlsxTitle"), desc: t("onboarding.studentImportDesc"), path: "/import" }],
    },
    staff: {
      title: t("onboarding.staffWelcome", { school }), intro: t("onboarding.staffIntro"),
      fastLabel: t("onboarding.staffStart"),
      fast: [
        { icon: UserPlus, title: t("onboarding.staffInviteTitle"), desc: t("onboarding.staffInviteDesc"), path: "/school" },
        { icon: BadgeCheck, title: t("onboarding.staffCertificateTitle"), desc: t("onboarding.staffCertificateDesc"), path: "/school/safety" },
      ],
      stepsLabel: t("onboarding.staffAlso"),
      steps: [{ icon: User, title: t("onboarding.step1Title"), desc: t("onboarding.step1Desc"), path: "/profile" }],
    },
  };
  const c = content[kind];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-sm">
        <div className="flex flex-col gap-5 py-2">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{c.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{c.intro}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{c.fastLabel}</p>
            <div className="space-y-1.5">
              {c.fast.map((s) => (
                <button
                  key={s.title}
                  onClick={() => go(s.path)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{c.stepsLabel}</p>
            <div className="space-y-1.5">
              {c.steps.map((s) => (
                <button
                  key={s.title}
                  onClick={() => go(s.path)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/60 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Button variant="ghost" className="w-full" onClick={close}>
            {t("onboarding.skip")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
