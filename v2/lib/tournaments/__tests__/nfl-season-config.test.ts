import { describe, it, expect } from 'vitest';
import { NFL_SEASON_2026_CONFIG, NFL_SEASON_2026_TEAMS } from '../configs/nfl-season-2026';
import { getTeamStatus } from '@/lib/auction/live/actual-payouts';
import type { TournamentResult } from '@/actions/tournament-results';

const r = (team_id: number, round_key: string, result: 'won' | 'lost', result_count?: number): TournamentResult =>
  ({ team_id, round_key, result, result_count });

describe('nfl_season_2026 config', () => {
  it('ends on Super Bowl LXI, 2027-02-14', () => {
    expect(NFL_SEASON_2026_CONFIG.endDate).toBe('2027-02-14');
  });

  it('has 32 teams across 8 divisions', () => {
    expect(NFL_SEASON_2026_TEAMS).toHaveLength(32);
    expect(NFL_SEASON_2026_CONFIG.groups).toHaveLength(8);
  });

  it('puts all parallel rounds before the ladder', () => {
    const keys = NFL_SEASON_2026_CONFIG.rounds.map((x) => x.key);
    const lastParallel = Math.max(...NFL_SEASON_2026_CONFIG.rounds.map((x, i) => (x.parallel ? i : -1)));
    const firstLadder = NFL_SEASON_2026_CONFIG.rounds.findIndex((x) => !x.parallel);
    expect(lastParallel).toBeLessThan(firstLadder);
    expect(keys[0]).toBe('regularSeasonWins');
  });

  it('THE BUG: a wild card that lost its division still reaches the Super Bowl', () => {
    const results = [
      r(1, 'regularSeasonWins', 'won', 10),
      r(1, 'divisionWinner', 'lost'),
      r(1, 'playoffBerth', 'won'),
      r(1, 'reachDivisional', 'won'),
      r(1, 'reachConfChamp', 'won'),
      r(1, 'reachSuperBowl', 'won'),
      r(1, 'superBowl', 'won'),
    ];
    const status = getTeamStatus(1, results, NFL_SEASON_2026_CONFIG);
    expect(status.status).toBe('champion');
    expect(status.eliminatedInRound).toBeNull();
    expect(status.roundCounts.regularSeasonWins).toBe(10);
  });

  it('the per-win round carries 272 units and a flat rate', () => {
    const wins = NFL_SEASON_2026_CONFIG.rounds.find((x) => x.key === 'regularSeasonWins')!;
    expect(wins.payoutUnits).toBe(272);
    expect(wins.flatRate).toBe(true);
    expect(wins.devigScope).toBe('field');
    expect(wins.unitLabel).toBe('win');
  });

  it('declares props that exist and a Stripe link of its own', () => {
    expect(NFL_SEASON_2026_CONFIG.propBets.map((p) => p.key)).toEqual(['bestRecord', 'worstRecord']);
    expect(NFL_SEASON_2026_CONFIG.stripePaymentLinkEnvKey).toBe('NEXT_PUBLIC_STRIPE_PAYMENT_LINK_NFL');
  });
});
