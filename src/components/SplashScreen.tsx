import { useEffect, useState } from "react";

export default function SplashScreen({ onFinished }: { onFinished: () => void }) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 100);
    const t2 = setTimeout(() => setPhase("exit"), 2000);
    const t3 = setTimeout(onFinished, 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onFinished]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        phase === "exit" ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background: "linear-gradient(145deg, hsl(199 89% 28%) 0%, hsl(199 89% 38%) 35%, hsl(152 44% 40%) 100%)",
      }}
    >
      {/* Decorative mountain silhouette */}
      <svg
        className={`absolute bottom-0 left-0 right-0 w-full transition-all duration-1000 ease-out ${
          phase === "enter" ? "opacity-0 translate-y-8" : "opacity-[0.12] translate-y-0"
        }`}
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        style={{ height: "30%" }}
      >
        <path
          d="M0 120 L0 80 L40 50 L70 65 L100 30 L140 55 L170 20 L200 45 L230 15 L260 40 L290 25 L320 50 L350 35 L380 55 L400 40 L400 120 Z"
          fill="white"
        />
      </svg>

      {/* Paraglider icon */}
      <div
        className={`transition-all duration-700 ease-out ${
          phase === "enter"
            ? "opacity-0 -translate-y-6 scale-90"
            : "opacity-100 translate-y-0 scale-100"
        }`}
      >
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Canopy */}
          <ellipse cx="36" cy="20" rx="26" ry="12" fill="white" fillOpacity="0.9" />
          <ellipse cx="36" cy="20" rx="26" ry="12" stroke="white" strokeWidth="1.5" fillOpacity="0" />
          {/* Lines */}
          <line x1="14" y1="24" x2="34" y2="48" stroke="white" strokeOpacity="0.6" strokeWidth="0.8" />
          <line x1="58" y1="24" x2="38" y2="48" stroke="white" strokeOpacity="0.6" strokeWidth="0.8" />
          <line x1="24" y1="26" x2="35" y2="48" stroke="white" strokeOpacity="0.4" strokeWidth="0.6" />
          <line x1="48" y1="26" x2="37" y2="48" stroke="white" strokeOpacity="0.4" strokeWidth="0.6" />
          {/* Pilot */}
          <circle cx="36" cy="52" r="4" fill="white" fillOpacity="0.85" />
        </svg>
      </div>

      {/* App name */}
      <h1
        className={`mt-4 text-4xl font-bold tracking-tight text-white transition-all duration-700 delay-200 ease-out ${
          phase === "enter"
            ? "opacity-0 translate-y-4"
            : "opacity-100 translate-y-0"
        }`}
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        Flyary
      </h1>

      {/* Tagline */}
      <p
        className={`mt-2 text-sm text-white/60 tracking-widest uppercase transition-all duration-700 delay-300 ease-out ${
          phase === "enter"
            ? "opacity-0 translate-y-4"
            : "opacity-100 translate-y-0"
        }`}
      >
        Dein Flugtagebuch
      </p>

      {/* Loading dots */}
      <div className="mt-8 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse"
            style={{ animationDelay: `${i * 200}ms`, animationDuration: "1s" }}
          />
        ))}
      </div>
    </div>
  );
}
