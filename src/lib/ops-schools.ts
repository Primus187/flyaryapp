/**
 * Betriebsbereich "Schulen" (migration 0085): set up schools without becoming a member and hand them over
 * to the school lead with a single-use link (/welcome/lead/<token>).
 */
import { supabase } from "@/integrations/supabase/client";

export interface SchoolRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  members: number;
  team: number;
  admins: string[];
  i_am_member: boolean;
  other_admins: number;
  open_invite: { email: string; language: string; created_at: string; expires_at: string } | null;
  last_flight_at: string | null;
}

export const LEAD_LANGUAGES = ["de", "fr", "en"] as const;
export type LeadLanguage = (typeof LEAD_LANGUAGES)[number];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Same limits as ops_create_school: name 2–100 characters, a plausible e-mail address. */
export function schoolFormValid(name: string, email: string): boolean {
  const n = name.trim().length;
  const e = email.trim();
  return n >= 2 && n <= 100 && e.length <= 200 && EMAIL.test(e);
}

export const leadInviteLink = (origin: string, token: string) => `${origin}/welcome/lead/${token}`;

/** What the admin should do next for a school. */
export type SchoolState = "needs_lead" | "invited" | "handed_over" | "admin_still_member";

export function schoolState(s: Pick<SchoolRow, "admins" | "i_am_member" | "other_admins" | "open_invite">): SchoolState {
  if (s.i_am_member && s.other_admins > 0) return "admin_still_member";
  if (s.open_invite) return "invited";
  if (s.i_am_member || s.admins.length === 0) return "needs_lead";
  return "handed_over";
}

const MAIL: Record<LeadLanguage, { subject: (school: string) => string; body: (school: string, link: string) => string }> = {
  de: {
    subject: (school) => `${school} auf Flyary`,
    body: (school, link) => `Hallo\n\nich habe ${school} auf Flyary eingerichtet. Mit diesem persönlichen Link übernimmst du die Leitung der Schule in der App:\n\n${link}\n\nÖffne ihn und melde dich mit deinem Google-Konto an. Der Link gilt 14 Tage und nur einmal. Danach lädst du Team und Schüler über den Einladungslink der Schule ein.\n\nGuten Flug\nTobias`,
  },
  fr: {
    subject: (school) => `${school} sur Flyary`,
    body: (school, link) => `Bonjour\n\nJ’ai configuré ${school} sur Flyary. Ce lien personnel vous permet de reprendre la direction de l’école dans l’application :\n\n${link}\n\nOuvrez-le et connectez-vous avec votre compte Google. Le lien est valable 14 jours et une seule fois. Ensuite, invitez l’équipe et les élèves avec le lien d’invitation de l’école.\n\nBons vols\nTobias`,
  },
  en: {
    subject: (school) => `${school} on Flyary`,
    body: (school, link) => `Hi\n\nI have set up ${school} on Flyary. This personal link makes you the lead of the school in the app:\n\n${link}\n\nOpen it and sign in with your Google account. The link is valid for 14 days and works once. Then invite your team and students with the school's invite link.\n\nHappy flying\nTobias`,
  },
};

/** Prepared e-mail to the school lead, in the chosen language. */
export function leadInviteMailto(email: string, school: string, language: string, link: string): string {
  const mail = MAIL[(LEAD_LANGUAGES as readonly string[]).includes(language) ? language as LeadLanguage : "de"];
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(mail.subject(school))}&body=${encodeURIComponent(mail.body(school, link))}`;
}

export async function fetchSchools(): Promise<SchoolRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet (migration 0085)
  const { data, error } = await supabase.rpc("ops_school_list" as any);
  if (error) throw error;
  return (data ?? []) as unknown as SchoolRow[];
}

export async function createSchool(name: string, description: string, email: string, language: LeadLanguage): Promise<{ group_id: string; token: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet (migration 0085)
  const { data, error } = await supabase.rpc("ops_create_school" as any, { _name: name.trim(), _description: description.trim() || null, _lead_email: email.trim(), _language: language } as any);
  if (error) throw error;
  return data as unknown as { group_id: string; token: string };
}

export async function createLeadInvite(groupId: string, email: string, language: LeadLanguage): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet (migration 0085)
  const { data, error } = await supabase.rpc("ops_create_lead_invite" as any, { _group_id: groupId, _email: email.trim(), _language: language } as any);
  if (error) throw error;
  return data as unknown as string;
}

export async function revokeLeadInvite(groupId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet (migration 0085)
  const { error } = await supabase.rpc("ops_revoke_lead_invite" as any, { _group_id: groupId } as any);
  if (error) throw error;
}

export async function leaveSchool(groupId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types.ts yet (migration 0085)
  const { error } = await supabase.rpc("ops_leave_school" as any, { _group_id: groupId } as any);
  if (error) throw error;
}
