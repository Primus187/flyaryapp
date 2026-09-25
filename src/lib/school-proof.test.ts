import { describe, expect, it } from "vitest";
import {
  categoryLabel, proofCsv, proofFileName, proofHeaderLines, proofRows, proofTotalLines, swissDate, type SchoolProof,
} from "../../supabase/functions/export-flightbook-pdf/school-proof";

const proof: SchoolProof = {
  school: "Vertical", student: { name: "Anna Müller", shvNumber: "12345" }, from: "2026-05-01", to: "2026-09-25",
  total: 3, practice: 2, altitude: 1, sites: 2, days: 2, selfLogged: 5,
  flights: [
    { date: "2026-05-01", event: "Grundkurs", category: "basic_course", takeoff: "Übungshang Buochs", landing: "Buochs", instructor: "Iris" },
    { date: "2026-05-01", event: "Grundkurs", category: "basic_course", takeoff: "Übungshang Buochs", landing: "Buochs", instructor: "Iris" },
    { date: "2026-09-25", event: "Höhenflüge", category: "height_flight", takeoff: "Niederbauen", landing: "Emmetten; Wiese", instructor: null },
  ],
};

describe("school proof", () => {
  it("formats Swiss dates and category labels", () => {
    expect(swissDate("2026-09-25")).toBe("25.09.2026");
    expect(swissDate(null)).toBe("");
    expect(categoryLabel("basic_course")).toBe("Übungshang");
    expect(categoryLabel("unknown")).toBe("unknown");
  });

  it("lists school, student, period and the totals the SHV asks for", () => {
    expect(proofHeaderLines(proof)).toEqual(["Flugschule: Vertical", "Schüler/in: Anna Müller", "SHV-Nummer: 12345", "Zeitraum: 01.05.2026 – 25.09.2026"]);
    expect(proofTotalLines(proof)).toEqual(["Anzahl Flüge: 3 (Übungshang 2, Höhenflüge 1)", "Anzahl Fluggebiete: 2", "Flugtage: 2"]);
    expect(proofHeaderLines({ ...proof, from: null, to: null, student: null })).toContain("Zeitraum: keine Flüge");
  });

  it("numbers the flights and builds a CSV Excel can open", () => {
    expect(proofRows(proof)[2]).toEqual(["3", "25.09.2026", "Niederbauen", "Emmetten; Wiese", "Höhenflug", ""]);
    const csv = proofCsv(proof);
    expect(csv.startsWith("﻿Nr;Datum;Startplatz;Landeplatz;Art;Fluglehrer/in\r\n")).toBe(true);
    expect(csv).toContain('3;25.09.2026;Niederbauen;"Emmetten; Wiese";Höhenflug;\r\n');
  });

  it("builds a safe file name", () => {
    expect(proofFileName(proof, "pdf")).toBe("ausbildungsnachweis_Anna_Muller.pdf");
  });
});
