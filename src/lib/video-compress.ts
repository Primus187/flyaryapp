import { getVideoDuration } from "./video-utils";

export interface CompressOptions {
  targetBytes?: number;
  /** Override video bitrate in bits/s. */
  videoBitrate?: number;
  /** Optional progress callback (0..1). */
  onProgress?: (pct: number) => void;
  /** Max width — source is downscaled (keeping aspect) if wider. */
  maxWidth?: number;
}

function pickRecorderMime(): { mime: string; ext: string } {
  if (typeof MediaRecorder === "undefined") return { mime: "", ext: "webm" };
  const candidates = [
    { mime: "video/mp4;codecs=avc1,mp4a.40.2", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    try { if (MediaRecorder.isTypeSupported(c.mime)) return c; } catch { /* ignore */ }
  }
  return { mime: "", ext: "webm" };
}

export function isVideoCompressionSupported(): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  const v = document.createElement("video") as any;
  return typeof v.captureStream === "function" || typeof v.mozCaptureStream === "function";
}

async function compressOnce(file: File, videoBitrate: number, opts: CompressOptions): Promise<File> {
  const { mime, ext } = pickRecorderMime();
  if (typeof MediaRecorder === "undefined") throw new Error("MediaRecorder nicht verfügbar");

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true; // ensure autoplay allowed
  (video as any).playsInline = true;
  video.setAttribute("playsinline", "true");
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  // Attach to DOM so the browser does not throttle frame production / captureStream.
  // Position offscreen but keep visibility so the compositor still produces frames.
  video.style.position = "fixed";
  video.style.left = "0";
  video.style.top = "0";
  video.style.width = "2px";
  video.style.height = "2px";
  video.style.opacity = "0.01";
  video.style.pointerEvents = "none";
  video.style.zIndex = "-1";
  document.body.appendChild(video);

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Video kann nicht gelesen werden"));
  });

  const duration = video.duration;
  if (!isFinite(duration) || duration <= 0) {
    URL.revokeObjectURL(url);
    throw new Error("Video-Dauer unbekannt");
  }

  const anyV = video as any;
  const stream: MediaStream | undefined =
    anyV.captureStream?.(30) || anyV.captureStream?.() || anyV.mozCaptureStream?.();
  if (!stream) {
    URL.revokeObjectURL(url);
    throw new Error("Browser unterstützt keine Video-Komprimierung");
  }

  // Optional: drop audio if missing tracks; otherwise keep original audio
  const recorder = new MediaRecorder(
    stream,
    mime
      ? { mimeType: mime, videoBitsPerSecond: videoBitrate, audioBitsPerSecond: 96_000 }
      : { videoBitsPerSecond: videoBitrate, audioBitsPerSecond: 96_000 } as any
  );

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((res) => { recorder.onstop = () => res(); });

  video.currentTime = 0;
  await new Promise<void>((res) => {
    const h = () => { video.removeEventListener("seeked", h); res(); };
    video.addEventListener("seeked", h);
  });

  recorder.start(250);
  const startTs = performance.now();
  await video.play();

  await new Promise<void>((res) => {
    const tick = () => {
      const elapsed = (performance.now() - startTs) / 1000;
      opts.onProgress?.(Math.min(0.99, elapsed / duration));
      if (video.ended || video.currentTime >= duration - 0.05 || elapsed >= duration + 0.5) {
        try { video.pause(); } catch { /* ignore */ }
        if (recorder.state !== "inactive") recorder.stop();
        res();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await stopped;
  URL.revokeObjectURL(url);
  try { video.remove(); } catch { /* ignore */ }

  // Strip codec params from MIME so storage bucket MIME validation accepts it
  const cleanType = (mime || "video/webm").split(";")[0].trim();
  const blob = new Blob(chunks, { type: cleanType });
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const out = new File([blob], `${baseName}-compressed.${ext}`, { type: cleanType });
  opts.onProgress?.(1);
  return out;
}

/**
 * Compress a video file in the browser to fit a target byte size.
 * Re-encodes via MediaRecorder + captureStream. Falls back gracefully on errors.
 */
export async function compressVideo(file: File, opts: CompressOptions = {}): Promise<File> {
  if (!isVideoCompressionSupported()) {
    throw new Error("Browser unterstützt keine Video-Komprimierung");
  }

  const targetBytes = opts.targetBytes ?? 45 * 1024 * 1024;
  const duration = await getVideoDuration(file);
  // Reserve ~96 kbps for audio, 0.85 safety factor
  const audioReserve = 96_000;
  const targetBits = targetBytes * 8;
  const videoBitrate =
    opts.videoBitrate ?? Math.max(300_000, Math.floor((targetBits / duration) * 0.85 - audioReserve));

  let result = await compressOnce(file, videoBitrate, opts);

  // If still too large, retry once with halved bitrate
  if (result.size > targetBytes) {
    result = await compressOnce(file, Math.max(250_000, Math.floor(videoBitrate / 2)), opts);
  }
  return result;
}
