import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mountain } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (resetMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: "E-Mail gesendet", description: "Prüfe dein Postfach für den Reset-Link." });
        setResetMode(false);
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({ title: "Registrierung erfolgreich", description: "Prüfe dein Postfach zur Bestätigung." });
      }
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <Card className="w-full max-w-sm shadow-xl border-0">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Mountain className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Flugtagebuch</CardTitle>
          <CardDescription>
            {resetMode ? "Passwort zurücksetzen" : isLogin ? "Melde dich an" : "Erstelle ein Konto"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && !resetMode && (
              <div className="space-y-2">
                <Label htmlFor="name">Pilotenname</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dein Name" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="pilot@example.com" />
            </div>
            {!resetMode && (
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••" />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "..." : resetMode ? "Link senden" : isLogin ? "Anmelden" : "Registrieren"}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            {!resetMode && (
              <button onClick={() => setResetMode(true)} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                Passwort vergessen?
              </button>
            )}
            <div>
              <button onClick={() => { setIsLogin(!isLogin); setResetMode(false); }} className="text-sm text-primary font-medium hover:underline">
                {isLogin ? "Neues Konto erstellen" : "Bereits registriert? Anmelden"}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
