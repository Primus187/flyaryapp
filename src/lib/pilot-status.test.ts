import { describe, expect, it } from "vitest";
import {
  availableGoals, categoryInLevel, categoryLevels, holdsTandemLicence, kontrollblattLevel, licenceHeld,
  normalizeTrainingLevel, pilotStatus, selfDeclaredPilots, showsSoloField, showsTandemField, statusLabelKeys,
} from "./pilot-status";

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

describe("Kontrollblatt stages", () => {
  it("matches categories by stage, also with lists and the older words", () => {
    expect(categoryLevels("grundkurs,brevetkurs")).toEqual(["ground", "altitude"]);
    expect(categoryInLevel("grundkurs,brevetkurs", "altitude")).toBe(true);
    expect(categoryInLevel("siku", "ground")).toBe(false);
    expect(categoryInLevel("siku", "licensed")).toBe(true);
    expect(categoryInLevel(null, "ground")).toBe(true);
    expect(categoryInLevel("exam_ready", "all")).toBe(true);
  });

  it("opens the stage of a student and the pilot part for a pilot", () => {
    expect(kontrollblattLevel(pilotStatus({ trainingLevel: "altitude" }))).toBe("altitude");
    expect(kontrollblattLevel(pilotStatus({ trainingLevel: null, schoolStudent: true }))).toBe("ground");
    expect(kontrollblattLevel(pilotStatus({ trainingLevel: "licensed" }))).toBe("licensed");
    expect(kontrollblattLevel(pilotStatus({ trainingLevel: null }))).toBeNull();
    expect(kontrollblattLevel(null)).toBeNull();
  });
});

describe("licenceHeld", () => {
  it("knows the pilot licence from the status, with the date if a licence is recorded", () => {
    expect(licenceHeld(pilotStatus({ trainingLevel: "altitude" }), "pilot")).toEqual({ held: false, issuedAt: null });
    expect(licenceHeld(pilotStatus({ trainingLevel: "licensed" }), "pilot")).toEqual({ held: true, issuedAt: null });
    expect(licenceHeld(pilotStatus({ trainingLevel: "licensed", licences: [licence("pilot")] }), "pilot")).toEqual({ held: true, issuedAt: "2025-06-01" });
  });

  it("prefers the date of the chosen discipline", () => {
    const status = pilotStatus({ trainingLevel: "licensed", licences: [licence("pilot"), { discipline: "hangglider", level: "pilot", issued_at: "2020-01-01" }] });
    expect(licenceHeld(status, "pilot", "hangglider").issuedAt).toBe("2020-01-01");
    expect(licenceHeld(status, "pilot", "paraglider").issuedAt).toBe("2025-06-01");
  });

  it("counts a higher tandem stage for stage 1, never a renewal", () => {
    const status = pilotStatus({ trainingLevel: "licensed", licences: [licence("pilot"), licence("biplace_2")] });
    expect(licenceHeld(status, "biplace_1")).toEqual({ held: true, issuedAt: null });
    expect(licenceHeld(status, "biplace_3").held).toBe(false);
    expect(licenceHeld(pilotStatus({ trainingLevel: "licensed", licences: [licence("biplace_3")] }), "biplace_3_renewal").held).toBe(false);
  });
});

describe("flight form fields", () => {
  it("offers the SHV solo flight only before the pilot licence", () => {
    expect(showsSoloField(pilotStatus({ trainingLevel: "altitude" }), false)).toBe(true);
    expect(showsSoloField(pilotStatus({ trainingLevel: null }), false)).toBe(true);
    expect(showsSoloField(pilotStatus({ trainingLevel: "licensed" }), false)).toBe(false);
    expect(showsSoloField(pilotStatus({ trainingLevel: "licensed" }), true)).toBe(true);
    expect(showsSoloField(null, false)).toBe(false);
  });

  it("offers tandem fields with a tandem licence, goal or glider", () => {
    const none = { marked: false, tandemGlider: false };
    expect(showsTandemField(pilotStatus({ trainingLevel: "licensed" }), none)).toBe(false);
    expect(showsTandemField(pilotStatus({ trainingLevel: "licensed", goal: "biplace_1" }), none)).toBe(true);
    expect(showsTandemField(pilotStatus({ trainingLevel: "licensed", licences: [licence("biplace_1")] }), none)).toBe(true);
    expect(showsTandemField(pilotStatus({ trainingLevel: "ground" }), none)).toBe(false);
    expect(showsTandemField(pilotStatus({ trainingLevel: "ground" }), { marked: false, tandemGlider: true })).toBe(true);
    expect(showsTandemField(null, { marked: true, tandemGlider: false })).toBe(true);
  });
});

describe("selfDeclaredPilots", () => {
  it("marks members whose latest licensed entry is their own", () => {
    const entry = (user_id: string, changed_by: string, changed_at: string, training_level = "licensed") => ({ user_id, changed_by, changed_at, training_level });
    const result = selfDeclaredPilots([
      entry("sam", "sam", "2026-10-01T10:00:00Z"),
      entry("kim", "kim", "2026-09-01T10:00:00Z"), entry("kim", "teacher", "2026-10-02T10:00:00Z"),
      entry("lea", "teacher", "2026-08-01T10:00:00Z"),
      entry("noa", "noa", "2026-08-01T10:00:00Z", "altitude"),
    ]);
    expect([...result]).toEqual(["sam"]);
  });
});
