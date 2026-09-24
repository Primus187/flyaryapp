export function canOpenSchoolSection(section: string | null, canManage: boolean, canShop = false) {
  // The shop (marketplace 4.7) belongs to admins, school leads and the shop team, not to every instructor.
  if (section === "shop") return canShop;
  return canManage || section === null || ["days", "communication", "teamChat", "availability"].includes(section);
}
