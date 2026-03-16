import { describe, it, expect } from 'vitest';
import { calculateFairValue, calculateSuggestedBid } from '../values';
import { initializeTeams } from '../initialize';
import { MARCH_MADNESS_2026_TEAMS, MARCH_MADNESS_2026_CONFIG } from '@/lib/tournaments/configs/march-madness-2026';

const config = MARCH_MADNESS_2026_CONFIG;

describe('calculateTeamValues', () => {
  const potSize = 10000;
  const teams = initializeTeams(
    MARCH_MADNESS_2026_TEAMS,
    [],
    config.defaultPayoutRules,
    potSize,
    config
  );

  it('calculates valuePercentage for every team with R32 odds > 0', () => {
    // Teams with nonzero R32 probability should have positive value
    const teamsWithOdds = teams.filter((t) => t.odds['r32'] > 0);
    for (const team of teamsWithOdds) {
      expect(team.valuePercentage).toBeGreaterThan(0);
    }
  });

  it('calculates fairValue = valuePercentage * potSize', () => {
    for (const team of teams) {
      expect(team.fairValue).toBeCloseTo(team.valuePercentage * potSize, 4);
    }
  });

  it('calculates roundValues for all rounds', () => {
    for (const team of teams) {
      // All teams should have at least R32 value (everyone plays first round)
      expect(team.roundValues['r32']).toBeGreaterThanOrEqual(0);
    }
    // Top seeds should have positive champ values
    const topSeeds = teams.filter((t) => t.seed <= 4);
    for (const team of topSeeds) {
      expect(team.roundValues['champ']).toBeGreaterThan(0);
    }
  });

  it('valuePercentage equals sum of all roundValues', () => {
    const roundKeys = config.rounds.map((r) => r.key);
    for (const team of teams) {
      const sum = roundKeys.reduce((s, k) => s + (team.roundValues[k] ?? 0), 0);
      expect(team.valuePercentage).toBeCloseTo(sum, 8);
    }
  });

  it('total of all teams fairValues is close to pot size (within 5%)', () => {
    const totalFairValue = teams.reduce((sum, t) => sum + t.fairValue, 0);
    expect(totalFairValue).toBeGreaterThan(potSize * 0.95);
    expect(totalFairValue).toBeLessThanOrEqual(potSize * 1.05);
  });

  it('1-seeds have higher value than 16-seeds', () => {
    const eastSeed1 = teams.find((t) => t.group === 'East' && t.seed === 1)!;
    const eastSeed16 = teams.find((t) => t.group === 'East' && t.seed === 16)!;
    expect(eastSeed1.valuePercentage).toBeGreaterThan(eastSeed16.valuePercentage);
  });
});

describe('calculateFairValue', () => {
  it('returns valuePercentage * potSize', () => {
    expect(calculateFairValue(0.05, 10000)).toBe(500);
    expect(calculateFairValue(0.01, 50000)).toBe(500);
    expect(calculateFairValue(0, 10000)).toBe(0);
  });
});

describe('calculateSuggestedBid', () => {
  it('returns 95% of fair value', () => {
    expect(calculateSuggestedBid(0.05, 10000)).toBe(475);
    expect(calculateSuggestedBid(0.01, 50000)).toBe(475);
  });

  it('is always less than fair value', () => {
    const bid = calculateSuggestedBid(0.1, 10000);
    const fair = calculateFairValue(0.1, 10000);
    expect(bid).toBeLessThan(fair);
  });
});
