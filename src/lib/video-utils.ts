// Constraints for direct video uploads
export const MAX_VIDEO_SECONDS = 60;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const ALLOWED_VIDEO_MIME = ["video/mp4", "video/quicktime", "video/webm"];

export interface VideoValidation {
  ok: boolean;
  error?: string;
  durationSec?: number;
}

/** Loads file into hidden <video> and resolves duration. */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      if (!isFinite(d) || d <= 0) reject(new Error("Konnte Video-Dauer nicht ermitteln"));
      else resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Video kann nicht gelesen werden"));
    };
    v.src = url;
  });
}

export async function validateVideo(file: File): Promise<VideoValidation> {
  if (!ALLOWED_VIDEO_MIME.includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
    return { ok: false, error: "Nur MP4, MOV oder WebM erlaubt" };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return { ok: false, error: `Datei zu groß (max ${MAX_VIDEO_BYTES / 1024 / 1024} MB)` };
  }
  try {
    const durationSec = await getVideoDuration(file);
    if (durationSec > MAX_VIDEO_SECONDS + 0.5) {
      return { ok: false, error: `Video zu lang (max ${MAX_VIDEO_SECONDS}s, dieses: ${Math.round(durationSec)}s)` };
    }
    return { ok: true, durationSec };
  } catch (err: any) {
    return { ok: false, error: err.message || "Video konnte nicht analysiert werden" };
  }
}

/** Extracts a JPEG poster frame from a given file. */
export function extractPoster(file: File, atSeconds = 0.1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = "anonymous";

    const cleanup = () => URL.revokeObjectURL(url);

    v.onloadedmetadata = () => {
      const seekTo = Math.min(atSeconds, Math.max(0, (v.duration || 0) * 0.1));
      v.currentTime = seekTo;
    };
    v.onseeked = () => {
      try {
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (!w || !h) throw new Error("Keine Video-Dimensionen");
        // Limit poster width to 720 to keep size small
        const maxW = 720;
        const scale = Math.min(1, maxW / w);
        const targetW = Math.round(w * scale);
        const targetH = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas nicht verfügbar");
        ctx.drawImage(v, 0, 0, targetW, targetH);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) resolve(blob);
            else reject(new Error("Posterframe konnte nicht erzeugt werden"));
          },
          "image/jpeg",
          0.82
        );
      } catch (err: any) {
        cleanup();
        reject(err);
      }
    };
    v.onerror = () => {
      cleanup();
      reject(new Error("Video kann nicht gelesen werden"));
    };
    v.src = url;
  });
}
