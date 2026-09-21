import { describe, expect, it } from "vitest";
import { buildStudentCsv, csvEscape } from "./student-csv";

describe("csvEscape", () => {
  it("passes plain values through unchanged", () => {
    expect(csvEscape("Alex")).toBe("Alex");
    expect(csvEscape(42)).toBe("42");
  });

  it("returns an empty string for null or undefined", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("quotes and escapes values containing commas, quotes, newlines or semicolons", () => {
    expect(csvEscape('Say "hi", please')).toBe('"Say ""hi"", please"');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape("a;b")).toBe('"a;b"');
  });
});

describe("buildStudentCsv", () => {
  const headers = ["Name", "Level", "Flights", "Progress", "Summary", "Status", "Reason", "Since"];

  it("includes a UTF-8 BOM so Excel opens accented characters correctly", () => {
    const csv = buildStudentCsv(headers, []);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("renders one row per student with all columns, including status/reason/date", () => {
    const csv = buildStudentCsv(headers, [
      {
        pilotName: "Alex Müller",
        trainingLevel: "grundkurs",
        flightCount: 5,
        examProgress: 80,
        lastSummary: "Guter Tag",
        statusLabel: "Pausiert",
        statusReason: "Verletzung",
        statusDateLabel: "01.06.2026",
      },
    ]);
    const lines = csv.slice(1).split("\n");
    expect(lines[0]).toBe(headers.join(","));
    expect(lines[1]).toBe("Alex Müller,grundkurs,5,80%,Guter Tag,Pausiert,Verletzung,01.06.2026");
  });

  it("leaves reason and status date blank for active students without a recorded change", () => {
    const csv = buildStudentCsv(headers, [
      {
        pilotName: "Bina",
        trainingLevel: null,
        flightCount: 0,
        examProgress: 0,
        lastSummary: null,
        statusLabel: "Aktiv",
        statusReason: null,
        statusDateLabel: "",
      },
    ]);
    const lines = csv.slice(1).split("\n");
    expect(lines[1]).toBe("Bina,,0,0%,,Aktiv,,");
  });
});
