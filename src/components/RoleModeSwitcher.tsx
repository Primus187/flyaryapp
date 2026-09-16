import { useTranslation } from "react-i18next";
import { GraduationCap, Plane } from "lucide-react";
import { useRoleMode } from "@/contexts/RoleModeContext";
import { cn } from "@/lib/utils";

/** Umschalter zwischen Pilotenbereich und Flugschulbereich. Nur für das Schulteam sichtbar. */
export default function RoleModeSwitcher({ className }: { className?: string }) {
  const { mode, setMode, canSwitch } = useRoleMode();
  const { t } = useTranslation();

  if (!canSwitch) return null;

  const options: { key: "pilot" | "school"; label: string; icon: typeof Plane }[] = [
    { key: "pilot", label: t("roleMode.pilot"), icon: Plane },
    { key: "school", label: t("roleMode.school"), icon: GraduationCap },
  ];

  return (
    <div
      role="tablist"
      aria-label={t("roleMode.label")}
      className={cn("flex items-center gap-1 p-1 rounded-full bg-muted/60 border border-border/50", className)}
    >
      {options.map(({ key, label, icon: Icon }) => {
        const active = mode === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMode(key)}
            className={cn(
              "flex items-center justify-center gap-1.5 flex-1 h-9 px-3 rounded-full text-xs font-semibold transition-colors active:scale-[0.98]",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
