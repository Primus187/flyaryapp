import { describe, expect, it } from "vitest";
import { firstName, inAirIds, takeoffsToAnnounce } from "./takeoff-announcer";

const flight = (id: string, status: string) => ({ id, status, student_user_id: `student-${id}` });

describe("take-off announcements", () => {
  it("announces nothing on the first look", () => {
    expect(takeoffsToAnnounce(null, [flight("a", "in_air")])).toEqual([]);
  });

  it("announces flights that went into the air since the last look", () => {
    const before = [flight("a", "in_air"), flight("b", "landed")];
    const after = [flight("a", "in_air"), flight("b", "landed"), flight("c", "in_air"), flight("d", "aborted")];
    expect(takeoffsToAnnounce(inAirIds(before), after).map((f) => f.id)).toEqual(["c"]);
  });

  it("does not announce a landing or a flight already in the air", () => {
    const before = inAirIds([flight("a", "in_air")]);
    expect(takeoffsToAnnounce(before, [flight("a", "landed")])).toEqual([]);
    expect(takeoffsToAnnounce(before, [flight("a", "in_air")])).toEqual([]);
  });

  it("calls people by their first name", () => {
    expect(firstName("Sandra Muster")).toBe("Sandra");
    expect(firstName("  Jean-Luc  Picard ")).toBe("Jean-Luc");
    expect(firstName(null)).toBe("");
  });
});
