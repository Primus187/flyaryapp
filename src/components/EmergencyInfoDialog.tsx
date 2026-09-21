import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Siren } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  type EmergencyContactInfo,
  hasAnyMedicalData,
  hasEmergencyContact,
  hasMedicalConsent,
  parseEmergencyAccessError,
} from "@/lib/emergency-access";

interface Props {
  eventId: string;
  userId: string;
  pilotName: string;
}

/** Abschnitt 8.3: Ein-Klick-Notfallzugriff aus der Teilnehmerliste; jeder Aufruf wird über die RPC protokolliert (Abschnitt 12.3). */
export default function EmergencyInfoDialog({ eventId, userId, pilotName }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<EmergencyContactInfo | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);

  const load = async () => {
    setOpen(true);
    setLoading(true);
    setInfo(null);
    setErrorReason(null);
    const rpcParams = { _event_id: eventId, _target_user_id: userId };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet
    const { data, error } = await supabase.rpc("get_emergency_contact_info" as any, rpcParams as any);
    setLoading(false);
    if (error) {
      setErrorReason(parseEmergencyAccessError(error.message));
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      setErrorReason("unknown");
      return;
    }
    setInfo({
      emergencyContactName: row.emergency_contact_name,
      emergencyContactPhone: row.emergency_contact_phone,
      bloodType: row.blood_type,
      allergies: row.allergies,
      medicalNotes: row.medical_notes,
      healthDataConsentAt: row.health_data_consent_at,
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 shrink-0 text-destructive"
        onClick={load}
        aria-label={t("emergency.button")}
      >
        <Siren className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Siren className="h-4 w-4 text-destructive" />
              {t("emergency.title", { name: pilotName })}
            </DialogTitle>
          </DialogHeader>
          {loading && <p className="text-sm text-muted-foreground">{t("emergency.loading")}</p>}
          {!loading && errorReason && (
            <p className="text-sm text-destructive">{t(`emergency.error.${errorReason}`)}</p>
          )}
          {!loading && info && (
            <div className="space-y-3 text-sm">
              {hasEmergencyContact(info) ? (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t("emergency.contact")}</p>
                  {info.emergencyContactName && <p>{info.emergencyContactName}</p>}
                  {info.emergencyContactPhone && (
                    <a href={`tel:${info.emergencyContactPhone}`} className="text-primary underline">
                      {info.emergencyContactPhone}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">{t("emergency.noContact")}</p>
              )}
              {hasMedicalConsent(info) ? (
                hasAnyMedicalData(info) ? (
                  <div className="space-y-1.5">
                    {info.bloodType && (
                      <p><span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t("emergency.bloodType")}: </span>{info.bloodType}</p>
                    )}
                    {info.allergies && (
                      <p><span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t("emergency.allergies")}: </span>{info.allergies}</p>
                    )}
                    {info.medicalNotes && (
                      <p><span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t("emergency.medicalNotes")}: </span>{info.medicalNotes}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t("emergency.noMedicalData")}</p>
                )
              ) : (
                <p className="text-muted-foreground">{t("emergency.noConsent")}</p>
              )}
              <p className="text-[10px] text-muted-foreground pt-1 border-t">{t("emergency.loggedHint")}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
