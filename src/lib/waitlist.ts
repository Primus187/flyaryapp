/** Pilot sign-ups from the website (migration 0078), shown to Flyary admins. */

export interface WaitlistRow {
  id: string;
  name: string;
  email: string;
  language: string;
  role: string;
  disciplines: string[];
  school: string | null;
  comment: string | null;
  consent_at: string;
  created_at: string;
  updated_at: string;
  handled_at: string | null;
  /** Set when the entry was made in the app's waiting room or a personal link was redeemed (0079). */
  user_id?: string | null;
  invited_at?: string | null;
}

const esc = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const WAITLIST_HEADERS = ["created_at", "name", "email", "language", "role", "disciplines", "school", "comment", "consent_at", "handled_at"];

/** The list as CSV (UTF-8 with BOM for Excel). */
export function waitlistCsv(rows: WaitlistRow[]): string {
  const lines = [WAITLIST_HEADERS.join(",")];
  for (const r of rows) {
    lines.push([r.created_at, r.name, r.email, r.language, r.role, r.disciplines.join(" "), r.school, r.comment, r.consent_at, r.handled_at].map(esc).join(","));
  }
  return "﻿" + lines.join("\n");
}
