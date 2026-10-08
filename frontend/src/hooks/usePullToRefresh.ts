import { useEffect, useRef, useState, RefObject } from 'react';

export const PULL_REFRESH_THRESHOLD = 70;
const MAX_PULL = 120;
const RESISTANCE = 0.5;
const DEAD_ZONE = 8;

interface PullToRefreshResult {
  pullDistance: number;
  isRefreshing: boolean;
}

/** Scroll offset of the page itself. */
function getPageScrollTop(): number {
  const el = document.scrollingElement || document.documentElement;
  return el ? el.scrollTop : window.scrollY || 0;
}

/**
 * Nearest scrollable ancestor of the touched node, or null when the page itself
 * scrolls. The layout has several nested scrollers and which one is active
 * depends on the viewport (on mobile the document usually scrolls), so the
 * gesture must resolve this per touch instead of assuming a fixed element.
 */
function findScrollableAncestor(target: EventTarget | null): HTMLElement | null {
  let el: HTMLElement | null =
    target instanceof HTMLElement
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  while (el && el !== document.body && el !== document.documentElement) {
    const { overflowY } = getComputedStyle(el);
    const scrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    if (scrollable && el.scrollHeight > el.clientHeight + 1) return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * Custom pull-to-refresh gesture for a scroll container. Needed because the app
 * disables native overscroll and an installed standalone PWA has no browser
 * refresh gesture at all. Only engages when the active scroller is at the very
 * top, so normal scrolling is never hijacked.
 */
export function usePullToRefresh(
  containerRef: RefObject<HTMLElement>,
  onRefresh: () => void | Promise<void>,
  enabled: boolean,
): PullToRefreshResult {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const distanceRef = useRef(0);
  const startYRef = useRef<number | null>(null);
  const scrollElRef = useRef<HTMLElement | null>(null);
  const armedRef = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const setDistance = (value: number) => {
      distanceRef.current = value;
      setPullDistance(value);
    };

    const currentScrollTop = () =>
      scrollElRef.current ? scrollElRef.current.scrollTop : getPageScrollTop();

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || refreshingRef.current) {
        armedRef.current = false;
        return;
      }
      scrollElRef.current = findScrollableAncestor(e.target);
      // Not at the top -> it's a regular scroll gesture; never interfere.
      if (currentScrollTop() > 0 || getPageScrollTop() > 0) {
        armedRef.current = false;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      armedRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!armedRef.current || startYRef.current === null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      // Moving up, or the scroller left the top -> release and let it scroll.
      if (dy <= 0 || currentScrollTop() > 0 || getPageScrollTop() > 0) {
        armedRef.current = false;
        startYRef.current = null;
        setDistance(0);
        return;
      }
      // Small downward movement: don't hijack the gesture yet.
      if (dy < DEAD_ZONE) return;
      e.preventDefault();
      setDistance(Math.min(MAX_PULL, dy * RESISTANCE));
    };

    const finishPull = async () => {
      if (!armedRef.current) return;
      armedRef.current = false;
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

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', finishPull);
    container.addEventListener('touchcancel', finishPull);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', finishPull);
      container.removeEventListener('touchcancel', finishPull);
    };
  }, [containerRef, enabled]);

  return { pullDistance, isRefreshing };
}
