import { describe, it, expect } from 'vitest';
import { calculateSettlement } from '../settlement';
import { roundBudget } from '@/lib/tournaments/payout-presets';
import {
  NFL_SEASON_2026_CONFIG,
  NFL_SEASON_2026_TEAMS,
} from '@/lib/tournaments/configs/nfl-season-2026';
import { MASTERS_2026_CONFIG } from '@/lib/tournaments/configs/masters-2026';
import type { RoundConfig } from '@/lib/tournaments/types';
import type { SoldTeam } from '../use-auction-channel';

/**
 * The distinction these tests exist to protect:
 *
 *   roundBudget(winsRound, 0.1029) = 27.9888%  — the LEAGUE-WIDE share of the
 *     pot that all 272 regular-season wins pay out between all 32 teams.
 *   one team's Wins payout                     — that team's OWN expected wins
 *     (Bills ~10.34) times the per-win rate.
 *
 * They differ by roughly the number of teams (~32x). An earlier version of the
 * settlement calculator fed the league-wide figure into the per-team profit
 * matrix, so every NFL owner was shown ~32x their real season income, and the
 * previous version of this file asserted that as correct. Any change that
 * reintroduces it must turn these red.
 */

const POT = 4000;
const soldTeams: SoldTeam[] = [
  { teamId: 1, winnerId: 'u1', winnerName: 'U1', amount: 400 },
  { teamId: 2, winnerId: 'u2', winnerName: 'U2', amount: 3600 },
];

/** Fixture teams with NO odds at all — exercises the 1-unit fallback path. */
const oddlessTeams = [
  { id: 1, name: 'Team 1', seed: 1, group: 'AFC_East' },
  { id: 2, name: 'Team 2', seed: 2, group: 'AFC_East' },
];

function teamPayouts(settlement: ReturnType<typeof calculateSettlement>, teamId: number) {
  return settlement.participants.flatMap((p) => p.teams).find((t) => t.teamId === teamId)!
    .roundPayouts;
}

describe('roundBudget stays the league-wide figure', () => {
  it('scales a per-unit round by its unit count', () => {
    const wins = NFL_SEASON_2026_CONFIG.rounds.find((r) => r.key === 'regularSeasonWins')!;
    expect(wins.payoutUnits).toBe(272);
    expect(roundBudget(wins, 0.1029)).toBeCloseTo(27.9888, 4);
  });

  it('uses teamsAdvancing when a round has no payoutUnits', () => {
    const round = { key: 'top5', teamsAdvancing: 5 } as unknown as RoundConfig;
    expect(roundBudget(round, 4)).toBe(20);
  });
});

