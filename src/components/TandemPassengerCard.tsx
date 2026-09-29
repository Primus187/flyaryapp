import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { UserCheck, Link2, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { passengerLink } from "@/lib/tandem";

interface Passenger { passenger_name: string; status: "pending" | "confirmed"; confirmed_at: string | null; token_expires_at: string | null }

/**
 * Passenger of a tandem flight (migration 0076), seen by the pilot: name, confirmation status and a
 * single-use link / QR code for a passenger without a Flyary account.
 */
export default function TandemPassengerCard({ flightId, cancelled, locale }: { flightId: string; cancelled: boolean; locale: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [passenger, setPassenger] = useState<Passenger | null>(null);
  const [changedSince, setChangedSince] = useState(false);
  const [name, setName] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("flight_passengers" as never)
      .select("passenger_name, status, confirmed_at, token_expires_at").eq("flight_id", flightId).maybeSingle();
    const p = (data as unknown as Passenger) ?? null;
    setPassenger(p);
    setName((prev) => prev || p?.passenger_name || "");
    if (p?.status === "confirmed" && p.confirmed_at) {
      const { data: changes } = await supabase.from("flight_changes" as never).select("id")
        .eq("flight_id", flightId).gt("changed_at", p.confirmed_at).neq("field", "passenger").limit(1);
      setChangedSince(!!(changes as unknown[] | null)?.length);
    } else setChangedSince(false);
  }, [flightId]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!link) { setQr(null); return; }
    QRCode.toDataURL(link, { width: 280, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [link]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (err) { toast({ title: t("common.error"), description: (err as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const save = () => run(async () => {
    const { error } = await supabase.rpc("set_flight_passenger" as never, { _flight_id: flightId, _name: name.trim() } as never);
    if (error) throw error;
    setLink(null);
    await load();
    toast({ title: t("tandem.passengerSaved") });
  });

  const createLink = () => run(async () => {
    const { data, error } = await supabase.rpc("create_passenger_token" as never, { _flight_id: flightId } as never);
    if (error) throw error;
    setLink(passengerLink(window.location.origin, data as unknown as string));
  });

  const share = async () => {
    if (!link) return;
    try {
      if (navigator.share) await navigator.share({ title: t("tandem.shareTitle"), text: t("tandem.shareText"), url: link });
      else { await navigator.clipboard.writeText(link); toast({ title: t("tandem.linkCopied") }); }
    } catch { /* share sheet closed */ }
  };

  const date = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(locale) : "";

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3 space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("tandem.passenger")}</p>
        {passenger?.status === "confirmed" && (
          <p className="text-sm flex items-start gap-2"><UserCheck className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            {t("tandem.confirmedBy", { name: passenger.passenger_name, date: date(passenger.confirmed_at) })}</p>
        )}
        {passenger?.status === "pending" && (
          <p className="text-sm flex items-start gap-2"><Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />{t("tandem.pending", { name: passenger.passenger_name })}</p>
        )}
        {changedSince && (
          <p className="text-xs flex items-start gap-2 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{t("tandem.changedSince")}</p>
        )}
        <div className="flex gap-2">
          <Input className="h-8 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("tandem.namePlaceholder")} />
          <Button size="sm" className="h-8" disabled={busy || !name.trim() || name.trim() === passenger?.passenger_name} onClick={() => void save()}>{t("common.save")}</Button>
        </div>
        {passenger?.status === "pending" && !cancelled && (
          link ? (
            <div className="space-y-2 text-center">
              {qr && <img src={qr} alt={t("tandem.qrAlt")} className="mx-auto w-48 h-48" />}
              <p className="text-[11px] text-muted-foreground">{t("tandem.linkHint")}</p>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => void share()}><Link2 className="h-3.5 w-3.5" />{t("tandem.shareLink")}</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => void createLink()}>
              <Link2 className="h-3.5 w-3.5" />{t("tandem.createLink")}
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}
