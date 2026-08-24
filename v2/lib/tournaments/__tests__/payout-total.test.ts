import { describe, it, expect } from 'vitest';
import { roundBudget, dollarsToRate, rateToDollars } from '../payout-presets';
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

describe('dollarsToRate / rateToDollars (create-form flat-rate $ field)', () => {
  it('does not zero out the rate when the pot is 0 — returns null instead', () => {
    // A host who clears the "Estimated Pot Size" field to retype it hits pot === 0.
    // Any keystroke in the dollars-per-win field must not resolve to a 0% rate and
    // silently discard whatever rate was already stored.
    expect(dollarsToRate(4.12, 0)).toBeNull();
    expect(dollarsToRate(0, 0)).toBeNull();
    expect(dollarsToRate(4.12, -100)).toBeNull();
  });

  it('rateToDollars is 0 (not NaN/Infinity) when the pot is unusable', () => {
    expect(rateToDollars(0.1029, 0)).toBe(0);
    expect(rateToDollars(0.1029, -100)).toBe(0);
  });

  it('round-trips dollars -> stored percentage -> dollars for a real pot', () => {
    const pot = 10000;
    const dollarsIn = 4.12;
    const pct = dollarsToRate(dollarsIn, pot);
    expect(pct).not.toBeNull();
    const dollarsOut = rateToDollars(pct as number, pot);
    // toFixed(2) is what the create-form input displays, so that's the precision
    // that matters: the host should see the exact amount they typed come back.
    expect(dollarsOut.toFixed(2)).toBe('4.12');
  });

  it('round-trips a real NFL per-win rate back to a sane dollar amount', () => {
    const pot = 10000;
    const wins = NFL_SEASON_2026_CONFIG.rounds.find((r) => r.key === 'regularSeasonWins')!;
    const rules = getPayoutPresets('nfl_season_2026').balanced.rules;
    const storedRate = rules[wins.key] ?? 0;
    const dollars = rateToDollars(storedRate, pot);
    const backToRate = dollarsToRate(Number(dollars.toFixed(2)), pot);
    expect(backToRate).not.toBeNull();
    expect(backToRate as number).toBeCloseTo(storedRate, 2);
  });
});
