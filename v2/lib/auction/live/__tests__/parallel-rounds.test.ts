import { describe, it, expect } from 'vitest';
import {
  getTeamStatus,
  getAliveTeamsForRound,
  getCompletedRounds,
} from '../actual-payouts';
import type { TournamentConfig } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';

// Minimal soccer-shaped config: winGroup is a parallel bonus; r32→champion is the ladder.
const config = {
  rounds: [
    { key: 'winGroup', label: 'Win Group', teamsAdvancing: 12, payoutLabel: 'Win Group', parallel: true },
    { key: 'r32', label: 'R32', teamsAdvancing: 32, payoutLabel: 'Advance' },
    { key: 'r16', label: 'R16', teamsAdvancing: 16, payoutLabel: 'Round of 16' },
    { key: 'champion', label: 'Champion', teamsAdvancing: 1, payoutLabel: 'Champion' },
  ],
} as unknown as TournamentConfig;

// Build a result row (TournamentResult is exactly these three fields).
const r = (team_id: number, round_key: string, result: 'won' | 'lost'): TournamentResult => ({
  team_id,
  round_key,
  result,
});

describe('parallel rounds (winGroup) do not block the ladder', () => {
  it('advancer who did NOT win its group keeps knockout credit (the bug)', () => {
    // Team 1 advanced (r32 won) but finished 2nd in group (winGroup lost), then won R32 (r16 won).
    const results = [r(1, 'winGroup', 'lost'), r(1, 'r32', 'won'), r(1, 'r16', 'won')];
    const status = getTeamStatus(1, results, config);
    expect(status.status).toBe('alive');
    expect(status.roundsWon).toEqual(['r32', 'r16']); // winGroup lost is not credited, but does NOT eliminate
    expect(status.eliminatedInRound).toBeNull();
  });

  it('group winner who advances is credited winGroup AND the ladder', () => {
    const results = [r(2, 'winGroup', 'won'), r(2, 'r32', 'won'), r(2, 'r16', 'won')];
    const status = getTeamStatus(2, results, config);
    expect(status.status).toBe('alive');
    expect(status.roundsWon).toEqual(['winGroup', 'r32', 'r16']);
  });

  it('team eliminated in group stage is eliminated at r32, not winGroup', () => {
    const results = [r(3, 'winGroup', 'lost'), r(3, 'r32', 'lost')];
    const status = getTeamStatus(3, results, config);
    expect(status.status).toBe('eliminated');
    expect(status.eliminatedInRound).toBe('r32');
    expect(status.roundsWon).toEqual([]);
  });

  it('champion who never won its group is still champion', () => {
    const results = [
      r(4, 'winGroup', 'lost'), r(4, 'r32', 'won'), r(4, 'r16', 'won'), r(4, 'champion', 'won'),
    ];
    const status = getTeamStatus(4, results, config);
    expect(status.status).toBe('champion');
    expect(status.roundsWon).toEqual(['r32', 'r16', 'champion']);
  });

  it('getAliveTeamsForRound excludes the parallel round from prerequisites', () => {
    // Team 1 advanced but lost winGroup → must still be "alive" for r16 after winning r32.
    const results = [r(1, 'winGroup', 'lost'), r(1, 'r32', 'won')];
    const alive = getAliveTeamsForRound([1], results, config, 'r16');
    expect(alive).toEqual([1]);
  });

  it('getCompletedRounds is not blocked by an unresolved parallel round', () => {
    // r32 fully resolved for the sold teams, winGroup never entered → r32 still counts as completed.
    const results = [r(1, 'r32', 'won'), r(5, 'r32', 'lost')];
    const completed = getCompletedRounds([1, 5], results, config);
    expect(completed).toContain('r32');
  });
});
