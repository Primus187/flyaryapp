import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListRowProps {
  icon?: LucideIcon;
  label: string;
  description?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
  className?: string;
}

/** Einheitliche Listenzeile für Navigations- und Einstellungslisten. */
export default function ListRow({
  icon: Icon, label, description, onClick, trailing, destructive, className,
}: ListRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl border shadow-sm text-left transition-all active:scale-[0.99]",
        destructive
          ? "border-transparent text-destructive hover:bg-destructive/10"
          : "bg-card border-border/50 hover:bg-muted/50",
        className,
      )}
    >
      {Icon && <Icon className={cn("h-5 w-5 shrink-0", destructive ? "" : "text-primary")} />}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium truncate">{label}</span>
        {description && <span className="block text-xs text-muted-foreground truncate">{description}</span>}
      </span>
      {trailing ?? (!destructive && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />)}
    </button>
  );
}
