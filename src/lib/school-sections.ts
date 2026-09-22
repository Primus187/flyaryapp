export function canOpenSchoolSection(section: string | null, canManage: boolean) {
  return canManage || section === null || ["days", "teamChat", "availability"].includes(section);
}
