import { addDays, format } from "date-fns";

export interface MaintenanceDeadline {
  equipment_id: string;
  due_at: string;
  completed_at: string | null;
}

// SQL dates represent local calendar days, not UTC instants.
export function maintenanceStatus(dueAt: string, completedAt: string | null, now = new Date()) {
  if (completedAt) return "completed";
  if (dueAt < format(now, "yyyy-MM-dd")) return "overdue";
  if (dueAt <= format(addDays(now, 30), "yyyy-MM-dd")) return "dueSoon";
  return "upcoming";
}

export function equipmentHasOverdueMaintenance(
  equipment: { id: string; next_check_date: string | null },
  deadlines: MaintenanceDeadline[],
  now = new Date(),
) {
  return (equipment.next_check_date != null && maintenanceStatus(equipment.next_check_date, null, now) === "overdue") ||
    deadlines.some((row) => row.equipment_id === equipment.id && maintenanceStatus(row.due_at, row.completed_at, now) === "overdue");
}
