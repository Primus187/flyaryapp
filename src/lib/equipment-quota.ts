export interface QuotaSignup {
  user_id: string;
  signed_up: boolean;
  status: string;
}

export function calculateEquipmentQuota({ signups, members, functions, attendance, equipment, assignments, eventDate }: {
  signups: QuotaSignup[];
  members: { user_id: string; role: string }[];
  functions: { user_id: string; function: string }[];
  attendance: { user_id: string; event_date: string }[];
  equipment: { id: string; equipment_type: string; status: string; shv_type_approved: boolean }[];
  assignments: { equipment_id: string; user_id: string; assigned_on: string; returned_on: string | null }[];
  eventDate: string;
}) {
  const day = eventDate.slice(0, 10);
  const studentIds = new Set(signups.filter((signup) => {
    if (!signup.signed_up || signup.status === "waitlist") return false;
    const member = members.find((row) => row.user_id === signup.user_id);
    if (!member) return false;
    const roles = functions.filter((row) => row.user_id === signup.user_id).map((row) => row.function);
    // Preserve the existing student convention for members without assigned functions.
    if (!roles.includes("student") && !(roles.length === 0 && member.role === "member")) return false;
    const previousDays = new Set(attendance.filter((row) => row.user_id === signup.user_id && row.event_date.slice(0, 10) < day)
      .map((row) => row.event_date.slice(0, 10)));
    return previousDays.size < 3;
  }).map((signup) => signup.user_id));

  const available = equipment.filter((item) => {
    if (item.equipment_type !== "glider" || !item.shv_type_approved || !["in_stock", "assigned"].includes(item.status)) return false;
    const loans = assignments.filter((loan) => loan.equipment_id === item.id && loan.assigned_on <= day && (!loan.returned_on || loan.returned_on >= day));
    if (loans.length === 0) return item.status === "in_stock";
    return loans.every((loan) => studentIds.has(loan.user_id));
  }).length;

  return { students: studentIds.size, needed: Math.ceil(studentIds.size * 2 / 3), available };
}
