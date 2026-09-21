import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IncidentReports from "@/components/school/IncidentReports";
import TeamCertifications from "@/components/school/TeamCertifications";
import EquipmentMaintenance from "@/components/school/EquipmentMaintenance";
import StudentEquipmentCheck from "@/components/school/StudentEquipmentCheck";

interface Props {
  groupId: string;
}

/** Sicherheit & Nachweise: Vorfälle, Zertifikate, Wartung, Ausrüstungscheck. */
export default function SchoolSafety({ groupId }: Props) {
  const { t } = useTranslation();

  return (
    <Tabs defaultValue="incidents">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="incidents" className="text-xs">{t("school.safety.tab")}</TabsTrigger>
        <TabsTrigger value="certs" className="text-xs">{t("school.certs.tab")}</TabsTrigger>
        <TabsTrigger value="maintenance" className="text-xs">{t("school.maintenance.tab")}</TabsTrigger>
        <TabsTrigger value="gear" className="text-xs">{t("school.gear.tab")}</TabsTrigger>
      </TabsList>
      <TabsContent value="incidents">
        <IncidentReports groupId={groupId} />
      </TabsContent>
      <TabsContent value="certs">
        <TeamCertifications groupId={groupId} />
      </TabsContent>
      <TabsContent value="maintenance">
        <EquipmentMaintenance groupId={groupId} />
      </TabsContent>
      <TabsContent value="gear">
        <StudentEquipmentCheck groupId={groupId} />
      </TabsContent>
    </Tabs>
  );
}
