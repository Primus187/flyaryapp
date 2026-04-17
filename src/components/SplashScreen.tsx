import { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinished: () => void;
  progress?: number;
  ready?: boolean;
  minDurationMs?: number;
}

export default function SplashScreen({
  onFinished,
  progress = 0,
  ready = true,
  minDurationMs = 800,
}: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 80);
    const t2 = setTimeout(() => setMinElapsed(true), minDurationMs);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [minDurationMs]);

  useEffect(() => {
    if (minElapsed && ready && phase !== "exit") {
      setPhase("exit");
      const t = setTimeout(onFinished, 400);
      return () => clearTimeout(t);
    }
  }, [minElapsed, ready, phase, onFinished]);

  const pct = Math.min(100, Math.max(0, progress));

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-400 ${
        phase === "exit" ? "opacity-0" : "opacity-100"
      }`}
    >
      <img
        src="/splash-bg.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative z-10 flex flex-col items-center justify-center w-full px-8">
        <h1
          className={`text-6xl font-bold tracking-tight text-white drop-shadow-lg transition-all duration-500 delay-100 ease-out ${
            phase === "enter" ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
          }`}
          style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
        >
          Flyary
        </h1>
        <p
          className={`mt-3 text-base text-white/80 tracking-widest uppercase drop-shadow transition-all duration-500 delay-200 ease-out ${
            phase === "enter" ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
          }`}
        >
          Dein Flugtagebuch
        </p>
        <div className="mt-8 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse"
              style={{ animationDelay: `${i * 200}ms`, animationDuration: "1s" }}
            />
          ))}
        </div>
        <div className="mt-6 w-48 h-1 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full bg-white/80 transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
