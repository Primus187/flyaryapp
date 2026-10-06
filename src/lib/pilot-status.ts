/**
 * Ausbildungsstand along the SHV (migration 0089): a user is a student (before the pilot licence)
 * or a pilot. profiles.training_level is the one status field; further licences are rows in
 * pilot_licences and profiles.licence_goal is the licence a pilot is working towards.
 */

export const STUDENT_PHASES = ["ground", "altitude", "exam_ready"] as const;
export type StudentPhase = (typeof STUDENT_PHASES)[number];
export type TrainingLevel = StudentPhase | "licensed";
export const TRAINING_LEVELS: TrainingLevel[] = [...STUDENT_PHASES, "licensed"];

/** Licences a pilot can work towards: those with requirements in training_requirements. */
export const LICENCE_GOALS = ["biplace_1", "biplace_3", "biplace_3_renewal"] as const;
export type LicenceGoal = (typeof LICENCE_GOALS)[number];

export interface HeldLicence { discipline: string; level: string; issued_at: string }

/** Same translation of the older vocabulary as normalize_training_level() in the database. */
export function normalizeTrainingLevel(level: string | null | undefined): TrainingLevel | null {
  switch ((level ?? "").trim().toLowerCase()) {
    case "ground": case "grundkurs": return "ground";
    case "altitude": case "brevetkurs": return "altitude";
    case "exam_ready": return "exam_ready";
    case "licensed": case "pilot": case "siku": return "licensed";
    default: return null;
  }
}

export interface PilotStatus {
  /** unknown: not answered yet (the app asks once). */
  kind: "student" | "pilot" | "unknown";
  /** Stage of a student; null while the school has not set one. */
  phase: StudentPhase | null;
  licences: HeldLicence[];
  goal: LicenceGoal | null;
  /** The licence the training status and the Start page show progress for. */
  target: "pilot" | LicenceGoal | null;
}

export function pilotStatus(input: {
  trainingLevel: string | null | undefined;
  licences?: HeldLicence[];
  goal?: string | null;
  /** Student of a flight school: a student even before the school has set a stage. */
  schoolStudent?: boolean;
}): PilotStatus {
  const level = normalizeTrainingLevel(input.trainingLevel);
  const licences = input.licences ?? [];
  // A licence makes its holder a pilot (the database keeps the level in step, this covers the gap).
  if (level === "licensed" || licences.length > 0) {
    const goal = availableGoals(licences).find((g) => g === input.goal) ?? null;
    return { kind: "pilot", phase: null, licences, goal, target: goal };
  }
  if (level === null && !input.schoolStudent) return { kind: "unknown", phase: null, licences, goal: null, target: null };
  return { kind: "student", phase: level, licences, goal: null, target: "pilot" };
}

/** Goals that still make sense: no stage already held, the renewal only with stage 3. */
export function availableGoals(licences: Pick<HeldLicence, "level">[]): LicenceGoal[] {
  const held = new Set(licences.map((l) => l.level));
  const hasTandem = held.has("biplace_1") || held.has("biplace_2") || held.has("biplace_3");
  const goals: LicenceGoal[] = [];
  if (!hasTandem) goals.push("biplace_1");
  if (held.has("biplace_3")) goals.push("biplace_3_renewal");
  else goals.push("biplace_3");
  return goals;
}

export function holdsTandemLicence(licences: Pick<HeldLicence, "level">[]): boolean {
  return licences.some((l) => l.level.startsWith("biplace_"));
}

/** Translation keys of the status line, joined by the caller: "Schüler · Höhenflüge", "Pilot". */
export function statusLabelKeys(status: Pick<PilotStatus, "kind" | "phase">): string[] {
  if (status.kind === "pilot") return ["pilotStatus.pilot"];
  if (status.kind === "unknown") return ["pilotStatus.unknown"];
  return status.phase ? ["pilotStatus.student", `pilotStatus.level.${status.phase}`] : ["pilotStatus.student"];
}

/** Stages a Kontrollblatt category belongs to; none means every stage. Understands lists and the older words. */
export function categoryLevels(categoryLevel: string | null | undefined): TrainingLevel[] {
  const levels = (categoryLevel ?? "").split(/[,;\s]+/).map(normalizeTrainingLevel).filter((l): l is TrainingLevel => l !== null);
  return [...new Set(levels)];
}

export function categoryInLevel(categoryLevel: string | null | undefined, level: TrainingLevel | "all"): boolean {
  const levels = categoryLevels(categoryLevel);
  return level === "all" || levels.length === 0 || levels.includes(level);
}

/** The part of the Kontrollblatt that is open: the stage of a student, the pilot part for a pilot. */
export function kontrollblattLevel(status: Pick<PilotStatus, "kind" | "phase"> | null | undefined): TrainingLevel | null {
  if (!status || status.kind === "unknown") return null;
  return status.kind === "pilot" ? "licensed" : status.phase ?? "ground";
}

/**
 * Is the licence already reached? The status is per person, not per discipline (decision 2026-10-06);
 * the date comes from the licence of the discipline if there is one. A renewal is never "reached".
 */
export function licenceHeld(status: Pick<PilotStatus, "kind" | "licences"> | null | undefined, licence: string, discipline?: string): { held: boolean; issuedAt: string | null } {
  if (!status) return { held: false, issuedAt: null };
  const rows = [...status.licences].sort((a, b) => Number(b.discipline === discipline) - Number(a.discipline === discipline));
  const issued = (level: string) => rows.find((l) => l.level === level)?.issued_at ?? null;
  if (licence === "pilot") return { held: status.kind === "pilot", issuedAt: issued("pilot") };
  if (licence === "biplace_1") return { held: holdsTandemLicence(rows), issuedAt: issued("biplace_1") };
  if (licence === "biplace_3") return { held: rows.some((l) => l.level === "biplace_3"), issuedAt: issued("biplace_3") };
  return { held: false, issuedAt: null };
}
