import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, MapPin, Plane } from "lucide-react";

const ONBOARDING_KEY = "flyary-onboarding-done";

export default function OnboardingDialog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) setOpen(true);
  }, []);

  const close = () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setOpen(false);
  };

  const steps = [
    {
      icon: User,
      title: t("onboarding.step1Title"),
      desc: t("onboarding.step1Desc"),
      action: () => { close(); navigate("/profile"); },
      actionLabel: t("onboarding.goToProfile"),
    },
    {
      icon: MapPin,
      title: t("onboarding.step2Title"),
      desc: t("onboarding.step2Desc"),
      action: () => { close(); navigate("/locations"); },
      actionLabel: t("onboarding.goToLocations"),
    },
    {
      icon: Plane,
      title: t("onboarding.step3Title"),
      desc: t("onboarding.step3Desc"),
      action: () => { close(); navigate("/flights/new"); },
      actionLabel: t("onboarding.goToFlight"),
    },
  ];

  const current = steps[step];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-sm text-center">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="text-2xl font-bold">{t("onboarding.welcome")}</div>
          <p className="text-sm text-muted-foreground">{t("onboarding.intro")}</p>

          <div className="w-full mt-2 space-y-1">
            {steps.map((s, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                  i === step ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-2 w-full mt-2">
            <Button variant="ghost" className="flex-1" onClick={close}>
              {t("onboarding.skip")}
            </Button>
            <Button className="flex-1" onClick={current.action}>
              {current.actionLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
