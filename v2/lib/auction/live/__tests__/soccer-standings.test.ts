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

  it('does NOT re-project a decided (LOST) parallel winGroup round', () => {
    // Alpha lost its group (winGroup='lost') but is still alive (champion open) —
    // a 3rd-place advancer. winGroup is resolved, so it must not be re-projected.
    const results = [{ team_id: 1, round_key: 'winGroup', result: 'lost' }] as unknown as TournamentResult[];
    const entries = calculateSoccerProjectedStandings(sold, baseTeams, payoutRules, config, results, []);
    const alpha = entries.find((e) => e.participantId === 'u1')!.teams.find((t) => t.teamId === 1)!;
    // winGroup decided (lost → 0 earned, 0 projected); champion projected = 60 × 0.6 × 0.9 = 32.4
    expect(alpha.settledEarnings).toBeCloseTo(0, 4);
    expect(alpha.blendedEV).toBeCloseTo(32.4, 4);
  });

  it('normalizes under-summing odds so the projection conserves the pot (nets sum to 0)', () => {
    // champion-only config, probs sum to 0.6 (< target 1) — the devig only strips vig,
    // never scales up, so without per-round normalization the projection would lose 40%.
    const consConfig = {
      id: 'cons',
      sport: 'soccer',
      devigStrategy: 'global',
      rounds: [
        { key: 'champion', label: 'C', teamsAdvancing: 1, payoutLabel: 'C', gameLabel: 'C', devigScope: 'global' },
      ],
      groups: [{ key: 'A', label: 'Group A' }],
    } as unknown as TournamentConfig;
    const consTeams = [
      { id: 1, name: 'A', seed: 1, group: 'A', americanOdds: {}, probabilities: { champion: 0.3 } },
      { id: 2, name: 'B', seed: 2, group: 'A', americanOdds: {}, probabilities: { champion: 0.3 } },
    ] as unknown as BaseTeam[];
    const consPayout = { champion: 100 } as unknown as PayoutRules;
    const consSold: SoldTeam[] = [
      { teamId: 1, winnerId: 'u1', winnerName: 'P', amount: 50 },
      { teamId: 2, winnerId: 'u2', winnerName: 'Q', amount: 50 },
    ];
    const entries = calculateSoccerProjectedStandings(consSold, consTeams, consPayout, consConfig, [], []);
    const totalBlended = entries.reduce((s, e) => s + e.blendedEarnings, 0);
    const totalNet = entries.reduce((s, e) => s + e.projectedPL, 0);
    expect(totalBlended).toBeCloseTo(100, 4); // = pot, not 60
    expect(totalNet).toBeCloseTo(0, 4); // zero-sum
  });

  it('does NOT inflate a mid-round winner — the tie adjustment must wait for round completion', () => {
    // Reproduces the Canada bug: a multi-slot ladder round (reach, teamsAdvancing=2)
    // where only ONE of the two eventual winners has been decided. The tie adjustment
    // must NOT hand that single winner the whole round budget — the remaining slot is
    // still pending and is covered by the projection. Pot must stay conserved.
    const midConfig = {
      id: 'mid',
      sport: 'soccer',
      devigStrategy: 'global',
      rounds: [
        { key: 'reach', label: 'R', teamsAdvancing: 2, payoutLabel: 'R', gameLabel: 'R', devigScope: 'global' },
        { key: 'champion', label: 'C', teamsAdvancing: 1, payoutLabel: 'C', gameLabel: 'C', devigScope: 'global' },
      ],
      groups: [{ key: 'A', label: 'Group A' }],
    } as unknown as TournamentConfig;
    // 4 teams: reach probs sum to 2 (= target), champion probs sum to 1 (= target) → devig no-op.
    const midTeams = [
      { id: 1, name: 'T1', seed: 1, group: 'A', americanOdds: {}, probabilities: { reach: 0.5, champion: 0.25 } },
      { id: 2, name: 'T2', seed: 2, group: 'A', americanOdds: {}, probabilities: { reach: 0.5, champion: 0.25 } },
      { id: 3, name: 'T3', seed: 3, group: 'A', americanOdds: {}, probabilities: { reach: 0.5, champion: 0.25 } },
      { id: 4, name: 'T4', seed: 4, group: 'A', americanOdds: {}, probabilities: { reach: 0.5, champion: 0.25 } },
    ] as unknown as BaseTeam[];
    const midPayout = { reach: 25, champion: 50 } as unknown as PayoutRules; // 25×2 + 50×1 = 100
    const midSold: SoldTeam[] = [
      { teamId: 1, winnerId: 'u1', winnerName: 'A', amount: 25 },
      { teamId: 2, winnerId: 'u2', winnerName: 'B', amount: 25 },
      { teamId: 3, winnerId: 'u3', winnerName: 'C', amount: 25 },
      { teamId: 4, winnerId: 'u4', winnerName: 'D', amount: 25 },
    ]; // pot = 100
    // Only team 1 has won 'reach' so far (1 of the 2 slots decided).
    const results = [{ team_id: 1, round_key: 'reach', result: 'won' }] as unknown as TournamentResult[];
    const entries = calculateSoccerProjectedStandings(midSold, midTeams, midPayout, midConfig, results, []);

    const totalBlended = entries.reduce((s, e) => s + e.blendedEarnings, 0);
    const totalNet = entries.reduce((s, e) => s + e.projectedPL, 0);
    expect(totalBlended).toBeCloseTo(100, 4); // pot conserved — NOT 125
    expect(totalNet).toBeCloseTo(0, 4); // zero-sum

    // Team 1 settles its won round at the BASE rate (one slot = 25% × 100 = 25),
    // not the whole 2-slot budget. + projected champion (0.25 × 50% × 100 = 12.5) = 37.5.
    const t1 = entries.find((e) => e.participantId === 'u1')!.teams.find((t) => t.teamId === 1)!;
    expect(t1.settledEarnings).toBeCloseTo(25, 4);
    expect(t1.blendedEV).toBeCloseTo(37.5, 4);
  });

  it('exposes team status on ProjectedTeam (alive / eliminated / champion)', () => {
    // No results → everyone alive (status defaults).
    const noResults = calculateSoccerProjectedStandings(sold, baseTeams, payoutRules, config, [], []);
    for (const t of noResults[0].teams) expect(t.status).toBe('alive');

    // Beta lost the champion (ladder) round → eliminated; Alpha won it → champion.
    const results = [
      { team_id: 1, round_key: 'champion', result: 'won' },
      { team_id: 2, round_key: 'champion', result: 'lost' },
    ] as unknown as TournamentResult[];
    const entries = calculateSoccerProjectedStandings(sold, baseTeams, payoutRules, config, results, []);
    const pat = entries.find((e) => e.participantId === 'u1')!;
    expect(pat.teams.find((t) => t.teamId === 1)!.status).toBe('champion');
    expect(pat.teams.find((t) => t.teamId === 2)!.status).toBe('eliminated');
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
