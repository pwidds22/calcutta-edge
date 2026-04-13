import { describe, it, expect } from 'vitest';
import {
  adjustPayoutRulesForTies,
  countWinnersPerRound,
  calculateTeamEarnings,
  getTeamStatus,
  buildPlayInLoserSet,
  calculateLeaderboard,
} from '../actual-payouts';
import type { PayoutRules, TournamentConfig } from '@/lib/tournaments/types';
import type { TournamentResult } from '@/actions/tournament-results';
import type { SoldTeam } from '../use-auction-channel';

// Masters-like config
const payoutRules: PayoutRules = {
  makeCut: 0.2,
  top20: 0.5,
  top10: 1.5,
  top5: 4.0,
  winner: 45.0,
};

const config = {
  id: 'test',
  name: 'Test Golf',
  sport: 'golf',
  rounds: [
    { key: 'makeCut', label: 'Cut', teamsAdvancing: 50, payoutLabel: 'Cut', gameLabel: 'Cut' },
    { key: 'top20', label: 'T20', teamsAdvancing: 20, payoutLabel: 'T20', gameLabel: 'T20' },
    { key: 'top10', label: 'T10', teamsAdvancing: 10, payoutLabel: 'T10', gameLabel: 'T10' },
    { key: 'top5', label: 'T5', teamsAdvancing: 5, payoutLabel: 'T5', gameLabel: 'T5' },
    { key: 'winner', label: 'Win', teamsAdvancing: 1, payoutLabel: 'Win', gameLabel: 'Win' },
  ],
  groups: [],
  devigStrategy: 'global',
  defaultPayoutRules: payoutRules,
  defaultPotSize: 733,
  teamLabel: 'Golfer',
  groupLabel: 'Tier',
} as unknown as TournamentConfig;

function buildTestData(positions: number[]) {
  const results: TournamentResult[] = [];
  const soldTeams: SoldTeam[] = [];
  const baseTeams = [];
  const pot = 733;

  for (let i = 0; i < positions.length; i++) {
    const teamId = i + 1;
    const pos = positions[i];
    soldTeams.push({
      teamId,
      winnerId: `user${i}`,
      winnerName: `User ${i}`,
      amount: Math.round(pot / positions.length),
    });
    baseTeams.push({ id: teamId, name: `Player ${i}`, seed: i + 1, group: 'test' });

    for (const tier of config.rounds) {
      results.push({
        team_id: teamId,
        round_key: tier.key,
        result: pos <= tier.teamsAdvancing ? 'won' : 'lost',
      });
    }
  }

  return { results, soldTeams, baseTeams, actualPot: soldTeams.reduce((s, t) => s + t.amount, 0) };
}

