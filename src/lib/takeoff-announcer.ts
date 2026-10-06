/**
 * Flying day: a clear signal and a spoken "Sandra gestartet" on every device that has the flying
 * day open when someone takes off: the launch helper taps "Start" and hears it as a confirmation,
 * the landing field hears it as news.
 * Sound only works while the app is open in the foreground; browsers allow it after the first tap.
 */

export interface AnnouncedFlight { id: string; status: string; student_user_id: string }

export function inAirIds(flights: AnnouncedFlight[]): Set<string> {
  return new Set(flights.filter((f) => f.status === "in_air").map((f) => f.id));
}

/** Flights that went into the air since the last look. Nothing on the first look (previous = null). */
export function takeoffsToAnnounce<F extends AnnouncedFlight>(previous: Set<string> | null, flights: F[]): F[] {
  if (!previous) return [];
  return flights.filter((f) => f.status === "in_air" && !previous.has(f.id));
}

/** "Sandra Muster" → "Sandra"; a short call carries better across a landing field. */
export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

const STORAGE_KEY = "flyary-flightday-sound";

/** On unless switched off on this device. */
export function soundEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== "off"; } catch { return true; }
}
export function storeSoundEnabled(enabled: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off"); } catch { /* private mode: keep it for this visit only */ }
}

let context: AudioContext | null = null;
function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}
function speech(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

/** Browsers start sound and speech only after a tap: unlock both on the first one. Returns the cleanup. */
export function armAudio(): () => void {
  if (typeof document === "undefined") return () => {};
  const remove = () => { document.removeEventListener("pointerdown", unlock); document.removeEventListener("keydown", unlock); };
  const unlock = () => {
    void audioContext()?.resume();
    const synth = speech();
    if (synth) {
      const silent = new SpeechSynthesisUtterance(" ");
      silent.volume = 0;
      synth.speak(silent);
    }
    remove();
  };
  document.addEventListener("pointerdown", unlock);
  document.addEventListener("keydown", unlock);
  return remove;
}

/** Two rising notes, clearly audible outdoors. */
function chime(ctx: AudioContext): void {
  [[784, 0], [1175, 0.18]].forEach(([frequency, offset]) => {
    const start = ctx.currentTime + offset;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.32);
  });
}

/** The signal, then the sentences spoken in the given language (e.g. "de-DE"). */
export function announce(sentences: string[], lang: string): void {
  const ctx = audioContext();
  if (ctx) {
    void ctx.resume();
    chime(ctx);
  }
  const synth = speech();
  if (!synth || sentences.length === 0) return;
  window.setTimeout(() => {
    for (const text of sentences) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.95;
      synth.speak(utterance);
    }
  }, ctx ? 550 : 0);
}
