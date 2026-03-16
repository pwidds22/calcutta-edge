import { describe, it, expect } from 'vitest';
import {
  americanOddsToImpliedProbability,
  impliedProbabilityToAmericanOdds,
} from '../odds';
import { MARCH_MADNESS_2026_TEAMS, MARCH_MADNESS_2026_CONFIG } from '@/lib/tournaments/configs/march-madness-2026';
import { initializeTeams } from '../initialize';

const config = MARCH_MADNESS_2026_CONFIG;

describe('americanOddsToImpliedProbability', () => {
  it('converts positive odds (underdog)', () => {
    // +150 → 100 / 250 = 0.4
    expect(americanOddsToImpliedProbability(150)).toBeCloseTo(0.4, 4);
  });

  it('converts negative odds (favorite)', () => {
    // -200 → 200 / 300 = 0.6667
    expect(americanOddsToImpliedProbability(-200)).toBeCloseTo(0.6667, 4);
  });

  it('converts even odds (+100)', () => {
    expect(americanOddsToImpliedProbability(100)).toBeCloseTo(0.5, 4);
  });

  it('converts heavy favorite (-1000)', () => {
    // 1000 / 1100 = 0.9091
    expect(americanOddsToImpliedProbability(-1000)).toBeCloseTo(0.9091, 4);
  });

  it('converts big underdog (+5000)', () => {
    // 100 / 5100 = 0.0196
    expect(americanOddsToImpliedProbability(5000)).toBeCloseTo(0.0196, 4);
  });
});

describe('impliedProbabilityToAmericanOdds', () => {
  it('converts probability < 0.5 to positive odds', () => {
    // 0.4 → (100/0.4) - 100 = 150
    expect(impliedProbabilityToAmericanOdds(0.4)).toBe(150);
  });

  it('converts probability > 0.5 to negative odds', () => {
    // 0.6667 → -(66.67) / (0.3333) ≈ -200
    expect(impliedProbabilityToAmericanOdds(0.6667)).toBeCloseTo(-200, 0);
  });

  it('returns 0 for invalid probabilities', () => {
    expect(impliedProbabilityToAmericanOdds(0)).toBe(0);
    expect(impliedProbabilityToAmericanOdds(1)).toBe(0);
    expect(impliedProbabilityToAmericanOdds(-0.1)).toBe(0);
    expect(impliedProbabilityToAmericanOdds(1.1)).toBe(0);
  });
});

describe('calculateImpliedProbabilities + devigging', () => {
  const teams = initializeTeams(
    MARCH_MADNESS_2026_TEAMS,
    [],
    config.defaultPayoutRules,
    10000,
    config
  );

  it('populates rawImpliedProbabilities for all teams', () => {
    for (const team of teams) {
      // All teams should have at least some R32 probability
      expect(team.rawImpliedProbabilities['r32']).toBeGreaterThanOrEqual(0);
    }
    // Top seeds should have champ probability
    const topSeeds = teams.filter((t) => t.seed <= 4);
    for (const team of topSeeds) {
      expect(team.rawImpliedProbabilities['champ']).toBeGreaterThan(0);
    }
  });

  it('populates odds for all teams', () => {
    for (const team of teams) {
      expect(team.odds['r32']).toBeGreaterThanOrEqual(0);
    }
    const topSeeds = teams.filter((t) => t.seed <= 4);
    for (const team of topSeeds) {
      expect(team.odds['champ']).toBeGreaterThan(0);
    }
  });

  it('R32 matchup pairs probabilities are reasonable', () => {
    const eastTeams = teams.filter((t) => t.group === 'East');
    const seed1 = eastTeams.find((t) => t.seed === 1)!;
    const seed16 = eastTeams.find((t) => t.seed === 16)!;
    // 1-seed should be heavily favored over 16-seed
    expect(seed1.odds['r32']).toBeGreaterThan(0.95);
    expect(seed16.odds['r32']).toBeLessThan(0.05);
  });

  it('championship probabilities sum to ~1.0 across all teams', () => {
    const totalChamp = teams.reduce((sum, t) => sum + t.odds['champ'], 0);
    // Model probabilities should sum close to 1.0
    expect(totalChamp).toBeGreaterThan(0.90);
    expect(totalChamp).toBeLessThanOrEqual(1.05);
  });

  it('round probabilities decrease monotonically (r32 >= s16 >= ... >= champ)', () => {
    const roundKeys = config.rounds.map((r) => r.key);
    for (const team of teams) {
      for (let i = 1; i < roundKeys.length; i++) {
        expect(team.odds[roundKeys[i - 1]]).toBeGreaterThanOrEqual(
          team.odds[roundKeys[i]] - 0.0001
        );
      }
    }
  });

  it('devigged R32 probability is reasonable relative to raw', () => {
    for (const team of teams) {
      expect(team.odds['r32']).toBeGreaterThan(0);
      expect(team.odds['r32']).toBeLessThanOrEqual(1);
    }
  });

  it('1-seeds have highest championship odds in their region', () => {
    for (const group of config.groups) {
      const groupTeams = teams.filter((t) => t.group === group.key);
      const seed1 = groupTeams.find((t) => t.seed === 1)!;
      for (const other of groupTeams) {
        if (other.seed !== 1) {
          expect(seed1.odds['champ']).toBeGreaterThan(other.odds['champ']);
        }
      }
    }
  });
});
