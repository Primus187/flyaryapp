import { expect, it } from "vitest";
import { trainingFilter, matchesTrainingFilter } from "./training-level";
import { canOpenSchoolSection } from "./school-sections";
import de from "@/i18n/locales/de.json";
import en from "@/i18n/locales/en.json";
import fr from "@/i18n/locales/fr.json";

it("maps stored training stages to the curriculum filters", () => {
  expect(trainingFilter("ground")).toBe("grundkurs");
  expect(trainingFilter("exam_ready")).toBe("brevetkurs");
  expect(trainingFilter("licensed")).toBe("all");
  expect(matchesTrainingFilter("grundkurs,brevetkurs", "brevetkurs")).toBe(true);
  expect(matchesTrainingFilter("siku", "grundkurs")).toBe(false);
  expect(matchesTrainingFilter(null, "grundkurs")).toBe(true);
});

it("allows helpers to access operational team pages only", () => {
  for (const section of [null, "days", "availability", "teamChat"]) expect(canOpenSchoolSection(section, false)).toBe(true);
  for (const section of ["students", "billing", "safety", "people", "unknown"]) expect(canOpenSchoolSection(section, false)).toBe(false);
  expect(canOpenSchoolSection("students", true)).toBe(true);
});

it("provides the same journey messages in all supported languages", () => {
  expect(Object.keys(en.journeys).sort()).toEqual(Object.keys(de.journeys).sort());
  expect(Object.keys(fr.journeys).sort()).toEqual(Object.keys(de.journeys).sort());
});
