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
    <header className={cn("flex items-start gap-2", className)}>
      {back && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 -ml-2 shrink-0 rounded-full"
          onClick={() => (typeof back === "string" ? navigate(back) : navigate(-1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </header>
  );
}
