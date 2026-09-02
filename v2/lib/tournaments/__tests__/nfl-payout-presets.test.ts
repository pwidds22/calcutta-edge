import { describe, it, expect } from 'vitest';
import { getPayoutPresets, roundBudget } from '../payout-presets';
import { NFL_SEASON_2026_CONFIG } from '../configs/nfl-season-2026';
import { getStandardProps, syncPropsFromRules } from '../props';

/**
 * `payout-presets.test.ts` already proves every preset of every tournament sums
 * to 100%. These cover the things a sum cannot: that each NFL structure still
 * MEANS what its label promises, and that the create form can actually seed
 * itself from it.
 */

const PRESETS = getPayoutPresets(NFL_SEASON_2026_CONFIG.id);
const ROUNDS = NFL_SEASON_2026_CONFIG.rounds;
const POSTSEASON_KEYS = [
  'reachDivisional',
  'reachConfChamp',
  'reachSuperBowl',
  'superBowl',
] as const;

function budgetOf(presetKey: string, roundKey: string): number {
  const round = ROUNDS.find((r) => r.key === roundKey)!;
  return roundBudget(round, PRESETS[presetKey].rules[roundKey] ?? 0);
}

describe('NFL preset lineup', () => {
  it('offers a season-only structure alongside the playoff structures', () => {
    expect(Object.keys(PRESETS).sort()).toEqual(
      ['balanced', 'everyWeek', 'seasonOnly', 'topHeavy'].sort()
    );
  });

  it('every preset covers every configured round key', () => {
    // A missing key reads as 0 at runtime, which would silently under-distribute
    // the pot rather than fail — so require the author to state it.
    for (const [name, preset] of Object.entries(PRESETS)) {
      for (const round of ROUNDS) {
        expect(
          preset.rules[round.key],
          `${name} is missing round "${round.key}"`
        ).toBeTypeOf('number');
      }
    }
  });
});

describe('seasonOnly preset', () => {
  it('pays NOTHING after the regular season', () => {
    // The defining property. The 100%-sum test would happily accept a
    // "Season Only" preset that quietly paid the Super Bowl winner.
    for (const key of POSTSEASON_KEYS) {
      expect(PRESETS.seasonOnly.rules[key], `${key} must be 0`).toBe(0);
    }
  });

  it('distributes the whole pot across wins, division, berths and props', () => {
    const wins = budgetOf('seasonOnly', 'regularSeasonWins');
    const division = budgetOf('seasonOnly', 'divisionWinner');
    const berth = budgetOf('seasonOnly', 'playoffBerth');
    const props =
      PRESETS.seasonOnly.rules.bestRecord + PRESETS.seasonOnly.rules.worstRecord;

    expect(wins + division + berth + props).toBeCloseTo(100, 1);
    // Per-win money is the headline of a season-long pool — it must be the
    // single largest share, or the label oversells it.
    expect(wins).toBeGreaterThan(division);
    expect(wins).toBeGreaterThan(berth);
    expect(wins).toBeGreaterThan(props);
  });

  it('uses roundBudget semantics for the per-win round, not the raw rate', () => {
    // The stored rate is the price of ONE win (~0.2%); the round's share of the
    // pot is that times 272. Anyone reading the rate as the round's share would
    // conclude this preset distributes ~7% of the pot.
    const rate = PRESETS.seasonOnly.rules.regularSeasonWins;
    expect(rate).toBeLessThan(1);
    expect(budgetOf('seasonOnly', 'regularSeasonWins')).toBeCloseTo(rate * 272, 10);
    expect(budgetOf('seasonOnly', 'regularSeasonWins')).toBeGreaterThan(50);
  });
});

describe('create-form prop seeding', () => {
  it('every NFL preset enables both record props at a non-zero rate', () => {
    // The create form seeds `enabledPropKeys` from a preset via
    // `syncPropsFromRules`, which only picks up props with a POSITIVE value. A
    // preset that left a prop at 0 would show as selected while writing 0% for
    // it, and the pot would under-distribute by that prop's share.
    const standardProps = getStandardProps(NFL_SEASON_2026_CONFIG.id);
    for (const [name, preset] of Object.entries(PRESETS)) {
      const { enabledKeys, percentages } = syncPropsFromRules(preset.rules, standardProps);
      expect([...enabledKeys].sort(), `${name} prop keys`).toEqual([
        'bestRecord',
        'worstRecord',
      ]);
      expect(percentages.bestRecord).toBeGreaterThan(0);
      expect(percentages.worstRecord).toBeGreaterThan(0);
    }
  });
});
