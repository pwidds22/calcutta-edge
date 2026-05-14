import type { TournamentPhase } from '@/lib/tournaments/types';

/**
 * Minimum signal the categorizer needs from a dashboard session.
 * Pulled out so the predicate stays trivially unit-testable without
 * needing to construct the full DashboardSession shape.
 */
export interface CategorizableSession {
  status: string;
  currentRound: string | null;
  tournamentPhase: TournamentPhase | null;
}

/**
 * Decide whether a league belongs under the "Completed Leagues" section
 * of the dashboard. The real-world tournament phase is the source of
 * truth — auction status='completed' just means the draft has closed,
 * which happens days before a live tournament even starts.
 *
 * The status fallback (`status === 'completed' && currentRound === null`)
 * only fires when the tournament phase is unknown (config missing for a
 * deprecated tournament_id). It must NOT fire while the tournament is in
 * an active phase — that's the regression that bucketed PGA Championship
 * leagues as completed the moment their drafts wrapped.
 */
export function isCompletedDashboardSession(s: CategorizableSession): boolean {
  if (s.tournamentPhase === 'completed' || s.tournamentPhase === 'archived') return true;
  if (
    s.tournamentPhase === 'live' ||
    s.tournamentPhase === 'hostable' ||
    s.tournamentPhase === 'upcoming'
  ) {
    return false;
  }
  return s.status === 'completed' && s.currentRound === null;
}
