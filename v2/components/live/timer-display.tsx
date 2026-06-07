'use client';

import type { TimerState } from '@/lib/auction/live/use-timer';

interface TimerDisplayProps {
  timer: TimerState;
}

export function TimerDisplay({ timer }: TimerDisplayProps) {
  // Nothing to show once the team has sold / there's no active timer.
  if (!timer.isRunning && timer.totalMs <= 0) return null;

  // Finalization window: the countdown hit 0 but the team hasn't sold yet — the
  // ~2s grace period (CLIENT_GRACE_MS + the autoAdvance round-trip) is STILL
  // accepting last-second bids. Show a "Final Call" state instead of vanishing.
  // A late bid flips isRunning back to true (the live countdown returns below);
  // the sale zeroes totalMs (this whole box then disappears).
  if (!timer.isRunning) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-4 py-3 animate-pulse">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wider text-red-400">
            Final Call
          </span>
          <span className="text-lg" aria-hidden>
            🔔
          </span>
        </div>
        <p className="mb-2 text-[11px] text-white/50">
          Last-second bids still count
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full w-full rounded-full bg-red-500" />
        </div>
      </div>
    );
  }

  const seconds = Math.ceil(timer.remainingMs / 1000);
  const progress = timer.totalMs > 0 ? timer.remainingMs / timer.totalMs : 0;

  // Color transitions: emerald > 10s, amber 5-10s, red < 5s
  let barColor = 'bg-emerald-500';
  let textColor = 'text-emerald-400';
  let pulseClass = '';

  if (seconds <= 5) {
    barColor = 'bg-red-500';
    textColor = 'text-red-400';
    pulseClass = 'animate-pulse';
  } else if (seconds <= 10) {
    barColor = 'bg-amber-500';
    textColor = 'text-amber-400';
  }

  return (
    <div className={`rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 ${pulseClass}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-white/40">
          Time Remaining
        </span>
        <span className={`text-lg font-bold tabular-nums ${textColor}`}>
          {seconds}s
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-colors ${barColor}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
