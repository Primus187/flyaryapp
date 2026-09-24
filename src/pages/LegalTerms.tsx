import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function LegalTerms() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight">{t("legal.termsTitle")}</h1>
      </div>

      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>{t("legal.termsIntro")}</p>

        <h2 className="text-base font-semibold text-foreground pt-2">{t("legal.termsScopeTitle")}</h2>
        <p>{t("legal.termsScopeText")}</p>

        <h2 className="text-base font-semibold text-foreground pt-2">{t("legal.termsAccountTitle")}</h2>
        <p>{t("legal.termsAccountText")}</p>

        <h2 className="text-base font-semibold text-foreground pt-2">{t("legal.termsLiabilityTitle")}</h2>
        <p>{t("legal.termsLiabilityText")}</p>

        <h2 className="text-base font-semibold text-foreground pt-2">{t("legal.termsContentTitle")}</h2>
        <p>{t("legal.termsContentText")}</p>

        <h2 className="text-base font-semibold text-foreground pt-2">{t("market.terms.sectionTitle")}</h2>
        {["sectionRole", "sectionResponsibility", "sectionForbidden", "sectionModeration", "sectionSchools", "sectionData"].map((key) => (
          <p key={key}>{t(`market.terms.${key}`)}</p>
        ))}

        <h2 className="text-base font-semibold text-foreground pt-2">{t("legal.termsTerminationTitle")}</h2>
        <p>{t("legal.termsTerminationText")}</p>

        <h2 className="text-base font-semibold text-foreground pt-2">{t("legal.termsLawTitle")}</h2>
        <p>{t("legal.termsLawText")}</p>
      </section>
    </div>
  );
}
