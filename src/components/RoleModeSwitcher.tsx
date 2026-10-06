import { useTranslation } from "react-i18next";
import { GraduationCap, Plane } from "lucide-react";
import { useRoleMode } from "@/contexts/RoleModeContext";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

/** Umschalter zwischen Pilotenbereich und Flugschulbereich. Nur für das Schulteam sichtbar. */
export default function RoleModeSwitcher({ className }: { className?: string }) {
  const { mode, setMode, canSwitch } = useRoleMode();
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!canSwitch) return null;

  const options: { key: "pilot" | "school"; label: string; icon: typeof Plane }[] = [
    { key: "pilot", label: t("roleMode.pilot"), icon: Plane },
    { key: "school", label: t("roleMode.school"), icon: GraduationCap },
  ];

  return (
    <div
      role="group"
      aria-label={t("roleMode.label")}
      className={cn("flex items-center gap-1 p-1 rounded-lg bg-secondary", className)}
    >
      {options.map(({ key, label, icon: Icon }) => {
        const active = mode === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => { setMode(key); navigate(key === "school" ? "/school" : "/"); }}
            className={cn(
              "flex items-center justify-center gap-1.5 flex-1 h-10 px-3 rounded-[10px] text-sm transition-colors active:scale-[0.98]",
              active ? "bg-card text-foreground font-bold" : "text-muted-foreground font-semibold",
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
