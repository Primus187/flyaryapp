export interface NoteDraft {
  id: string;
  note: string;
  visible_to_student: boolean;
  is_next_step?: boolean;
}

interface Entry {
  value: NoteDraft;
  revision: number;
  savedRevision: number;
  saving: boolean;
  error: boolean;
  timer?: ReturnType<typeof setTimeout>;
  pending?: Promise<void>;
  write: (value: NoteDraft) => Promise<void>;
}

/** Serializes writes per note, survives route changes, and keeps failed drafts in memory.
 * No student notes are persisted to browser storage. Keys include the signed-in user.
 */
export class NoteAutosave {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private beforeUnload = (event: BeforeUnloadEvent) => {
    if ([...this.entries.values()].some(e => e.revision !== e.savedRevision)) {
      event.preventDefault();
      event.returnValue = "";
    }
  };

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  get(key: string) { return this.entries.get(key); }

  private emit() {
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.beforeUnload);
      if ([...this.entries.values()].some(e => e.revision !== e.savedRevision)) {
        window.addEventListener("beforeunload", this.beforeUnload);
      }
    }
    this.listeners.forEach(listener => listener());
  }

  edit(key: string, value: NoteDraft, write: Entry["write"]) {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { value, revision: 0, savedRevision: 0, saving: false, error: false, write };
      this.entries.set(key, entry);
    }
    entry.value = value;
    entry.write = write;
    entry.revision++;
    entry.error = false;
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => void this.flush(key), 800);
    this.emit();
  }

  async flush(key: string): Promise<void> {
    const entry = this.entries.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    if (entry.pending) return entry.pending;
    if (entry.revision === entry.savedRevision) return;
    // Assign the promise before starting work, so synchronous subscribers cannot overlap it.
    entry.pending = Promise.resolve().then(async () => {
      entry.saving = true;
      entry.error = false;
      this.emit();
      try {
        while (entry.savedRevision !== entry.revision) {
          const revision = entry.revision;
          await entry.write({ ...entry.value });
          entry.savedRevision = revision;
        }
      } catch {
        entry.error = true;
      } finally {
        entry.saving = false;
        entry.pending = undefined;
        this.emit();
      }
    });
    return entry.pending;
  }

  async flushPrefix(prefix: string) {
    await Promise.all([...this.entries.keys()].filter(key => key.startsWith(prefix)).map(key => this.flush(key)));
  }

  /** Forget only confirmed writes; failed or pending drafts remain recoverable. */
  release(prefix: string) {
    for (const [key, entry] of this.entries) {
      if (key.startsWith(prefix) && !entry.pending && entry.revision === entry.savedRevision) this.entries.delete(key);
    }
    this.emit();
  }
}

export const coachNoteAutosave = new NoteAutosave();
