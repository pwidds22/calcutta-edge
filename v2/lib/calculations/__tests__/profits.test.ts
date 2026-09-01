import { describe, it, expect } from 'vitest';
import { calculateRoundProfits } from '../profits';
import { MARCH_MADNESS_2026_CONFIG } from '@/lib/tournaments/configs/march-madness-2026';
import { NFL_SEASON_2026_CONFIG } from '@/lib/tournaments/configs/nfl-season-2026';
import { WORLD_CUP_2026_CONFIG } from '@/lib/tournaments/configs/world-cup-2026';

const config = MARCH_MADNESS_2026_CONFIG;
const rules = config.defaultPayoutRules;

describe('calculateRoundProfits', () => {
  const potSize = 10000;

  it('returns all positive profits with $0 purchase price', () => {
    const profits = calculateRoundProfits(0, rules, potSize, config);
    for (const round of config.rounds) {
      expect(profits[round.key]).toBeGreaterThan(0);
    }
  });

  it('profits are cumulative (later rounds > earlier rounds)', () => {
    const profits = calculateRoundProfits(0, rules, potSize, config);
    const roundKeys = config.rounds.map((r) => r.key);
    for (let i = 1; i < roundKeys.length; i++) {
      expect(profits[roundKeys[i]]).toBeGreaterThan(profits[roundKeys[i - 1]]);
    }
  });

  it('calculates correct R32 profit', () => {
    // R32 payout = potSize * (0.5 / 100) = $50
    // Profit = $50 - $100 = -$50
    const profits = calculateRoundProfits(100, rules, potSize, config);
    expect(profits['r32']).toBeCloseTo(-50, 2);
  });

  it('calculates correct championship cumulative payout', () => {
    // Cumulative: 50 + 100 + 250 + 400 + 800 + 1600 = 3200
    // Profit = 3200 - 500 = 2700
    const profits = calculateRoundProfits(500, rules, potSize, config);
    let expectedCumulative = 0;
    for (const round of config.rounds) {
      expectedCumulative += potSize * ((rules[round.key] ?? 0) / 100);
    }
    expect(profits['champ']).toBeCloseTo(expectedCumulative - 500, 2);
  });

  it('handles very high purchase price (all profits negative)', () => {
    const profits = calculateRoundProfits(50000, rules, potSize, config);
    for (const round of config.rounds) {
      expect(profits[round.key]).toBeLessThan(0);
    }
  });

  it('handles undefined/NaN purchase price as 0', () => {
    const profits = calculateRoundProfits(NaN, rules, potSize, config);
    expect(profits['r32']).toBeGreaterThan(0);
  });
});

describe('calculateRoundProfits — NFL (flatRate + parallel rounds)', () => {
  const nfl = NFL_SEASON_2026_CONFIG;
  const nflRules = nfl.defaultPayoutRules;
  const pot = 10000;
  const pct = (key: string) => pot * ((nflRules[key] ?? 0) / 100);
  // A team expected to win 10 games.
  const odds = { regularSeasonWins: 10 };

  it('Wins column is the EXPECTED per-win payout, not the price of one win', () => {
    const profits = calculateRoundProfits(0, nflRules, pot, nfl, odds);
    // 10 expected wins × 0.1029% × $10,000 = $102.90 — the old code showed
    // one win's worth ($10.29).
    expect(profits['regularSeasonWins']).toBeCloseTo(pct('regularSeasonWins') * 10, 5);
  });

  it('falls back to one unit when odds are not provided', () => {
    const profits = calculateRoundProfits(0, nflRules, pot, nfl);
    expect(profits['regularSeasonWins']).toBeCloseTo(pct('regularSeasonWins'), 5);
  });

  it('Playoff column excludes the Division payout (wild cards exist)', () => {
    const profits = calculateRoundProfits(0, nflRules, pot, nfl, odds);
    const expectedWinsIncome = pct('regularSeasonWins') * 10;
    expect(profits['playoffBerth']).toBeCloseTo(expectedWinsIncome + pct('playoffBerth'), 5);
  });

  it('Division column = wins income + division + playoff berth (div winners qualify)', () => {
    const profits = calculateRoundProfits(0, nflRules, pot, nfl, odds);
    const expectedWinsIncome = pct('regularSeasonWins') * 10;
    expect(profits['divisionWinner']).toBeCloseTo(
      expectedWinsIncome + pct('divisionWinner') + pct('playoffBerth'),
      5
    );
  });

  it('Champ column = wins income + the full ladder, no Division', () => {
    const profits = calculateRoundProfits(100, nflRules, pot, nfl, odds);
    const ladder = ['playoffBerth', 'reachDivisional', 'reachConfChamp', 'reachSuperBowl', 'superBowl']
      .reduce((s, k) => s + pct(k), 0);
    expect(profits['superBowl']).toBeCloseTo(pct('regularSeasonWins') * 10 + ladder - 100, 5);
  });
});

describe('calculateRoundProfits — World Cup (parallel winGroup)', () => {
  const wc = WORLD_CUP_2026_CONFIG;
  const wcRules = wc.defaultPayoutRules;
  const pot = 10000;
  const pct = (key: string) => pot * ((wcRules[key] ?? 0) / 100);

  it('winGroup column = its own payout + advancing (group winners advance)', () => {
    const profits = calculateRoundProfits(0, wcRules, pot, wc);
    expect(profits['winGroup']).toBeCloseTo(pct('winGroup') + pct('r32'), 5);
  });

  it('champion column no longer includes the winGroup payout', () => {
    const profits = calculateRoundProfits(0, wcRules, pot, wc);
    const ladder = ['r32', 'r16', 'qf', 'sf', 'final', 'champion'].reduce((s, k) => s + pct(k), 0);
    expect(profits['champion']).toBeCloseTo(ladder, 5);
  });
});
