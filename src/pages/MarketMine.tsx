import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import ManagedListings from "@/components/market/ManagedListings";
import FavoritesList from "@/components/market/FavoritesList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** "Meine Anzeigen" (plan 4.4) with the favourites list "Gemerkt" (plan 6.1, `?tab=favorites`). */
export default function MarketMine() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "favorites" ? "favorites" : "own";
  return (
    <PageContainer>
      <PageHeader
        title={t("market.mine.title")}
        back="/market"
        action={<Button size="sm" className="gap-1" onClick={() => navigate("/market/new")}><Plus className="h-4 w-4" />{t("market.mine.new")}</Button>}
      />
      {user && (
        <Tabs value={tab} onValueChange={(v) => setParams(v === "favorites" ? { tab: "favorites" } : {}, { replace: true })}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="own">{t("market.favorites.ownTab")}</TabsTrigger>
            <TabsTrigger value="favorites">{t("market.favorites.tab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="own"><ManagedListings seller={{ userId: user.id }} newPath="/market/new" /></TabsContent>
          <TabsContent value="favorites"><FavoritesList userId={user.id} /></TabsContent>
        </Tabs>
      )}
    </PageContainer>
  );
}
