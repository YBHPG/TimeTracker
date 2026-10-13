import { useEffect, useRef } from 'react';
import { api } from '../api/client';

const POLL_MS = 10 * 1000;

interface LiveSyncOptions {
  enabled: boolean;
  refresh: () => void | Promise<void>;
  /** Return false to skip a tick (e.g. while local changes are still queued). */
  canRefresh: () => boolean;
}

/**
 * Keeps the UI current across devices without a manual reload. It polls a cheap
 * server revision stamp and triggers a refresh only when it actually changes, plus
 * whenever the app returns to the foreground or the network reconnects. Ticks are
 * skipped while local changes are still queued so an in-flight optimistic update is
 * never clobbered.
 */
export function useLiveSync({ enabled, refresh, canRefresh }: LiveSyncOptions) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const canRefreshRef = useRef(canRefresh);
  canRefreshRef.current = canRefresh;

  const revisionRef = useRef<string | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    // Cheap tick: fetch the stamp and only pull the full payload when it moved.
    const poll = async () => {
      if (document.hidden || runningRef.current) return;
      if (!canRefreshRef.current()) return;

      runningRef.current = true;
      try {
        const revision = await api.getRevision();
        if (cancelled) return;
        if (revisionRef.current === null) {
          revisionRef.current = revision;
        } else if (revision !== revisionRef.current) {
          revisionRef.current = revision;
          await refreshRef.current();
        }
      } catch {
        // Network/auth failures are surfaced elsewhere (session banner); ignore here.
      } finally {
        runningRef.current = false;
      }
    };

    // Full pull: used when we may have missed changes entirely (reconnect).
    const fullRefresh = async () => {
      if (document.hidden || runningRef.current) return;
      if (!canRefreshRef.current()) return;

      runningRef.current = true;
      try {
        await refreshRef.current();
        revisionRef.current = await api.getRevision();
      } catch {
        // Ignore; the next poll will retry.
      } finally {
        runningRef.current = false;
      }
    };

    // Prime the baseline without a redundant fetch (the app already loaded data).
    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, POLL_MS);

    const onWake = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('online', fullRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', fullRefresh);
    };
  }, [enabled]);
}
