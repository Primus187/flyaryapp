import { describe, expect, it } from "vitest";
import { availableGoals, holdsTandemLicence, normalizeTrainingLevel, pilotStatus, statusLabelKeys } from "./pilot-status";

const licence = (level: string) => ({ discipline: "paraglider", level, issued_at: "2025-06-01" });

describe("normalizeTrainingLevel", () => {
  it("translates both older vocabularies", () => {
    expect(normalizeTrainingLevel("grundkurs")).toBe("ground");
    expect(normalizeTrainingLevel("brevetkurs")).toBe("altitude");
    expect(normalizeTrainingLevel("exam_ready")).toBe("exam_ready");
    expect(normalizeTrainingLevel(" Pilot ")).toBe("licensed");
    expect(normalizeTrainingLevel("siku")).toBe("licensed");
    expect(normalizeTrainingLevel("")).toBeNull();
    expect(normalizeTrainingLevel(null)).toBeNull();
    expect(normalizeTrainingLevel("expert")).toBeNull();
  });
});

describe("pilotStatus", () => {
  it("is a student before the pilot licence, working towards it", () => {
    const status = pilotStatus({ trainingLevel: "altitude", goal: "biplace_1" });
    expect(status).toMatchObject({ kind: "student", phase: "altitude", goal: null, target: "pilot" });
    expect(statusLabelKeys(status)).toEqual(["pilotStatus.student", "pilotStatus.level.altitude"]);
  });

  it("is unknown without a level, but a student in a school", () => {
    expect(pilotStatus({ trainingLevel: null }).kind).toBe("unknown");
    const status = pilotStatus({ trainingLevel: null, schoolStudent: true });
    expect(status).toMatchObject({ kind: "student", phase: null, target: "pilot" });
    expect(statusLabelKeys(status)).toEqual(["pilotStatus.student"]);
  });

  it("is a pilot once licensed, with the chosen goal as target", () => {
    expect(pilotStatus({ trainingLevel: "licensed" })).toMatchObject({ kind: "pilot", goal: null, target: null });
    expect(statusLabelKeys(pilotStatus({ trainingLevel: "licensed" }))).toEqual(["pilotStatus.pilot"]);
    expect(pilotStatus({ trainingLevel: "licensed", goal: "biplace_1" })).toMatchObject({ kind: "pilot", target: "biplace_1" });
  });

  it("treats the holder of a licence as pilot even if the level lags behind", () => {
    expect(pilotStatus({ trainingLevel: "exam_ready", licences: [licence("pilot")] }).kind).toBe("pilot");
  });

  it("drops a goal that is already reached", () => {
    const status = pilotStatus({ trainingLevel: "licensed", licences: [licence("pilot"), licence("biplace_1")], goal: "biplace_1" });
    expect(status.goal).toBeNull();
  });
});

describe("availableGoals", () => {
  it("offers stage 1 and 3 to a pilot without a tandem licence", () => {
    expect(availableGoals([licence("pilot")])).toEqual(["biplace_1", "biplace_3"]);
  });
  it("offers only stage 3 with a lower stage", () => {
    expect(availableGoals([licence("biplace_2")])).toEqual(["biplace_3"]);
  });
  it("offers the renewal with stage 3", () => {
    expect(availableGoals([licence("biplace_3")])).toEqual(["biplace_3_renewal"]);
  });
});

describe("holdsTandemLicence", () => {
  it("is true for any tandem stage", () => {
    expect(holdsTandemLicence([licence("pilot")])).toBe(false);
    expect(holdsTandemLicence([licence("pilot"), licence("biplace_1")])).toBe(true);
  });
});
