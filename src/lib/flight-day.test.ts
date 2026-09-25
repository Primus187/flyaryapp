import { describe, expect, it } from "vitest";
import { dayParticipants, nextPresenceOnTap, opensOnFlightDay, presenceSummary } from "./flight-day";

const names = { a: "Anna", b: "Beat", c: "Carla", d: "Dario", e: "Eva" };

describe("dayParticipants", () => {
  it("orders on site, paused, not yet checked in, absent; alphabetical within", () => {
    const list = dayParticipants(
      [
        { user_id: "e", presence: "absent" },
        { user_id: "d", presence: "expected" },
        { user_id: "c", presence: "present" },
        { user_id: "b", presence: "present" },
        { user_id: "a", presence: null },
      ],
      names,
      [{ student_user_id: "b", reason: "injury", note: "Knie" }],
    );
    expect(list.map((p) => p.name)).toEqual(["Carla", "Beat", "Anna", "Dario", "Eva"]);
    expect(list[1].pause?.reason).toBe("injury");
    expect(list[2].presence).toBe("expected");
  });
});

describe("presenceSummary", () => {
  it("counts presence and pauses", () => {
    const list = dayParticipants(
      [{ user_id: "a", presence: "present" }, { user_id: "b", presence: "absent" }, { user_id: "c" }],
      names,
      [{ student_user_id: "a", reason: "material", note: null }],
    );
    expect(presenceSummary(list)).toEqual({ present: 1, absent: 1, expected: 1, paused: 1, total: 3 });
  });
});

describe("nextPresenceOnTap", () => {
  it("checks in on tap and undoes a second tap", () => {
    expect(nextPresenceOnTap("expected")).toBe("present");
    expect(nextPresenceOnTap("absent")).toBe("present");
    expect(nextPresenceOnTap("present")).toBe("expected");
  });
});

describe("opensOnFlightDay", () => {
  const now = new Date(2026, 8, 26, 7, 30);
  it("opens for the team on the local day of the event only", () => {
    expect(opensOnFlightDay(new Date(2026, 8, 26, 9, 0).toISOString(), now, "helper")).toBe(true);
    expect(opensOnFlightDay(new Date(2026, 8, 25, 9, 0).toISOString(), now, "instructor")).toBe(false);
    expect(opensOnFlightDay(new Date(2026, 8, 26, 9, 0).toISOString(), now, null)).toBe(false);
  });
});
