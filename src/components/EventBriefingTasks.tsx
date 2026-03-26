import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, User } from "lucide-react";

interface BriefingTask {
  id: string;
  label: string;
  task_type: string;
  assigned_user_id: string | null;
  sort_order: number;
}

interface Props {
  tasks: BriefingTask[];
  profiles: Record<string, string>;
  maneuverNames: string[];
}

export default function EventBriefingTasks({ tasks, profiles, maneuverNames }: Props) {
  const { t } = useTranslation();

  if (tasks.length === 0 && maneuverNames.length === 0) return null;

  return (
    <div className="space-y-3">
      {tasks.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {t("events.briefingLabel")}
          </h2>
          <div className="space-y-1.5">
            {tasks.sort((a, b) => a.sort_order - b.sort_order).map((task) => (
              <Card key={task.id} className="border-0 shadow-sm">
                <CardContent className="p-2.5 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm flex-1">{task.label}</span>
                  {task.assigned_user_id && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {profiles[task.assigned_user_id] || "?"}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {maneuverNames.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {t("events.plannedManeuvers")}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {maneuverNames.map((name, i) => (
              <span key={i} className="text-xs bg-muted px-2 py-1 rounded-md">{name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
