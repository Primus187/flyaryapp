import { describe, expect, it } from "vitest";
import { calculateEquipmentQuota } from "./equipment-quota";

function input(count = 3): Parameters<typeof calculateEquipmentQuota>[0] {
  const ids = Array.from({ length: count }, (_, i) => `student-${i}`);
  return {
    signups: ids.map((user_id) => ({ user_id, signed_up: true, status: "confirmed" })),
    members: ids.map((user_id) => ({ user_id, role: "member" })),
    functions: [], attendance: [], equipment: [], assignments: [], eventDate: "2026-09-21",
  };
}
const glider = (id: string, status = "in_stock") => ({ id, status, equipment_type: "glider", shv_type_approved: true });

describe("equipment quota", () => {
  it.each([[0, 0], [1, 1], [2, 2], [3, 2], [4, 3], [6, 4]])("rounds up the quota for %i students to %i", (count, needed) => {
    expect(calculateEquipmentQuota(input(count)).needed).toBe(needed);
  });

  it("excludes waitlisted, withdrawn, non-member and team signups", () => {
    const data = input(6);
    data.signups[0].status = "waitlist";
    data.signups[1].signed_up = false;
    data.members = data.members.filter((row) => row.user_id !== "student-2");
    data.functions = [{ user_id: "student-3", function: "instructor" }, { user_id: "student-4", function: "licensed" }];
    expect(calculateEquipmentQuota(data).students).toBe(1);
  });

  it("counts distinct prior days and excludes students starting their fourth day", () => {
    const data = input(2);
    data.attendance = [
      { user_id: "student-0", event_date: "2026-09-01" },
      { user_id: "student-0", event_date: "2026-09-02" },
      { user_id: "student-0", event_date: "2026-09-03" },
      { user_id: "student-1", event_date: "2026-09-01" },
      { user_id: "student-1", event_date: "2026-09-01" },
      { user_id: "student-1", event_date: "2026-09-02" },
      { user_id: "student-1", event_date: "2026-09-21" },
      { user_id: "student-1", event_date: "2026-09-22" },
    ];
    expect(calculateEquipmentQuota(data).students).toBe(1);
  });

  it("does not inflate stock with accessories, unapproved or unavailable gliders", () => {
    const data = input();
    data.equipment = [glider("ok"), { ...glider("helmet"), equipment_type: "helmet" },
      { ...glider("unapproved"), shv_type_approved: false }, glider("retired", "retired"),
      glider("service", "maintenance"), glider("missing-loan", "assigned")];
    expect(calculateEquipmentQuota(data).available).toBe(1);
  });

  it("counts participant loans once and excludes loans to others even if marked in stock", () => {
    const data = input();
    data.equipment = [glider("mine", "assigned"), glider("other"), glider("returned"), glider("future")];
    data.assignments = [
      { equipment_id: "mine", user_id: "student-0", assigned_on: "2026-09-01", returned_on: null },
      { equipment_id: "mine", user_id: "student-0", assigned_on: "2026-09-02", returned_on: null },
      { equipment_id: "other", user_id: "someone-else", assigned_on: "2026-09-01", returned_on: null },
      { equipment_id: "returned", user_id: "someone-else", assigned_on: "2026-09-01", returned_on: "2026-09-20" },
      { equipment_id: "future", user_id: "someone-else", assigned_on: "2026-09-22", returned_on: null },
    ];
    expect(calculateEquipmentQuota(data).available).toBe(3);
  });
});
