import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Plane, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isPlausibleToken, type PassengerInfo } from "@/lib/tandem";

type State = "loading" | "open" | "invalid" | "confirmed" | "error";

/**
 * Public page behind the passenger's single-use link (migration 0076): shows date, sites, pilot and
 * duration and lets the passenger confirm the tandem flight without an account.
 */
export default function PassengerConfirm() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "fr" ? "fr-CH" : i18n.language === "en" ? "en-GB" : "de-CH";
  const [state, setState] = useState<State>("loading");
  const [info, setInfo] = useState<PassengerInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPlausibleToken(token)) { setState("invalid"); return; }
    supabase.rpc("passenger_confirmation_info" as never, { _token: token } as never).then(({ data, error }) => {
      if (error) { setState("error"); return; }
      const i = data as unknown as PassengerInfo | null;
      setInfo(i);
      setState(i && !i.expired ? "open" : "invalid");
    });
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("confirm_as_passenger" as never, { _token: token } as never);
    setBusy(false);
    setState(error ? "error" : data ? "confirmed" : "invalid");
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 flex justify-center">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center gap-2 text-primary"><Plane className="h-6 w-6" /><span className="text-xl font-bold">Flyary</span></div>
        <h1 className="text-lg font-semibold">{t("tandem.publicTitle")}</h1>
        {state === "loading" && <Skeleton className="h-40 w-full rounded-2xl" />}
        {state === "invalid" && <Card><CardContent className="p-4 flex gap-2 text-sm"><XCircle className="h-5 w-5 text-destructive shrink-0" />{t("tandem.publicInvalid")}</CardContent></Card>}
        {state === "error" && <Card><CardContent className="p-4 text-sm" role="alert">{t("tandem.publicError")}</CardContent></Card>}
        {state === "confirmed" && <Card><CardContent className="p-4 flex gap-2 text-sm"><CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />{t("tandem.publicThanks")}</CardContent></Card>}
        {state === "open" && info && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm">{t("tandem.publicIntro", { pilot: info.pilotName || "—", passenger: info.passengerName })}</p>
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{t("flights.date")}</dt><dd>{new Date(`${info.date}T00:00:00`).toLocaleDateString(locale)}</dd>
                <dt className="text-muted-foreground">{t("flights.takeoff")}</dt><dd>{info.takeoff || "—"}</dd>
                <dt className="text-muted-foreground">{t("flights.landing")}</dt><dd>{info.landing || "—"}</dd>
                <dt className="text-muted-foreground">{t("flights.duration")}</dt><dd>{info.durationMinutes != null ? `${info.durationMinutes} min` : "—"}</dd>
                <dt className="text-muted-foreground">{t("tandem.pilot")}</dt><dd>{info.pilotName || "—"}</dd>
              </dl>
              <p className="text-xs text-muted-foreground">{t("tandem.publicPrivacy")}</p>
              <Button className="w-full" disabled={busy} onClick={() => void confirm()}>{t("tandem.publicConfirm")}</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
