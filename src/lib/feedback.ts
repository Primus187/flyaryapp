/**
 * Feedback from testers (Betriebsbereich step 4, migration 0086): text plus up to three screenshots in the
 * private bucket feedback-screenshots. submit_feedback → upload → finish_feedback; the admins get a push
 * only after finish, so the screenshots are there when they open it.
 */
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";

export const FEEDBACK_BUCKET = "feedback-screenshots";
export const FEEDBACK_KINDS = ["problem", "idea", "question", "praise"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const MAX_SCREENSHOTS = 3;
export const MESSAGE_MAX = 2000;
export const MAX_SCREENSHOT_BYTES = 1024 * 1024;

export interface FeedbackContext { path: string; appVersion: string; userAgent: string }

export function feedbackMessageValid(message: string): boolean {
  const n = message.trim().length;
  return n >= 1 && n <= MESSAGE_MAX;
}

/** Storage path: <user id>/<feedback id>/<index>.webp|jpg (the database only accepts this shape). */
export function screenshotPath(userId: string, feedbackId: string, index: number, mimeType: string): string {
  return `${userId}/${feedbackId}/${index}.${mimeType === "image/jpeg" ? "jpg" : "webp"}`;
}

/** Screenshots to keep when more are picked than allowed: the first ones, up to the limit. */
export function acceptScreenshots(current: File[], picked: File[]): File[] {
  return [...current, ...picked.filter((f) => f.type.startsWith("image/"))].slice(0, MAX_SCREENSHOTS);
}

/** Shrinks until the file fits the bucket limit (1 MB); null when even the small version is too big. */
async function fitScreenshot(file: File): Promise<File | null> {
  for (const [size, quality] of [[1600, 0.82], [1280, 0.7], [960, 0.6]] as const) {
    const small = await compressImage(file, size, size, quality);
    if (small.size <= MAX_SCREENSHOT_BYTES) return small;
  }
  return null;
}

export interface SubmitResult { uploaded: number; failed: number }

export async function submitFeedback(userId: string, kind: FeedbackKind, message: string, files: File[], ctx: FeedbackContext): Promise<SubmitResult> {
  const { data: id, error } = await supabase.rpc("submit_feedback" as never, {
    _kind: kind, _message: message.trim(), _path: ctx.path, _app_version: ctx.appVersion, _user_agent: ctx.userAgent,
  } as never);
  if (error || typeof id !== "string") throw error ?? new Error("submit_feedback failed");

  let uploaded = 0;
  let failed = 0;
  for (const [index, file] of files.slice(0, MAX_SCREENSHOTS).entries()) {
    try {
      const small = await fitScreenshot(file);
      if (!small) { failed++; continue; }
      const { error: uploadError } = await supabase.storage.from(FEEDBACK_BUCKET)
        .upload(screenshotPath(userId, id, index, small.type), small, { contentType: small.type, upsert: false });
      if (uploadError) failed++; else uploaded++;
    } catch {
      failed++;
    }
  }
  // Finish in any case: the feedback text must reach the admins even if a screenshot did not make it.
  const { error: finishError } = await supabase.rpc("finish_feedback" as never, { _id: id } as never);
  if (finishError) throw finishError;
  return { uploaded, failed };
}

/** Fallback by e-mail, with the same context the in-app feedback sends. */
export function feedbackMailto(ctx: FeedbackContext & { mode: string }): string {
  const info = [`Version: ${ctx.appVersion}`, `Modus: ${ctx.mode}`, `Seite: ${ctx.path}`, `Gerät: ${ctx.userAgent}`].join("\n");
  return `mailto:info@flyary.ch?subject=${encodeURIComponent("Flyary Feedback")}&body=${encodeURIComponent(`\n\n---\n${info}\n`)}`;
}

// Admin -------------------------------------------------------------------------------------------------------

export type FeedbackStatus = "new" | "in_progress" | "done";

export interface FeedbackRow {
  id: string;
  kind: FeedbackKind;
  message: string;
  path: string | null;
  app_version: string | null;
  user_agent: string | null;
  screenshot_paths: string[];
  created_at: string;
  status: FeedbackStatus;
  admin_note: string | null;
  handled_at: string | null;
  user_id: string;
  name: string | null;
  email: string | null;
}

export function filterFeedback(rows: FeedbackRow[], status: FeedbackStatus | "open" | "all", kind: FeedbackKind | "all"): FeedbackRow[] {
  return rows.filter((r) => (status === "all" || (status === "open" ? r.status !== "done" : r.status === status))
    && (kind === "all" || r.kind === kind));
}

/** Reply by e-mail, quoting the feedback. */
export function replyMailto(row: Pick<FeedbackRow, "email" | "message" | "created_at">, locale: string): string | null {
  if (!row.email) return null;
  const date = new Date(row.created_at).toLocaleDateString(locale);
  const quote = row.message.split("\n").map((l) => `> ${l}`).join("\n");
  return `mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent("Dein Feedback zu Flyary")}&body=${encodeURIComponent(`\n\n---\n${date}:\n${quote}\n`)}`;
}

export async function fetchFeedbackList(): Promise<FeedbackRow[]> {
  const { data, error } = await supabase.rpc("ops_feedback_list" as never);
  if (error) throw error;
  return (data ?? []) as unknown as FeedbackRow[];
}

export async function setFeedback(id: string, status: FeedbackStatus, note: string): Promise<void> {
  const { error } = await supabase.rpc("ops_set_feedback" as never, { _id: id, _status: status, _note: note } as never);
  if (error) throw error;
}

/** Signed links (one hour) for the screenshots of the visible feedback. */
export async function screenshotUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(FEEDBACK_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) return {};
  return Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]));
}
