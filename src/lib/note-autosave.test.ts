import { afterEach, expect, it, vi } from "vitest";
import { NoteAutosave, type NoteDraft } from "./note-autosave";

const note: NoteDraft = { id: "note", note: "First", visible_to_student: false };
afterEach(() => vi.useRealTimers());

it("serializes edits made while a write is pending and flushes the latest value", async () => {
  vi.useFakeTimers();
  const autosave = new NoteAutosave();
  let finish!: () => void;
  const write = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; })).mockResolvedValue(undefined);
  autosave.edit("user:event:student", note, write);
  const pending = autosave.flushPrefix("user:event:");
  await Promise.resolve();
  autosave.edit("user:event:student", { ...note, note: "Latest" }, write);
  expect(write).toHaveBeenCalledTimes(1);
  finish();
  await pending;
  expect(write).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenLastCalledWith({ ...note, note: "Latest" });
  expect(autosave.get("user:event:student")?.savedRevision).toBe(2);
  autosave.release("user:");
});

it("retains failed drafts for retry and does not flush another account", async () => {
  vi.useFakeTimers();
  const autosave = new NoteAutosave();
  const write = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  const otherWrite = vi.fn().mockResolvedValue(undefined);
  autosave.edit("user:event", note, write);
  autosave.edit("other:event", note, otherWrite);
  await autosave.flushPrefix("user:");
  autosave.release("user:");
  expect(autosave.get("user:event")?.error).toBe(true);
  expect(otherWrite).not.toHaveBeenCalled();
  await autosave.flushPrefix("user:");
  expect(autosave.get("user:event")?.error).toBe(false);
  expect(autosave.get("user:event")?.savedRevision).toBe(1);
  await autosave.flushPrefix("other:");
  autosave.release("user:");
  autosave.release("other:");
});
