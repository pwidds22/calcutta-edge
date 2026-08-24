import { describe, it, expect } from 'vitest';
import { roundBudget } from '../payout-presets';
import { NFL_SEASON_2026_CONFIG } from '../configs/nfl-season-2026';
import { getPayoutPresets } from '../payout-presets';

describe('roundBudget', () => {
  it('uses payoutUnits for a flat-rate round', () => {
    const wins = NFL_SEASON_2026_CONFIG.rounds.find((r) => r.key === 'regularSeasonWins')!;
    expect(roundBudget(wins, 0.1029)).toBeCloseTo(27.99, 2);
  });

  it('falls back to teamsAdvancing for a normal round', () => {
    const div = NFL_SEASON_2026_CONFIG.rounds.find((r) => r.key === 'divisionWinner')!;
    expect(roundBudget(div, 2.0)).toBeCloseTo(16, 5);
  });

  it('the create-form total for the balanced preset reads ~100%, not ~75%', () => {
    const rules = getPayoutPresets('nfl_season_2026').balanced.rules;
    const roundTotal = NFL_SEASON_2026_CONFIG.rounds.reduce(
      (sum, r) => sum + roundBudget(r, rules[r.key] ?? 0), 0
    );
    const propTotal = NFL_SEASON_2026_CONFIG.propBets.reduce((s, p) => s + (rules[p.key] ?? 0), 0);
    expect(roundTotal + propTotal).toBeGreaterThanOrEqual(99.5);
    expect(roundTotal + propTotal).toBeLessThanOrEqual(100.5);
  });
});
