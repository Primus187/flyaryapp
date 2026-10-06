import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Zeigt einen Zurück-Knopf. `true` = ein Schritt zurück, String = Zielpfad. */
  back?: boolean | string;
  /** Optionale Aktion rechts (z. B. „Neu"). */
  action?: React.ReactNode;
  className?: string;
}

/** Einheitlicher Seitenkopf: Titel, optionaler Rückweg und optionale Aktion. */
export default function PageHeader({ title, subtitle, back, action, className }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className={cn("flex items-center gap-3", className)}>
      {back && (
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={() => (typeof back === "string" ? navigate(back) : navigate(-1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] leading-7 font-extrabold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-[13px] font-medium text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </header>
  );
}
