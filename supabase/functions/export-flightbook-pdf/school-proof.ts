// Training proof of a student for the SHV (Flugtag-Cockpit 6.2), without Deno or jsPDF imports:
// the Edge Function draws it as PDF, the app exports it as CSV, and Vitest tests it.
// Data: RPC school_student_proof (migration 0058).

export interface SchoolProofFlight {
  date: string;
  event: string | null;
  category: string | null;
  takeoff: string | null;
  landing: string | null;
  instructor: string | null;
}

export interface SchoolProof {
  school: string | null;
  student: { name: string | null; shvNumber: string | null } | null;
  from: string | null;
  to: string | null;
  total: number;
  practice: number;
  altitude: number;
  sites: number;
  days: number;
  selfLogged: number;
  flights: SchoolProofFlight[];
}

const CATEGORY_LABELS: Record<string, string> = {
  basic_course: "Übungshang",
  height_flight: "Höhenflug",
  experienced: "Experienced",
  camp_air: "Camp",
  multi_day: "Mehrtägig",
  school_event: "Schulanlass",
  lecture: "Vortrag",
};

/** 2026-09-25 → 25.09.2026 */
export function swissDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export const categoryLabel = (category: string | null) => (category ? CATEGORY_LABELS[category] || category : "");

/** Header lines of the proof (school, student, period). */
export function proofHeaderLines(proof: SchoolProof): string[] {
  return [
    `Flugschule: ${proof.school || ""}`,
    `Schüler/in: ${proof.student?.name || ""}`,
    ...(proof.student?.shvNumber ? [`SHV-Nummer: ${proof.student.shvNumber}`] : []),
    `Zeitraum: ${proof.from ? `${swissDate(proof.from)} – ${swissDate(proof.to)}` : "keine Flüge"}`,
  ];
}

/** Totals required by the SHV: all flights and the number of flying sites. */
export function proofTotalLines(proof: SchoolProof): string[] {
  return [
    `Anzahl Flüge: ${proof.total} (Übungshang ${proof.practice}, Höhenflüge ${proof.altitude})`,
    `Anzahl Fluggebiete: ${proof.sites}`,
    `Flugtage: ${proof.days}`,
  ];
}

export const PROOF_COLUMNS = ["Nr", "Datum", "Startplatz", "Landeplatz", "Art", "Fluglehrer/in"] as const;

/** One row per flight, numbered through. */
export function proofRows(proof: SchoolProof): string[][] {
  return proof.flights.map((f, i) => [
    String(i + 1), swissDate(f.date), f.takeoff || "", f.landing || "", categoryLabel(f.category), f.instructor || "",
  ]);
}

const csvCell = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** CSV for the school's own records (semicolon separated, as Excel in Switzerland expects). */
export function proofCsv(proof: SchoolProof): string {
  const lines = [PROOF_COLUMNS.join(";"), ...proofRows(proof).map((row) => row.map(csvCell).join(";"))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function proofFileName(proof: SchoolProof, extension: "pdf" | "csv"): string {
  const name = (proof.student?.name || "schueler").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `ausbildungsnachweis_${name}.${extension}`;
}
