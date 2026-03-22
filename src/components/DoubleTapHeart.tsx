import { useState, useRef, useCallback, ReactNode } from "react";
import { Heart } from "lucide-react";

interface DoubleTapHeartProps {
  children: ReactNode;
  onDoubleTap: () => void;
  className?: string;
}

export default function DoubleTapHeart({ children, onDoubleTap, className }: DoubleTapHeartProps) {
  const [showHeart, setShowHeart] = useState(false);
  const lastTapRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      clearTimeout(timerRef.current);
      onDoubleTap();
      setShowHeart(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(30);
      }
      setTimeout(() => setShowHeart(false), 900);
    }
    lastTapRef.current = now;
  }, [onDoubleTap]);

  return (
    <div className={`relative ${className || ""}`} onClick={handleTap}>
      {children}
      {showHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <Heart
            className="h-20 w-20 fill-white text-white drop-shadow-lg animate-[heart-burst_0.9s_ease-out_forwards]"
          />
        </div>
      )}
    </div>
  );
}
