import { useCallback, useRef, useState } from "react";

interface Options {
  onSwipeLeft?: () => void;
  threshold?: number; // px to trigger
  maxOffset?: number; // px max visual offset
}

/**
 * Tracks horizontal swipe gesture for list items.
 * Returns offset (negative for left swipe) and touch handlers.
 */
export function useSwipeAction({ onSwipeLeft, threshold = 80, maxOffset = 120 }: Options) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);
  const decided = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = true;
    decided.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!decided.current) {
      // Decide direction once movement exceeds 8px
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        decided.current = true;
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical scroll — abort swipe
          swiping.current = false;
          return;
        }
      } else {
        return;
      }
    }

    if (dx < 0) {
      setOffset(Math.max(-maxOffset, dx));
    } else {
      setOffset(0);
    }
  }, [maxOffset]);

  const onTouchEnd = useCallback(() => {
    if (!swiping.current) {
      setOffset(0);
      return;
    }
    swiping.current = false;
    if (offset <= -threshold) {
      onSwipeLeft?.();
    }
    setOffset(0);
  }, [offset, threshold, onSwipeLeft]);

  return { offset, onTouchStart, onTouchMove, onTouchEnd };
}
