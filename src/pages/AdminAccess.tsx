import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WaitlistPanel from "@/components/admin/WaitlistPanel";
import AccountsPanel from "@/components/admin/AccountsPanel";
import AdminLogPanel from "@/components/admin/AdminLogPanel";

const TABS = ["waitlist", "accounts", "log"] as const;
type Tab = (typeof TABS)[number];

/** Betriebsbereich "Zugänge" (plan §5): test list, accounts with pause/restore, operator log. */
export default function AdminAccess() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? params.get("tab") as Tab : "waitlist";

  return (
    <PageContainer className="space-y-4">
      <PageHeader title={t("adminAccess.title")} subtitle={t("adminAccess.subtitle")} back="/admin" />
      <Tabs value={tab} onValueChange={(v) => setParams(v === "waitlist" ? {} : { tab: v }, { replace: true })}>
        <TabsList className="grid w-full grid-cols-3">
          {TABS.map((key) => <TabsTrigger key={key} value={key}>{t(`adminAccess.tabs.${key}`)}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="waitlist" className="mt-4"><WaitlistPanel /></TabsContent>
        <TabsContent value="accounts" className="mt-4"><AccountsPanel /></TabsContent>
        <TabsContent value="log" className="mt-4"><AdminLogPanel /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}
