import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { takeAuthRedirectError } from "@/lib/auth-redirect-error";

/**
 * Sign-in with Google only (decision 2026-09-28): no passwords and no confirmation or reset emails,
 * which the project could not send reliably. Email sign-in is also switched off in Supabase Auth.
 */
export default function Auth() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const website = ["de", "fr", "en"].includes(i18n.language?.slice(0, 2)) ? i18n.language.slice(0, 2) : "de";
  useEffect(() => {
    const redirectError = takeAuthRedirectError();
    if (redirectError) toast({ title: t("common.error"), description: redirectError, variant: "destructive" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- show once on arrival

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
      if (error) throw error;
    } catch (err: unknown) {
      toast({ title: t("common.error"), description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(145deg, hsl(199 89% 28%) 0%, hsl(199 89% 38%) 35%, hsl(152 44% 40%) 100%)" }}>
      <Card className="w-full max-w-sm shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-3">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Flyary</h2>
          <CardDescription>{t("auth.signIn")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" size="lg" onClick={() => { void handleGoogleSignIn(); }} disabled={googleLoading}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {googleLoading ? "..." : t("auth.withGoogle")}
          </Button>
          <p className="text-xs text-center text-muted-foreground">{t("auth.googleOnlyHint")}</p>
          {/* Pilot phase (migration 0079): new accounts need an invitation; say so before they sign in. */}
          <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">{t("auth.pilotPhaseTitle")}</p>
            <p>{t("auth.pilotPhaseInvite")}</p>
            <p>{t("auth.pilotPhaseNew")} <a className="font-medium text-primary hover:underline" href={`https://www.flyary.ch/${website}/testpilot/`}>{t("auth.pilotPhaseSignup")}</a></p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground pt-2">
            <a href={`https://www.flyary.ch/${website}/`} className="hover:text-primary transition-colors">www.flyary.ch</a>
            <span>·</span>
            <button onClick={() => navigate("/legal/terms")} className="hover:text-primary transition-colors">{t("legal.termsTitle")}</button>
            <span>·</span>
            <button onClick={() => navigate("/legal")} className="hover:text-primary transition-colors">{t("legal.privacyTitle")}</button>
            <span>·</span>
            <button onClick={() => navigate("/legal/licenses")} className="hover:text-primary transition-colors">{t("legal.licensesTitle")}</button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
