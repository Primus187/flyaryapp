import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeading from "@/components/layout/SectionHeading";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, Check, Smartphone, Send } from "lucide-react";

interface PushPerson {
  user_id: string;
  pilot_name: string;
  enabled: boolean;
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isSupported, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  const [testing, setTesting] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [people, setPeople] = useState<Record<string, PushPerson[]>>({});

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const [adminRes, funcRes] = await Promise.all([
        supabase.from("group_members").select("group_id").eq("user_id", user.id).eq("role", "admin"),
        supabase
          .from("group_member_functions")
          .select("group_id")
          .eq("user_id", user.id)
          .in("function", ["instructor", "school_lead"]),
      ]);
      const ids = Array.from(
        new Set([...(adminRes.data || []).map((r) => r.group_id), ...(funcRes.data || []).map((r) => r.group_id)])
      );
      if (ids.length === 0) return;
      const { data: grps } = await supabase.from("groups").select("id, name").in("id", ids).eq("group_type", "school");
      if (cancelled || !grps?.length) return;
      setGroups(grps);
      const entries = await Promise.all(
        grps.map(async (g) => {
          const { data } = await supabase.rpc("get_group_push_status" as any, { _group_id: g.id } as any);
          return [g.id, ((data as any[]) || []) as PushPerson[]] as const;
        })
      );
      if (!cancelled) setPeople(Object.fromEntries(entries));
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, isSubscribed]);

  const enable = async () => {
    const res = await subscribe();
    if (res.ok) {
      toast({ title: t("push.enabled") });
      return;
    }
    toast({
      title: t(`push.reason.${res.reason ?? "failed"}`, { defaultValue: t("push.denied") }),
      description: res.message,
      variant: "destructive",
    });
  };

  const sendTest = async () => {
    if (!user) return;
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: { user_id: user.id, title: t("push.testTitle"), body: t("push.testBody"), url: "/" },
    });
    setTesting(false);
    toast(
      error || !(data as any)?.sent
        ? { title: t("push.testFailed"), variant: "destructive" }
        : { title: t("push.testSent") }
    );
  };

  return (
    <PageContainer>
      <PageHeader back="/more" title={t("push.pageTitle")} subtitle={t("push.pageSubtitle")} />

      <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            {isSubscribed ? (
              <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-semibold text-sm">{isSubscribed ? t("push.activeTitle") : t("push.title")}</p>
              <p className="text-xs text-muted-foreground">{isSubscribed ? t("push.activeDesc") : t("push.desc")}</p>
            </div>
          </div>

          {!isSupported ? (
            <p className="text-xs text-muted-foreground">{t("push.unsupported")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {isSubscribed ? (
                <>
                  <Button size="sm" onClick={sendTest} disabled={testing} className="gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    {t("push.test")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={unsubscribe} disabled={loading}>
                    {t("push.disable")}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={enable} disabled={loading}>
                  {t("push.enable")}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            <p className="font-semibold text-sm">{t("push.howToTitle")}</p>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>{t("push.howToIphone")}</li>
            <li>{t("push.howToAndroid")}</li>
            <li>{t("push.howToDesktop")}</li>
          </ul>
          {!isStandalone && <p className="text-xs text-primary">{t("push.installHint")}</p>}
        </CardContent>
      </Card>

      {groups.map((g) => {
        const list = people[g.id] || [];
        const active = list.filter((p) => p.enabled).length;
        return (
          <section key={g.id}>
            <SectionHeading title={t("push.recipients", { group: g.name })} />
            <p className="text-xs text-muted-foreground mb-2">
              {t("push.recipientsCount", { active, total: list.length })}
            </p>
            <div className="space-y-1.5">
              {list.map((p) => (
                <Card key={p.user_id} className="border-border/60 bg-card/80 shadow-sm">
                  <CardContent className="p-2.5 flex items-center gap-2">
                    <span className="text-sm flex-1 truncate">{p.pilot_name}</span>
                    {p.enabled ? (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Check className="h-3 w-3" />
                        {t("push.statusOn")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {t("push.statusOff")}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
              {list.length === 0 && <p className="text-xs text-muted-foreground">{t("push.noRecipients")}</p>}
            </div>
          </section>
        );
      })}
    </PageContainer>
  );
}
