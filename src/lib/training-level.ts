export type TrainingFilter = "grundkurs" | "brevetkurs" | "siku" | "all";

/** School stages and curriculum course categories are different vocabularies. */
export function trainingFilter(level: string | null | undefined): TrainingFilter {
  switch (level) {
    case "ground": case "grundkurs": return "grundkurs";
    case "altitude": case "exam_ready": case "brevetkurs": return "brevetkurs";
    case "siku": return "siku";
    default: return "all";
  }
}

export function matchesTrainingFilter(categoryLevel: string | null, filter: TrainingFilter) {
  if (filter === "all" || !categoryLevel) return true;
  return categoryLevel.split(/[,;\s]+/).some(level => trainingFilter(level) === filter);
}