describe('Tie-adjusted payouts', () => {
  it('should not exceed pot when ties cause extra winners', () => {
    // 7 in top5 (expected 5), 12 in top10 (expected 10), 22 in top20 (expected 20)
    const positions = [
      1, 2, 3, 4, 5, 5, 5,
      8, 9, 10, 10, 10,
      13, 14, 15, 16, 17, 18, 19, 20, 20, 20,
      25, 30, 40, 55,
    ];

    const { results, soldTeams, baseTeams, actualPot } = buildTestData(positions);
    const playInLosers = buildPlayInLoserSet(baseTeams as any, results, config);
    const winnersPerRound = countWinnersPerRound(soldTeams, results, config, playInLosers);
    const adjusted = adjustPayoutRulesForTies(payoutRules, winnersPerRound, config);

    let totalDistributed = 0;
    for (const s of soldTeams) {
      const st = getTeamStatus(s.teamId, results, config);
      totalDistributed += calculateTeamEarnings(st.roundsWon, actualPot, adjusted);
    }

    // Total should not exceed pot
    expect(totalDistributed).toBeLessThanOrEqual(actualPot + 0.01);

    // Budget for each tier should stay constant
    // top5 budget = 4.0% * 5 = 20%
    expect(adjusted.top5! * 7).toBeCloseTo(payoutRules.top5! * 5, 6);
    // top10 budget = 1.5% * 10 = 15%
    expect(adjusted.top10! * 12).toBeCloseTo(payoutRules.top10! * 10, 6);
    // top20 budget = 0.5% * 20 = 10%
    expect(adjusted.top20! * 22).toBeCloseTo(payoutRules.top20! * 20, 6);
  });

  it('should not adjust when no ties exceed teamsAdvancing', () => {
    // Exact counts: 5 in top5, 10 in top10, 20 in top20
    const positions = [
      1, 2, 3, 4, 5,
      6, 7, 8, 9, 10,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      25, 30, 40, 55,
    ];

    const { results, soldTeams, baseTeams, actualPot } = buildTestData(positions);
    const playInLosers = buildPlayInLoserSet(baseTeams as any, results, config);
    const winnersPerRound = countWinnersPerRound(soldTeams, results, config, playInLosers);
    const adjusted = adjustPayoutRulesForTies(payoutRules, winnersPerRound, config);

    // No adjustment needed — rules should be identical
    expect(adjusted.top5).toBe(payoutRules.top5);
    expect(adjusted.top10).toBe(payoutRules.top10);
    expect(adjusted.top20).toBe(payoutRules.top20);
  });

  it('calculateLeaderboard total distributed should not exceed pot', () => {
    const positions = [
      1, 2, 3, 4, 5, 5, 5,
      8, 9, 10, 10, 10,
      13, 14, 15, 16, 17, 18, 19, 20, 20, 20,
      25, 30, 40, 55,
    ];

    const { results, soldTeams, baseTeams } = buildTestData(positions);
    const leaderboard = calculateLeaderboard(soldTeams, baseTeams as any, results, config, payoutRules);
    const totalDistributed = leaderboard.entries.reduce((s, e) => s + e.totalEarned, 0);

    expect(totalDistributed).toBeLessThanOrEqual(leaderboard.actualPot + 0.01);
  });

  it('prop with multi-team winner should pay all winning slots, not just one', () => {
    // One participant owns 2 of 3 winning teams in a prop.
    // They should get 2/3, not 1/3.
    const positions = [1, 2, 3, 10, 20, 55];
    const { results, soldTeams, baseTeams } = buildTestData(positions);

    // Give user0 two teams (team 1 and team 2)
    soldTeams[1].winnerId = 'user0';
    soldTeams[1].winnerName = 'User 0';

    const propResults = [{
      key: 'lowRound',
      label: 'Low Round',
      winnerParticipantId: null,
      winnerTeamId: null,
      winners: [
        { participantId: 'user0', teamId: 1 },
        { participantId: 'user0', teamId: 2 },  // same participant, different team
        { participantId: 'user2', teamId: 3 },
      ],
      metadata: '',
      payoutPercentage: 3,
    }];

    const leaderboard = calculateLeaderboard(
      soldTeams, baseTeams as any, results, config, payoutRules, propResults
    );
    const totalDistributed = leaderboard.entries.reduce((s, e) => s + e.totalEarned, 0);

    // Full prop payout should be distributed (not lose 1/3 due to some() bug)
    const roundsTotal = leaderboard.entries.reduce(
      (s, e) => s + e.teams.reduce((ts, t) => ts + t.earnings, 0), 0
    );
    const propsTotal = totalDistributed - roundsTotal;
    const expectedPropTotal = leaderboard.actualPot * 3 / 100;
    expect(propsTotal).toBeCloseTo(expectedPropTotal, 2);

    // user0 should get 2/3 of prop, user2 should get 1/3
    const user0 = leaderboard.entries.find((e) => e.participantId === 'user0')!;
    const user2 = leaderboard.entries.find((e) => e.participantId === 'user2')!;
    expect(user0.propEarnings[0].amount).toBeCloseTo(expectedPropTotal * 2 / 3, 2);
    expect(user2.propEarnings[0].amount).toBeCloseTo(expectedPropTotal * 1 / 3, 2);
  });

  it('DISTRIBUTED should equal POT exactly when all tiers are settled', () => {
    // Simulate a realistic Masters scenario:
    // - fewer sold golfers in some tiers than teamsAdvancing (unsold golfers fill spots)
    // - ties causing extra winners in other tiers
    // POT and DISTRIBUTED must match exactly.
    const positions = [
      1,                           // 1 winner (expected 1) ✓
      3, 4, 5, 5, 5,              // 5 in top5 but one is unsold (3 sold in top5, expected 5)
      7, 8, 10, 10,               // ties at T10 boundary (9 sold in top10, expected 10)
      12, 15, 18, 20, 20, 20, 20, // ties at T20 boundary (16 sold in top20, expected 20)
      25, 30, 35, 40, 45, 50,     // made cut but below T20
      55, 60, 70, 80,             // missed cut
    ];

    const { results, soldTeams, baseTeams, actualPot } = buildTestData(positions);
    const leaderboard = calculateLeaderboard(soldTeams, baseTeams as any, results, config, payoutRules);
    const totalDistributed = leaderboard.entries.reduce((s, e) => s + e.totalEarned, 0);

    // DISTRIBUTED must equal POT — this is the user's core requirement
    expect(totalDistributed).toBeCloseTo(actualPot, 2);
  });
});
