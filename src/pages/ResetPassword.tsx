import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => { if (!window.location.hash.includes("type=recovery")) navigate("/auth"); }, [navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    else { toast({ title: t("auth.passwordChanged"), description: t("auth.passwordChangedDesc") }); navigate("/"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm"><CardHeader><CardTitle>{t("auth.newPassword")}</CardTitle></CardHeader><CardContent>
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2"><Label>{t("auth.newPasswordLabel")}</Label><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "..." : t("auth.changePassword")}</Button>
        </form>
      </CardContent></Card>
    </div>
  );
}
