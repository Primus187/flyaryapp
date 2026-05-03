import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { Play, Pause, Scissors } from "lucide-react";
import { MAX_VIDEO_SECONDS } from "@/lib/video-utils";

interface Props {
  file: File | null;
  open: boolean;
  onClose: () => void;
  /** Resolves with the trimmed File. */
  onTrimmed: (file: File) => void;
}

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function pickRecorderMime(): { mime: string; ext: string } {
  const candidates = [
    { mime: "video/mp4;codecs=avc1,mp4a.40.2", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: "", ext: "webm" };
}

export default function VideoTrimDialog({ file, open, onClose, onTrimmed }: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!file || !open) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    setError("");
    setProgress(0);
    return () => URL.revokeObjectURL(u);
  }, [file, open]);

  const onLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration;
    setDuration(d);
    const end = Math.min(d, MAX_VIDEO_SECONDS);
    setRange([0, end]);
    v.currentTime = 0;
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime >= range[1]) {
      v.pause();
      v.currentTime = range[0];
      setPlaying(false);
    }
  };

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      if (v.currentTime < range[0] || v.currentTime >= range[1]) v.currentTime = range[0];
      await v.play();
      setPlaying(true);
    }
  };

  const onRangeChange = (vals: number[]) => {
    let [a, b] = vals as [number, number];
    if (b - a > MAX_VIDEO_SECONDS) {
      // Constrain span
      if (a !== range[0]) b = a + MAX_VIDEO_SECONDS;
      else a = b - MAX_VIDEO_SECONDS;
    }
    setRange([a, b]);
    const v = videoRef.current;
    if (v) {
      // Seek to whichever handle moved
      v.pause();
      setPlaying(false);
      v.currentTime = a !== range[0] ? a : b;
    }
  };

  const startTrim = async () => {
    const v = videoRef.current;
    if (!v) return;
    setError("");
    setRecording(true);
    setProgress(0);

    const span = range[1] - range[0];

    try {
      // captureStream is widely supported on Chromium/Firefox; Safari iOS limited
      const anyV = v as any;
      const stream: MediaStream | undefined = anyV.captureStream?.() || anyV.mozCaptureStream?.();
      if (!stream) throw new Error(t("flights.trimUnsupported", { defaultValue: "Trim wird in diesem Browser nicht unterstützt. Bitte vorab kürzen." }));

      const { mime, ext } = pickRecorderMime();
      if (typeof MediaRecorder === "undefined") throw new Error("MediaRecorder fehlt");

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

      const stopped = new Promise<void>((res) => { recorder.onstop = () => res(); });

      v.muted = false;
      v.currentTime = range[0];
      await new Promise<void>((res) => {
        const h = () => { v.removeEventListener("seeked", h); res(); };
        v.addEventListener("seeked", h);
      });

      recorder.start(250);
      const startTs = performance.now();
      await v.play();

      const tick = () => {
        if (!recording && recorder.state === "inactive") return;
        const elapsed = (performance.now() - startTs) / 1000;
        setProgress(Math.min(100, (elapsed / span) * 100));
        if (v.currentTime >= range[1] || elapsed >= span + 0.2) {
          v.pause();
          if (recorder.state !== "inactive") recorder.stop();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      await stopped;

      const blob = new Blob(chunks, { type: mime || "video/webm" });
      const baseName = (file?.name || "video").replace(/\.[^.]+$/, "");
      const out = new File([blob], `${baseName}-trim.${ext}`, { type: blob.type });
      setRecording(false);
      onTrimmed(out);
    } catch (err: any) {
      setRecording(false);
      setError(err.message || "Trim fehlgeschlagen");
    }
  };

  const span = range[1] - range[0];
  const tooLong = span > MAX_VIDEO_SECONDS + 0.05;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !recording) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scissors className="h-4 w-4" /> {t("flights.trimVideo", { defaultValue: "Video zuschneiden" })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {url && (
            <video
              ref={videoRef}
              src={url}
              className="w-full rounded-md bg-black aspect-video object-contain"
              onLoadedMetadata={onLoaded}
              onTimeUpdate={onTimeUpdate}
              playsInline
              preload="auto"
            />
          )}

          {duration > 0 && (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatTime(range[0])}</span>
                <span className={tooLong ? "text-destructive" : ""}>
                  {t("flights.trimSelection", { defaultValue: "Auswahl" })}: {formatTime(span)} / {MAX_VIDEO_SECONDS}s
                </span>
                <span>{formatTime(range[1])}</span>
              </div>
              <Slider
                value={range}
                min={0}
                max={duration}
                step={0.1}
                onValueChange={onRangeChange}
                disabled={recording}
              />
              <div className="flex items-center justify-between gap-2">
                <Button type="button" size="sm" variant="outline" onClick={togglePlay} disabled={recording}>
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span className="ml-1">{t("flights.trimPreview", { defaultValue: "Vorschau" })}</span>
                </Button>
                <span className="text-xs text-muted-foreground">{t("flights.trimHint", { defaultValue: "Handles ziehen, max 60s" })}</span>
              </div>

              {recording && <Progress value={progress} />}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={recording}>{t("common.cancel")}</Button>
          <Button onClick={startTrim} disabled={recording || tooLong || span < 0.5}>
            {recording
              ? t("flights.trimming", { defaultValue: "Schneide…" })
              : t("flights.trimApply", { defaultValue: "Zuschneiden" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
