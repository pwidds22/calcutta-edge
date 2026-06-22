import { describe, it, expect } from 'vitest';
import { calculateSoccerProjectedStandings } from '../soccer-standings';
import type { SoldTeam } from '../use-auction-channel';
import type { BaseTeam, TournamentConfig, PayoutRules } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';

// Minimal 2-round config: winGroup (parallel) + champion (ladder).
const config = {
  id: 'test_wc',
  sport: 'soccer',
  devigStrategy: 'group',
  rounds: [
    { key: 'winGroup', label: 'WG', teamsAdvancing: 1, payoutLabel: 'WG', gameLabel: 'WG', devigScope: 'group', parallel: true },
    { key: 'champion', label: 'C', teamsAdvancing: 1, payoutLabel: 'C', gameLabel: 'C', devigScope: 'global' },
  ],
  groups: [{ key: 'A', label: 'Group A' }],
} as unknown as TournamentConfig;

// Two teams in group A; probs chosen so devig is a no-op:
// winGroup sums to 1 within the group; champion sums to teamsAdvancing(1) across the field.
const baseTeams = [
  { id: 1, name: 'Alpha', seed: 1, group: 'A', americanOdds: {}, probabilities: { winGroup: 0.6, champion: 0.6 } },
  { id: 2, name: 'Beta', seed: 2, group: 'A', americanOdds: {}, probabilities: { winGroup: 0.4, champion: 0.4 } },
] as unknown as BaseTeam[];

// Payout sums: winGroup 10×1 + champion 90×1 = 100.
const payoutRules = { winGroup: 10, champion: 90 } as unknown as PayoutRules;

const sold: SoldTeam[] = [
  { teamId: 1, winnerId: 'u1', winnerName: 'Pat', amount: 40 },
  { teamId: 2, winnerId: 'u1', winnerName: 'Pat', amount: 20 },
];
// pot = 60

describe('calculateSoccerProjectedStandings', () => {
  it('per-team blended EV = pot × Σ(roundValue), and per-person rolls up', () => {
    const entries = calculateSoccerProjectedStandings(sold, baseTeams, payoutRules, config, [], []);
    const pat = entries.find((e) => e.participantId === 'u1')!;
    const alpha = pat.teams.find((t) => t.teamId === 1)!;
    const beta = pat.teams.find((t) => t.teamId === 2)!;
    // Alpha = 60 × (0.6×0.10 + 0.6×0.90) = 60 × 0.6 = 36
    expect(alpha.blendedEV).toBeCloseTo(36, 4);
    // Beta = 60 × (0.4×0.10 + 0.4×0.90) = 60 × 0.4 = 24
    expect(beta.blendedEV).toBeCloseTo(24, 4);
    expect(pat.blendedEarnings).toBeCloseTo(60, 4);
    expect(pat.totalSpent).toBe(60);
    expect(pat.projectedPL).toBeCloseTo(0, 4);
  });

  it('uses actual settled earnings for a won round, projects only unsettled rounds', () => {
    const results = [{ team_id: 1, round_key: 'winGroup', result: 'won' }] as unknown as TournamentResult[];
    const entries = calculateSoccerProjectedStandings(sold, baseTeams, payoutRules, config, results, []);
    const alpha = entries.find((e) => e.participantId === 'u1')!.teams.find((t) => t.teamId === 1)!;
    // settled winGroup = 10% × 60 = 6; projected champion = 60 × 0.6 × 0.9 = 32.4; blended = 38.4
    expect(alpha.settledEarnings).toBeCloseTo(6, 4);
    expect(alpha.blendedEV).toBeCloseTo(38.4, 4);
  });

  it('zeroes ladder-round projection for an eliminated team, keeps parallel winGroup', () => {
    // Beta lost the champion (ladder) round → eliminated. winGroup is parallel, still projects.
    const results = [{ team_id: 2, round_key: 'champion', result: 'lost' }] as unknown as TournamentResult[];
    const entries = calculateSoccerProjectedStandings(sold, baseTeams, payoutRules, config, results, []);
    const beta = entries.find((e) => e.participantId === 'u1')!.teams.find((t) => t.teamId === 2)!;
    // champion projected = 0 (eliminated); winGroup projected = 60 × 0.4 × 0.10 = 2.4
    expect(beta.blendedEV).toBeCloseTo(2.4, 4);
  });
});
