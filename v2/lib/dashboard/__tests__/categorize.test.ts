import { describe, it, expect } from 'vitest';
import { isCompletedDashboardSession } from '../categorize';

describe('isCompletedDashboardSession', () => {
  // Regression: the PGA Championship 2026 league bucketed as "completed"
  // the moment its draft closed, three days before the tournament even
  // started. The categorizer was conflating auction status='completed'
  // with the real-world tournament being done. Phase is the source of
  // truth — auction status is a fallback only when phase is unknown.

  it('treats a live tournament as active even when the auction is completed', () => {
    expect(
      isCompletedDashboardSession({
        status: 'completed',
        currentRound: null,
        tournamentPhase: 'live',
      })
    ).toBe(false);
  });

  it('treats a hostable (pre-start) tournament as active after draft closes', () => {
    expect(
      isCompletedDashboardSession({
        status: 'completed',
        currentRound: null,
        tournamentPhase: 'hostable',
      })
    ).toBe(false);
  });

  it('treats an upcoming tournament as active even after draft closes', () => {
    expect(
      isCompletedDashboardSession({
        status: 'completed',
        currentRound: null,
        tournamentPhase: 'upcoming',
      })
    ).toBe(false);
  });

  it('marks a session as completed when the tournament phase is completed', () => {
    expect(
      isCompletedDashboardSession({
        status: 'active',
        currentRound: 'r4',
        tournamentPhase: 'completed',
      })
    ).toBe(true);
  });

  it('marks archived tournaments as completed regardless of auction status', () => {
    expect(
      isCompletedDashboardSession({
        status: 'lobby',
        currentRound: null,
        tournamentPhase: 'archived',
      })
    ).toBe(true);
  });

  it('falls back to status/currentRound only when phase is null', () => {
    expect(
      isCompletedDashboardSession({
        status: 'completed',
        currentRound: null,
        tournamentPhase: null,
      })
    ).toBe(true);

    expect(
      isCompletedDashboardSession({
        status: 'completed',
        currentRound: 'r1',
        tournamentPhase: null,
      })
    ).toBe(false);

    expect(
      isCompletedDashboardSession({
        status: 'active',
        currentRound: null,
        tournamentPhase: null,
      })
    ).toBe(false);
  });
});
