import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";

export default function Legal() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t("legal.title")} back />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("legal.impressumTitle")}</h2>
        <div className="text-sm text-muted-foreground space-y-1 leading-relaxed whitespace-pre-line">
          <p>{t("legal.impressumText")}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("legal.privacyTitle")}</h2>
        <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
          <p>{t("legal.privacyIntro")}</p>
          <h3 className="text-sm font-medium text-foreground">{t("legal.dataCollectionTitle")}</h3>
          <p>{t("legal.dataCollectionText")}</p>
          <h3 className="text-sm font-medium text-foreground">{t("legal.dataUsageTitle")}</h3>
          <p>{t("legal.dataUsageText")}</p>
          <h3 className="text-sm font-medium text-foreground">{t("legal.dataStorageTitle")}</h3>
          <p>{t("legal.dataStorageText")}</p>
          <h3 className="text-sm font-medium text-foreground">{t("legal.rightsTitle")}</h3>
          <p>{t("legal.rightsText")}</p>
          <h3 className="text-sm font-medium text-foreground">{t("legal.contactTitle")}</h3>
          <p>{t("legal.contactText")}</p>
        </div>
      </section>

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => navigate("/legal/terms")}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 shadow-sm hover:bg-muted/50 active:scale-[0.99] transition-all"
        >
          <span className="text-sm font-medium">{t("legal.termsTitle")}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate("/legal/licenses")}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 shadow-sm hover:bg-muted/50 active:scale-[0.99] transition-all"
        >
          <span className="text-sm font-medium">{t("legal.licensesTitle")}</span>
        </button>
      </section>
    </PageContainer>
  );
}
