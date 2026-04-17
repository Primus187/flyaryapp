import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface License {
  name: string;
  license: string;
  url: string;
}

const licenses: License[] = [
  { name: "React", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "Vite", license: "MIT", url: "https://github.com/vitejs/vite" },
  { name: "Tailwind CSS", license: "MIT", url: "https://github.com/tailwindlabs/tailwindcss" },
  { name: "shadcn/ui", license: "MIT", url: "https://github.com/shadcn-ui/ui" },
  { name: "Radix UI", license: "MIT", url: "https://github.com/radix-ui/primitives" },
  { name: "Leaflet", license: "BSD-2-Clause", url: "https://github.com/Leaflet/Leaflet" },
  { name: "react-leaflet", license: "Hippocratic-2.1", url: "https://github.com/PaulLeCam/react-leaflet" },
  { name: "MapLibre GL JS", license: "BSD-3-Clause", url: "https://github.com/maplibre/maplibre-gl-js" },
  { name: "Lucide Icons", license: "ISC", url: "https://github.com/lucide-icons/lucide" },
  { name: "Recharts", license: "MIT", url: "https://github.com/recharts/recharts" },
  { name: "TanStack Query", license: "MIT", url: "https://github.com/TanStack/query" },
  { name: "Embla Carousel", license: "MIT", url: "https://github.com/davidjerleke/embla-carousel" },
  { name: "react-i18next", license: "MIT", url: "https://github.com/i18next/react-i18next" },
  { name: "OpenTopoMap Tiles", license: "CC-BY-SA 3.0", url: "https://opentopomap.org/about" },
  { name: "Supabase JS", license: "MIT", url: "https://github.com/supabase/supabase-js" },
  { name: "Capacitor", license: "MIT", url: "https://github.com/ionic-team/capacitor" },
];

export default function LegalLicenses() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight">{t("legal.licensesTitle")}</h1>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{t("legal.licensesIntro")}</p>

      <ul className="space-y-2">
        {licenses.map((l) => (
          <li key={l.name} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card p-3">
            <div className="min-w-0 flex-1">
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground hover:underline truncate block"
              >
                {l.name}
              </a>
              <p className="text-[11px] text-muted-foreground">{l.license}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
