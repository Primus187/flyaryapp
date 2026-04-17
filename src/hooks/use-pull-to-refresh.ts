import { useCallback, useRef, useState } from "react";

/**
 * Reusable pull-to-refresh hook for mobile lists.
 * Returns handlers to attach to the scroll container and a pullDistance/refreshing state.
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void, threshold = 60) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) setPullDistance(Math.min(diff * 0.5, 80));
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance > threshold && !refreshing) {
      setRefreshing(true);
      try { await onRefresh(); } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, threshold, onRefresh]);

  return { pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd };
}
