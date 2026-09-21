import { describe, expect, it } from "vitest";
import { equipmentHasOverdueMaintenance, maintenanceStatus } from "./equipment-maintenance";

const now = new Date(2026, 8, 21, 23, 59);

describe("maintenance calendar deadlines", () => {
  it("keeps today's checks due, not overdue", () => {
    expect(maintenanceStatus("2026-09-21", null, now)).toBe("dueSoon");
    expect(maintenanceStatus("2026-09-20", null, now)).toBe("overdue");
  });
  it("includes the thirtieth calendar day only", () => {
    expect(maintenanceStatus("2026-10-21", null, now)).toBe("dueSoon");
    expect(maintenanceStatus("2026-10-22", null, now)).toBe("upcoming");
  });
  it("ignores completed checks and other equipment", () => {
    expect(equipmentHasOverdueMaintenance({ id: "a", next_check_date: null }, [
      { equipment_id: "a", due_at: "2026-01-01", completed_at: "2026-01-02" },
      { equipment_id: "b", due_at: "2026-01-01", completed_at: null },
    ], now)).toBe(false);
  });
  it("warns for either a legacy check or an open maintenance deadline", () => {
    expect(equipmentHasOverdueMaintenance({ id: "a", next_check_date: "2026-09-20" }, [], now)).toBe(true);
    expect(equipmentHasOverdueMaintenance({ id: "a", next_check_date: null }, [
      { equipment_id: "a", due_at: "2026-09-20", completed_at: null },
    ], now)).toBe(true);
  });
});
