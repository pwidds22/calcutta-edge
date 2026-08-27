import { describe, it, expect } from 'vitest';
import { calculateSettlement } from '../settlement';
import { fullRoundRate, roundBudget } from '@/lib/tournaments/payout-presets';
import { NFL_SEASON_2026_CONFIG } from '@/lib/tournaments/configs/nfl-season-2026';
import { MASTERS_2026_CONFIG } from '@/lib/tournaments/configs/masters-2026';
import type { RoundConfig, TournamentConfig } from '@/lib/tournaments/types';
import type { SoldTeam } from '../use-auction-channel';

describe('fullRoundRate', () => {
  it('is the identity for every round without payoutUnits', () => {
    const configs: TournamentConfig[] = [MASTERS_2026_CONFIG, NFL_SEASON_2026_CONFIG];
    let checked = 0;
    for (const config of configs) {
      for (const round of config.rounds) {
        if (round.payoutUnits !== undefined) continue;
        expect(fullRoundRate(round, 3.75)).toBe(3.75);
        expect(fullRoundRate(round, 0)).toBe(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('scales a per-unit round by its unit count, matching roundBudget', () => {
    const wins = NFL_SEASON_2026_CONFIG.rounds.find((r) => r.key === 'regularSeasonWins')!;
    expect(wins.payoutUnits).toBe(272);
    expect(fullRoundRate(wins, 0.1029)).toBeCloseTo(roundBudget(wins, 0.1029), 10);
    expect(fullRoundRate(wins, 0.1029)).toBeCloseTo(27.9888, 4);
  });

  it('does not use teamsAdvancing as a multiplier for ordinary rounds', () => {
    // roundBudget would return rate * teamsAdvancing here; the payout-preview
    // surfaces want ONE slot's rate, so fullRoundRate must not inherit that.
    const round = { key: 'top5', teamsAdvancing: 5 } as unknown as RoundConfig;
    expect(roundBudget(round, 4)).toBe(20);
    expect(fullRoundRate(round, 4)).toBe(4);
  });
});

describe('calculateSettlement is flat-rate aware', () => {
  const soldTeams: SoldTeam[] = [
    { teamId: 1, winnerId: 'u1', winnerName: 'U1', amount: 400 },
    { teamId: 2, winnerId: 'u2', winnerName: 'U2', amount: 3600 },
  ];
  const baseTeams = [
    { id: 1, name: 'Team 1', seed: 1, group: 'AFC_East' },
    { id: 2, name: 'Team 2', seed: 2, group: 'AFC_East' },
  ];

  it('values the whole 272-win round, not a single win', () => {
    const settlement = calculateSettlement(
      soldTeams,
      baseTeams as never,
      NFL_SEASON_2026_CONFIG,
      NFL_SEASON_2026_CONFIG.defaultPayoutRules
    );
    expect(settlement.actualPot).toBe(4000);

    const wins = settlement.roundLabels.find((r) => r.key === 'regularSeasonWins')!;
    // 0.1029% x 272 units x $4,000 pot = ~$1,119, not $4.12.
    expect(wins.amount).toBeCloseTo(1119.55, 2);
    expect(wins.pct).toBeCloseTo(27.9888, 4);

    const team = settlement.participants
      .flatMap((p) => p.teams)
      .find((t) => t.teamId === 1)!;
    expect(team.roundPayouts.regularSeasonWins).toBeCloseTo(1119.55, 2);
  });

  it('leaves a tournament with no per-unit round byte-for-byte unchanged', () => {
    // Masters: every round pays once, so the unit-aware path must reproduce the
    // old `actualPot * pct / 100` cumulative exactly.
    const rules = MASTERS_2026_CONFIG.defaultPayoutRules;
    const settlement = calculateSettlement(soldTeams, baseTeams as never, MASTERS_2026_CONFIG, rules);

    let expectedCumulative = 0;
    for (const round of MASTERS_2026_CONFIG.rounds) {
      expectedCumulative += settlement.actualPot * ((rules[round.key] ?? 0) / 100);
      const team = settlement.participants
        .flatMap((p) => p.teams)
        .find((t) => t.teamId === 1)!;
      expect(team.roundPayouts[round.key]).toBeCloseTo(expectedCumulative, 10);
      const chip = settlement.roundLabels.find((r) => r.key === round.key)!;
      expect(chip.pct).toBe(rules[round.key] ?? 0);
    }
  });
});
