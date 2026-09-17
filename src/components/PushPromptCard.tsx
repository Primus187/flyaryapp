import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";

export default function PushPromptCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isSupported, isSubscribed, loading, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  if (!isSupported || dismissed) return null;
  if (isSubscribed && !justEnabled) return null;

  const enable = async () => {
    const ok = await subscribe();
    if (ok) {
      setJustEnabled(true);
      toast({ title: t("push.enabled") });
    } else {
      toast({ title: t("push.denied"), variant: "destructive" });
    }
  };

  const sendTest = async () => {
    if (!user) return;
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: { user_id: user.id, title: t("push.testTitle"), body: t("push.testBody"), url: "/" },
    });
    setTesting(false);
    if (error || !(data as any)?.sent) {
      toast({ title: t("push.testFailed"), variant: "destructive" });
      return;
    }
    toast({ title: t("push.testSent") });
  };

  return (
    <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardContent className="p-4 flex items-start gap-3">
        <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div>
            <p className="font-semibold text-sm">{isSubscribed ? t("push.activeTitle") : t("push.title")}</p>
            <p className="text-xs text-muted-foreground">{isSubscribed ? t("push.activeDesc") : t("push.desc")}</p>
          </div>
          <div className="flex gap-2">
            {isSubscribed ? (
              <Button size="sm" variant="outline" onClick={sendTest} disabled={testing}>
                {t("push.test")}
              </Button>
            ) : (
              <Button size="sm" onClick={enable} disabled={loading}>
                {t("push.enable")}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              {t("common.later")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
