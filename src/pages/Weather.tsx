import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function Weather() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-bold tracking-tight">{t("more.weather")}</h1>
      </div>
      <iframe
        src="https://www.burnair.ch/meteo/map.php"
        className="flex-1 w-full border-0"
        title="burnair Meteo Map"
        allow="geolocation"
        loading="lazy"
      />
    </div>
  );
}