describe('calculateSettlement — NFL per-unit round', () => {
  const rules = NFL_SEASON_2026_CONFIG.defaultPayoutRules;
  const perWin = POT * (rules.regularSeasonWins / 100);

  it("pays a team for its OWN expected wins, not the whole league's 272", () => {
    const settlement = calculateSettlement(
      soldTeams,
      NFL_SEASON_2026_TEAMS,
      NFL_SEASON_2026_CONFIG,
      rules
    );
    expect(settlement.actualPot).toBe(POT);

    // Team id 1 is the Bills: ~10.34 expected wins in the shipped Kalshi odds.
    const bills = NFL_SEASON_2026_TEAMS.find((t) => t.id === 1)!;
    const expectedWins = bills.probabilities!.regularSeasonWins;
    expect(expectedWins).toBeGreaterThan(9);
    expect(expectedWins).toBeLessThan(12);

    const payouts = teamPayouts(settlement, 1);
    expect(payouts.regularSeasonWins).toBeCloseTo(perWin * expectedWins, 6);

    // The specific wrong number this replaces: rate x 272 x pot = $1,119.55.
    const leagueWideBudget = POT * (roundBudget(
      NFL_SEASON_2026_CONFIG.rounds[0], rules.regularSeasonWins
    ) / 100);
    expect(leagueWideBudget).toBeCloseTo(1119.55, 2);
    expect(payouts.regularSeasonWins).toBeLessThan(leagueWideBudget / 10);
  });

  it('prices a team with no odds at one unit rather than at the whole round', () => {
    const settlement = calculateSettlement(
      soldTeams,
      oddlessTeams as never,
      NFL_SEASON_2026_CONFIG,
      rules
    );
    expect(teamPayouts(settlement, 1).regularSeasonWins).toBeCloseTo(perWin, 10);
  });

  it('does not leak the parallel Division bonus into later ladder columns', () => {
    const settlement = calculateSettlement(
      soldTeams,
      NFL_SEASON_2026_TEAMS,
      NFL_SEASON_2026_CONFIG,
      rules
    );
    const payouts = teamPayouts(settlement, 1);
    const baseline = perWin * NFL_SEASON_2026_TEAMS[0].probabilities!.regularSeasonWins;
    const berth = POT * (rules.playoffBerth / 100);
    const division = POT * (rules.divisionWinner / 100);
    const divisionalRung = POT * (rules.reachDivisional / 100);

    // Winning the division implies making the playoffs, so that column carries
    // its own bonus plus the first ladder rung.
    expect(payouts.divisionWinner).toBeCloseTo(baseline + division + berth, 6);
    // But a wild card reaches the divisional round without a division title —
    // so the ladder column must NOT include the division bonus.
    expect(payouts.reachDivisional).toBeCloseTo(baseline + berth + divisionalRung, 6);
    expect(payouts.reachDivisional).not.toBeCloseTo(
      baseline + berth + divisionalRung + division,
      6
    );
  });

  it('does not warn that a correct NFL structure fails to reach 100%', () => {
    const warnings: unknown[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      calculateSettlement(soldTeams, NFL_SEASON_2026_TEAMS, NFL_SEASON_2026_CONFIG, rules);
    } finally {
      console.warn = original;
    }
    // A raw sum of the stored rates is 26.6% for NFL and used to warn every time.
    expect(warnings).toEqual([]);
  });
});

describe('calculateSettlement — payout-structure chips', () => {
  it('quotes the per-unit price and labels the unit for a flat-rate round', () => {
    const rules = NFL_SEASON_2026_CONFIG.defaultPayoutRules;
    const settlement = calculateSettlement(
      soldTeams,
      NFL_SEASON_2026_TEAMS,
      NFL_SEASON_2026_CONFIG,
      rules
    );
    const wins = settlement.roundLabels.find((r) => r.key === 'regularSeasonWins')!;
    expect(wins.pct).toBeCloseTo(rules.regularSeasonWins, 10);
    expect(wins.amount).toBeCloseTo(POT * (rules.regularSeasonWins / 100), 10);
    expect(wins.unitSuffix).toBe('per win');

    // Ordinary rounds pay once per team and carry no unit suffix.
    const champ = settlement.roundLabels.find((r) => r.key === 'superBowl')!;
    expect(champ.pct).toBeCloseTo(rules.superBowl, 10);
    expect(champ.unitSuffix).toBeUndefined();
  });
});

describe('calculateSettlement — tournaments without a per-unit round', () => {
  it('reproduces the plain cumulative for Masters exactly', () => {
    const rules = MASTERS_2026_CONFIG.defaultPayoutRules;
    const settlement = calculateSettlement(
      soldTeams,
      oddlessTeams as never,
      MASTERS_2026_CONFIG,
      rules
    );

    let expectedCumulative = 0;
    for (const round of MASTERS_2026_CONFIG.rounds) {
      expectedCumulative += settlement.actualPot * ((rules[round.key] ?? 0) / 100);
      expect(teamPayouts(settlement, 1)[round.key]).toBeCloseTo(expectedCumulative, 10);
      const chip = settlement.roundLabels.find((r) => r.key === round.key)!;
      expect(chip.pct).toBe(rules[round.key] ?? 0);
      expect(chip.unitSuffix).toBeUndefined();
    }
  });
});
