import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import LoadingState from "@/components/layout/LoadingState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanCode, loadMfa, mfaStep, qrImageSrc, startEnroll, verifyCode, type MfaStep } from "@/lib/admin-mfa";

/** Code field shared by setup and sign-in: six digits, confirm with Enter. */
function CodeForm({ busy, onSubmit }: { busy: boolean; onSubmit: (code: string) => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const clean = cleanCode(code);
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (clean) onSubmit(clean); }}>
      <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code"
        placeholder="123 456" maxLength={7} autoFocus aria-label={t("adminMfa.code")} />
      <Button type="submit" disabled={!clean || busy}>{t("adminMfa.confirm")}</Button>
    </form>
  );
}

/**
 * Setting up an authenticator app: QR code (or the secret to type in), then the first code.
 * Used for the first factor (in the gate) and for further devices (AdminSecurity).
 */
export function EnrollTotp({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    setBusy(true);
    try { setSetup(await startEnroll()); } catch { toast.error(t("common.error")); }
    setBusy(false);
  };
  const confirm = async (code: string) => {
    if (!setup) return;
    setBusy(true);
    try { await verifyCode(setup.factorId, code); toast.success(t("adminMfa.enrolled")); onDone(); }
    catch { toast.error(t("adminMfa.wrongCode")); }
    setBusy(false);
  };

  if (!setup) {
    return <Button className="w-full gap-2" disabled={busy} onClick={() => void begin()}><Smartphone className="h-4 w-4" />{t("adminMfa.startSetup")}</Button>;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm">{t("adminMfa.scan")}</p>
      <img src={qrImageSrc(setup.qr)} alt={t("adminMfa.qrAlt")} className="mx-auto h-48 w-48 rounded-lg bg-white p-2" />
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">{t("adminMfa.manual")}</summary>
        <p className="mt-1 break-all font-mono">{setup.secret}</p>
      </details>
      <p className="text-sm">{t("adminMfa.enterFirstCode")}</p>
      <CodeForm busy={busy} onSubmit={(code) => void confirm(code)} />
    </div>
  );
}

/**
 * Betriebsbereich for an admin whose session is not confirmed with the second factor yet (migration 0088):
 * first time sets up an authenticator app, afterwards asks for the code once per session.
 */
export default function AdminMfaGate({ onVerified }: { onVerified: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<MfaStep | "error" | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setStep(null);
    loadMfa().then(({ factors, currentLevel }) => {
      setFactorId(factors[0]?.id ?? null);
      // An already confirmed session without admin rights would only loop: ask for the code again instead.
      const next = mfaStep(factors.length, currentLevel);
      setStep(next === "ok" ? "verify" : next);
    }).catch(() => setStep("error"));
  }, [attempt]);

  const confirm = async (code: string) => {
    if (!factorId) return;
    setBusy(true);
    try { await verifyCode(factorId, code); onVerified(); } catch { toast.error(t("adminMfa.wrongCode")); }
    setBusy(false);
  };

  if (step === null || step === "ok") return <LoadingState />;
  if (step === "error") {
    return (
      <PageContainer className="space-y-4">
        <PageHeader title={t("ops.title")} subtitle={t("adminMfa.subtitle")} back="/more" />
        <p className="text-sm text-destructive">{t("adminMfa.loadFailed")}</p>
        <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>{t("adminMfa.retry")}</Button>
      </PageContainer>
    );
  }
  return (
    <PageContainer className="space-y-4">
      <PageHeader title={t("ops.title")} subtitle={t("adminMfa.subtitle")} back="/more" />
      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {step === "enroll" ? <ShieldCheck className="h-5 w-5 text-primary" /> : <KeyRound className="h-5 w-5 text-primary" />}
            {t(step === "enroll" ? "adminMfa.enrollTitle" : "adminMfa.verifyTitle")}
          </p>
          <p className="text-sm text-muted-foreground">{t(step === "enroll" ? "adminMfa.enrollText" : "adminMfa.verifyText")}</p>
          {step === "enroll" ? <EnrollTotp onDone={onVerified} /> : <CodeForm busy={busy} onSubmit={(code) => void confirm(code)} />}
          {step === "enroll" && <p className="text-xs text-muted-foreground">{t("adminMfa.backupHint")}</p>}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
