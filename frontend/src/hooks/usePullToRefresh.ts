import { useEffect, useRef, useState, RefObject } from 'react';

export const PULL_REFRESH_THRESHOLD = 70;
const MAX_PULL = 120;
const RESISTANCE = 0.5;

interface PullToRefreshResult {
  pullDistance: number;
  isRefreshing: boolean;
}

/**
 * Custom pull-to-refresh gesture for a scroll container. Needed because the app
 * disables native overscroll and an installed standalone PWA has no browser
 * refresh gesture at all.
 */
export function usePullToRefresh(
  scrollRef: RefObject<HTMLElement>,
  onRefresh: () => void | Promise<void>,
  enabled: boolean,
): PullToRefreshResult {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const distanceRef = useRef(0);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    const setDistance = (value: number) => {
      distanceRef.current = value;
      setPullDistance(value);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || el.scrollTop > 0 || refreshingRef.current) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || startYRef.current === null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0 || el.scrollTop > 0) {
        pullingRef.current = false;
        startYRef.current = null;
        setDistance(0);
        return;
      }
      e.preventDefault();
      setDistance(Math.min(MAX_PULL, dy * RESISTANCE));
    };

    const finishPull = async () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      startYRef.current = null;

      if (distanceRef.current >= PULL_REFRESH_THRESHOLD) {
        refreshingRef.current = true;
        setIsRefreshing(true);
        setDistance(PULL_REFRESH_THRESHOLD);
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setIsRefreshing(false);
          setDistance(0);
        }
      } else {
        setDistance(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', finishPull);
    el.addEventListener('touchcancel', finishPull);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', finishPull);
      el.removeEventListener('touchcancel', finishPull);
    };
  }, [scrollRef, enabled]);

  return { pullDistance, isRefreshing };
}
