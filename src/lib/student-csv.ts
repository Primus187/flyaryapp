export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface StudentCsvRow {
  pilotName: string;
  trainingLevel: string | null;
  flightCount: number;
  examProgress: number;
  lastSummary: string | null;
  statusLabel: string;
  statusReason: string | null | undefined;
  statusDateLabel: string;
}

/** Builds a UTF-8 BOM-prefixed CSV string (Excel-friendly) from the given headers and rows. */
export function buildStudentCsv(headers: string[], rows: StudentCsvRow[]): string {
  const dataRows = rows.map((r) =>
    [
      csvEscape(r.pilotName),
      csvEscape(r.trainingLevel),
      csvEscape(r.flightCount),
      csvEscape(`${r.examProgress}%`),
      csvEscape(r.lastSummary),
      csvEscape(r.statusLabel),
      csvEscape(r.statusReason),
      csvEscape(r.statusDateLabel),
    ].join(","),
  );
  return "﻿" + [headers.map(csvEscape).join(","), ...dataRows].join("\n");
}
