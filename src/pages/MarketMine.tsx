import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import ManagedListings from "@/components/market/ManagedListings";
import { Button } from "@/components/ui/button";

/** "Meine Anzeigen" (plan 4.4): own private listings by state, with the status actions. */
export default function MarketMine() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <PageContainer>
      <PageHeader
        title={t("market.mine.title")}
        back="/market"
        action={<Button size="sm" className="gap-1" onClick={() => navigate("/market/new")}><Plus className="h-4 w-4" />{t("market.mine.new")}</Button>}
      />
      {user && <ManagedListings seller={{ userId: user.id }} newPath="/market/new" />}
    </PageContainer>
  );
}
