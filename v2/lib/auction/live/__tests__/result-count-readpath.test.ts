import { describe, it, expect } from 'vitest';
import { getTeamStatus, calculateTeamEarnings } from '../actual-payouts';
import type { TournamentConfig } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';

const config = {
  rounds: [
    { key: 'wins', label: 'W', payoutLabel: 'Wins', teamsAdvancing: 32, payoutUnits: 272, parallel: true, flatRate: true },
  ],
} as unknown as TournamentConfig;

describe('result_count survives the read path', () => {
  it('an 11-win team earns 11 units, not 1', () => {
    const results: TournamentResult[] = [
      { team_id: 1, round_key: 'wins', result: 'won', result_count: 11 },
    ];
    const status = getTeamStatus(1, results, config);
    expect(status.roundCounts.wins).toBe(11);
    expect(calculateTeamEarnings(status.roundsWon, 4000, { wins: 0.1029 }, status.roundCounts)).toBeCloseTo(45.28, 2);
  });

  it('a tie counts half a unit', () => {
    const results: TournamentResult[] = [
      { team_id: 2, round_key: 'wins', result: 'won', result_count: 9.5 },
    ];
    expect(getTeamStatus(2, results, config).roundCounts.wins).toBe(9.5);
  });

  it('a missing count still means one unit (golf / World Cup behavior)', () => {
    const results: TournamentResult[] = [{ team_id: 3, round_key: 'wins', result: 'won' }];
    expect(getTeamStatus(3, results, config).roundCounts.wins).toBe(1);
  });
});
