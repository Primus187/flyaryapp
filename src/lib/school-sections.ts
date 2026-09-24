export function canOpenSchoolSection(section: string | null, canManage: boolean) {
  return canManage || section === null || ["days", "communication", "teamChat", "availability"].includes(section);
}
