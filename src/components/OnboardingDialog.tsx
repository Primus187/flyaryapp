import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, MapPin, Plane, FileSpreadsheet, Cloud, ChevronRight, Sparkles } from "lucide-react";

const ONBOARDING_KEY = "flyary-onboarding-done";

export default function OnboardingDialog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) setOpen(true);
  }, []);

  const close = () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setOpen(false);
  };

  const go = (path: string) => { close(); navigate(path); };

  const setupSteps = [
    { icon: User, title: t("onboarding.step1Title"), desc: t("onboarding.step1Desc"), path: "/profile" },
    { icon: MapPin, title: t("onboarding.step2Title"), desc: t("onboarding.step2Desc"), path: "/locations" },
    { icon: Plane, title: t("onboarding.step3Title"), desc: t("onboarding.step3Desc"), path: "/flights/new" },
  ];

  const shortcuts = [
    { icon: Cloud, title: t("onboarding.shortcutXcontestTitle"), desc: t("onboarding.shortcutXcontestDesc"), path: "/profile" },
    { icon: FileSpreadsheet, title: t("onboarding.shortcutXlsxTitle"), desc: t("onboarding.shortcutXlsxDesc"), path: "/import" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-sm">
        <div className="flex flex-col gap-5 py-2">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{t("onboarding.welcome")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("onboarding.intro")}</p>
          </div>

          {/* Fast-track shortcuts for users with existing data */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t("onboarding.fastTrack")}
            </p>
            <div className="space-y-1.5">
              {shortcuts.map((s, i) => (
                <button
                  key={i}
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

          {/* Manual setup */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t("onboarding.orStartFresh")}
            </p>
            <div className="space-y-1.5">
              {setupSteps.map((s, i) => (
                <button
                  key={i}
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
