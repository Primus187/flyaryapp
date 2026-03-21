import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false); const [googleLoading, setGoogleLoading] = useState(false); const [resetMode, setResetMode] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleGoogleSignIn = async () => { setGoogleLoading(true); try { const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin }); if (error) throw error; } catch (err: any) { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); } finally { setGoogleLoading(false); } };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (resetMode) { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); if (error) throw error; toast({ title: t("auth.emailSent"), description: t("auth.emailSentDesc") }); setResetMode(false); }
      else if (isLogin) { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; navigate("/"); }
      else { const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin } }); if (error) throw error; toast({ title: t("auth.signUpSuccess"), description: t("auth.signUpSuccessDesc") }); }
    } catch (err: any) { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(145deg, hsl(199 89% 28%) 0%, hsl(199 89% 38%) 35%, hsl(152 44% 40%) 100%)" }}>
      <Card className="w-full max-w-sm shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-3">
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Flyary</h2>
          <CardDescription>{resetMode ? t("auth.resetPassword") : isLogin ? t("auth.signIn") : t("auth.signUp")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && !resetMode && (<div className="space-y-2"><Label htmlFor="name">{t("auth.pilotName")}</Label><Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("auth.pilotNamePlaceholder")} /></div>)}
            <div className="space-y-2"><Label htmlFor="email">{t("auth.emailLabel")}</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t("auth.emailPlaceholder")} /></div>
            {!resetMode && (<div className="space-y-2"><Label htmlFor="password">{t("auth.passwordLabel")}</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••" /></div>)}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "..." : resetMode ? t("auth.sendLink") : isLogin ? t("auth.signInAction") : t("auth.signUpAction")}</Button>
          </form>
          {!resetMode && (<><div className="flex items-center gap-3 my-4"><Separator className="flex-1" /><span className="text-xs text-muted-foreground">{t("common.or")}</span><Separator className="flex-1" /></div><Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={googleLoading}><svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>{googleLoading ? "..." : t("auth.withGoogle")}</Button></>)}
          <div className="mt-4 text-center space-y-2">
            {!resetMode && <button onClick={() => setResetMode(true)} className="text-xs text-muted-foreground hover:text-primary transition-colors">{t("auth.forgotPassword")}</button>}
            <div><button onClick={() => { setIsLogin(!isLogin); setResetMode(false); }} className="text-sm text-primary font-medium hover:underline">{isLogin ? t("auth.createAccount") : t("auth.alreadyRegistered")}</button></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
