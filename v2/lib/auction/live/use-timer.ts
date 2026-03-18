'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

export interface TimerState {
  isRunning: boolean;
  remainingMs: number;
  totalMs: number;
}

interface UseTimerOptions {
  onExpire: () => void;
  isCommissioner: boolean;
}

/**
 * Client-side grace period before firing onExpire.
 * Absorbs broadcast latency so a TIMER_RESET from a last-second bid
 * can arrive and cancel the expiry before autoAdvance fires.
 */
const CLIENT_GRACE_MS = 1500;

export function useTimer({ onExpire, isCommissioner }: UseTimerOptions) {
  const [state, setState] = useState<TimerState>({
    isRunning: false,
    remainingMs: 0,
    totalMs: 0,
  });

  const endsAtRef = useRef<number | null>(null);
  const totalMsRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const expiredRef = useRef<boolean>(false);
  const graceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const tick = useCallback(() => {
    if (endsAtRef.current === null) return;

    const remaining = Math.max(0, endsAtRef.current - Date.now());
    setState({
      isRunning: remaining > 0,
      remainingMs: remaining,
      totalMs: totalMsRef.current,
    });

    if (remaining <= 0) {
      // Timer visually expired — but wait a grace period before firing onExpire
      // so in-flight TIMER_RESET broadcasts from last-second bids can arrive.
      if (!expiredRef.current && isCommissioner) {
        expiredRef.current = true;
        graceTimeoutRef.current = setTimeout(() => {
          // Double-check: if endsAtRef was updated (timer.reset/start called)
          // during the grace window, a bid came in — don't fire.
          if (endsAtRef.current !== null) return;
          onExpireRef.current();
        }, CLIENT_GRACE_MS);
      }
      endsAtRef.current = null;
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [isCommissioner]);

  const start = useCallback(
    (endsAt: string, durationMs: number) => {
      // Guard against zero/negative duration (prevents divide-by-zero in progress bar)
      if (durationMs <= 0) return;

      // Cancel any existing timer + grace timeout
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (graceTimeoutRef.current !== null) {
        clearTimeout(graceTimeoutRef.current);
        graceTimeoutRef.current = null;
      }

      endsAtRef.current = new Date(endsAt).getTime();
      totalMsRef.current = durationMs;
      expiredRef.current = false;

      setState({
        isRunning: true,
        remainingMs: Math.max(0, endsAtRef.current - Date.now()),
        totalMs: durationMs,
      });

      rafRef.current = requestAnimationFrame(tick);
    },
    [tick]
  );

  const reset = useCallback(
    (endsAt: string, durationMs: number) => {
      // Same as start but semantically distinct (new bid came in).
      // Critically, this cancels any pending grace timeout.
      start(endsAt, durationMs);
    },
    [start]
  );

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (graceTimeoutRef.current !== null) {
      clearTimeout(graceTimeoutRef.current);
      graceTimeoutRef.current = null;
    }
    endsAtRef.current = null;
    expiredRef.current = false;
    setState({ isRunning: false, remainingMs: 0, totalMs: 0 });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (graceTimeoutRef.current !== null) {
        clearTimeout(graceTimeoutRef.current);
      }
    };
  }, []);

  return { state, start, reset, stop };
}
