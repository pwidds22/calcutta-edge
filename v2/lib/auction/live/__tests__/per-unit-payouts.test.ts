import { describe, it, expect } from 'vitest';
import { getTeamStatus, calculateTeamEarnings, adjustPayoutRulesForTies } from '../actual-payouts';
import type { TournamentConfig } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';

const config = {
  rounds: [
    { key: 'wins', label: 'W', payoutLabel: 'Wins', teamsAdvancing: 32, payoutUnits: 272, parallel: true, flatRate: true },
    { key: 'berth', label: 'B', payoutLabel: 'Playoffs', teamsAdvancing: 14 },
  ],
} as unknown as TournamentConfig;

const r = (team_id: number, round_key: string, result: 'won' | 'lost', result_count?: number): TournamentResult =>
  ({ team_id, round_key, result, result_count });

describe('per-unit payouts', () => {
  it('getTeamStatus surfaces the result count', () => {
    const status = getTeamStatus(1, [r(1, 'wins', 'won', 11)], config);
    expect(status.roundsWon).toEqual(['wins']);
    expect(status.roundCounts.wins).toBe(11);
  });

  it('a count of 11 pays 11x the per-unit rate', () => {
    // 0.1029% of a 4000 pot = $4.116 per win; 11 wins = $45.28
    const earnings = calculateTeamEarnings(['wins'], 4000, { wins: 0.1029 }, { wins: 11 });
    expect(earnings).toBeCloseTo(45.28, 2);
  });

  it('a tie counts half a win', () => {
    const earnings = calculateTeamEarnings(['wins'], 4000, { wins: 0.1029 }, { wins: 0.5 });
    expect(earnings).toBeCloseTo(2.06, 2);
  });

  it('REGRESSION: omitting counts is identical to the old behavior', () => {
    // This is exactly how golf and World Cup call it today.
    const earnings = calculateTeamEarnings(['berth'], 4000, { berth: 0.5 });
    expect(earnings).toBeCloseTo(20, 5);
  });

  it('adjustPayoutRulesForTies never rescales a flatRate round', () => {
    const winners = new Map([['wins', 30], ['berth', 7]]);
    const adjusted = adjustPayoutRulesForTies({ wins: 0.1029, berth: 0.5 }, winners, config);
    expect(adjusted.wins).toBe(0.1029);          // untouched
    expect(adjusted.berth).toBeCloseTo(1.0, 5);  // 0.5 * 14 / 7 — normal tier behavior
  });
});
