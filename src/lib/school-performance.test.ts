import { describe, expect, it } from "vitest";
import {
  averageTrainingDurationDays,
  studentsPerInstructor,
  successRate,
  utilizationByCategory,
} from "./school-performance";

describe("utilizationByCategory", () => {
  it("averages signup/capacity ratio per category", () => {
    const result = utilizationByCategory([
      { eventId: "1", category: "basic_course", maxParticipants: 10, confirmedSignups: 5 },
      { eventId: "2", category: "basic_course", maxParticipants: 10, confirmedSignups: 10 },
      { eventId: "3", category: "height_flight", maxParticipants: 4, confirmedSignups: 2 },
    ]);
    expect(result).toEqual({ basic_course: 75, height_flight: 50 });
  });

  it("ignores events without a set capacity", () => {
    const result = utilizationByCategory([{ eventId: "1", category: "height_flight", maxParticipants: null, confirmedSignups: 3 }]);
    expect(result).toEqual({});
  });

  it("caps a category's ratio at 100% even with overbooking", () => {
    const result = utilizationByCategory([{ eventId: "1", category: "basic_course", maxParticipants: 5, confirmedSignups: 8 }]);
    expect(result).toEqual({ basic_course: 100 });
  });
});

describe("studentsPerInstructor", () => {
  it("counts distinct students across an instructor's assigned events", () => {
    const result = studentsPerInstructor(
      [{ eventId: "e1", userId: "instructor-a" }, { eventId: "e2", userId: "instructor-a" }],
      [
        { eventId: "e1", userId: "s1" },
        { eventId: "e1", userId: "s2" },
        { eventId: "e2", userId: "s1" },
      ],
    );
    expect(result).toEqual({ "instructor-a": 2 });
  });

  it("returns an empty result for an instructor with no signups on their events", () => {
    const result = studentsPerInstructor([{ eventId: "e1", userId: "instructor-a" }], []);
    expect(result).toEqual({ "instructor-a": 0 });
  });
});

describe("successRate", () => {
  const history = [
    { user_id: "s1", training_level: "ground", changed_at: "2024-01-01" },
    { user_id: "s1", training_level: "licensed", changed_at: "2025-01-01" },
    { user_id: "s2", training_level: "ground", changed_at: "2024-01-01" },
    { user_id: "s3", training_level: "ground", changed_at: "2024-01-01" },
  ];

  it("excludes cancelled students from the denominator entirely", () => {
    const result = successRate(["s1", "s2", "s3"], history, { s3: "cancelled" });
    expect(result).toEqual({ consideredCount: 2, licensedCount: 1, cancelledCount: 1, rate: 50 });
  });

  it("ignores students with no recorded history at all", () => {
    const result = successRate(["s1", "s4"], history, {});
    expect(result.consideredCount).toBe(1);
  });

  it("returns a null rate when nobody qualifies", () => {
    const result = successRate(["s3"], history, { s3: "cancelled" });
    expect(result).toEqual({ consideredCount: 0, licensedCount: 0, cancelledCount: 1, rate: null });
  });
});

describe("averageTrainingDurationDays", () => {
  it("averages days from a student's earliest entry to their licensed entry", () => {
    const result = averageTrainingDurationDays([
      { user_id: "s1", training_level: "ground", changed_at: "2024-01-01T00:00:00Z" },
      { user_id: "s1", training_level: "licensed", changed_at: "2024-04-01T00:00:00Z" },
      { user_id: "s2", training_level: "ground", changed_at: "2024-01-01T00:00:00Z" },
      { user_id: "s2", training_level: "licensed", changed_at: "2024-07-01T00:00:00Z" },
    ]);
    expect(result).toBeGreaterThan(0);
  });

  it("returns null when nobody has reached licensed yet", () => {
    const result = averageTrainingDurationDays([{ user_id: "s1", training_level: "ground", changed_at: "2024-01-01T00:00:00Z" }]);
    expect(result).toBeNull();
  });

  it("ignores students not yet licensed while still averaging those who are", () => {
    const result = averageTrainingDurationDays([
      { user_id: "s1", training_level: "ground", changed_at: "2024-01-01T00:00:00Z" },
      { user_id: "s1", training_level: "licensed", changed_at: "2024-01-11T00:00:00Z" },
      { user_id: "s2", training_level: "ground", changed_at: "2024-01-01T00:00:00Z" },
    ]);
    expect(result).toBe(10);
  });
});
