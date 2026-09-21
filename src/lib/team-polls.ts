export interface PollResponse {
  userId: string;
  response: string;
}

export function isPollClosed(closesAt: string | null, now: Date = new Date()): boolean {
  if (!closesAt) return false;
  return new Date(closesAt).getTime() <= now.getTime();
}

/** Counts responses per option, preserving the poll's option order; unknown responses are ignored. */
export function countResponsesByOption(options: string[], responses: PollResponse[]): Record<string, number> {
  const counts: Record<string, number> = {};
  options.forEach((o) => { counts[o] = 0; });
  responses.forEach((r) => {
    if (r.response in counts) counts[r.response] += 1;
  });
  return counts;
}

export function findOwnResponse(responses: PollResponse[], userId: string): string | null {
  return responses.find((r) => r.userId === userId)?.response ?? null;
}

export function parseOptionsInput(raw: string): string[] {
  const options = raw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return [...new Set(options)];
}
