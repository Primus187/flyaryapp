import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_ACCESS_KEY } from "@/hooks/use-app-access";

type Outcome = "ok" | "invalid" | "expired" | "used" | "revoked" | "error";

/**
 * Personal invitation link from the test list (/welcome/<token>, migration 0079) or school lead link
 * (/welcome/lead/<token>, migration 0085: the account becomes group admin of the school). Signed-in only.
 */
export default function RedeemInvite({ kind = "personal" }: { kind?: "personal" | "lead" }) {
  const { token = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const rpc = kind === "lead" ? "redeem_school_lead_invite" : "redeem_access_invite";
      const { data, error } = await supabase.rpc(rpc as never, { _token: token } as never);
      const result = (error ? "error" : data) as Outcome;
      if (result === "ok") {
        await queryClient.invalidateQueries({ queryKey: [APP_ACCESS_KEY] });
        toast.success(t(kind === "lead" ? "access.leadRedeemed" : "access.redeemed"));
        navigate(kind === "lead" ? "/school" : "/", { replace: true });
        return;
      }
      setOutcome(result);
    })();
  }, [kind, token, navigate, queryClient, t]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(145deg, hsl(199 89% 28%) 0%, hsl(199 89% 38%) 35%, hsl(152 44% 40%) 100%)" }}>
      <Card className="w-full max-w-sm shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
        <CardContent className="space-y-4 p-6 text-center">
          {outcome === null ? (
            <p className="text-sm text-muted-foreground">{t("access.redeeming")}</p>
          ) : (
            <>
              <h1 className="text-lg font-semibold">{t("access.redeemFailedTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t(`access.redeemFailed.${outcome}`)}</p>
              <Button className="w-full" onClick={() => navigate("/", { replace: true })}>{t("access.continue")}</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
