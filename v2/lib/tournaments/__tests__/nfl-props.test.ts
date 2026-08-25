import { describe, it, expect } from 'vitest';
import { getStandardProps, syncPropsFromRules } from '../props';
import { getPayoutPresets } from '../payout-presets';
import { NFL_SEASON_2026_CONFIG } from '../configs/nfl-season-2026';

describe('NFL props', () => {
  it('returns props for the NFL season tournament', () => {
    const props = getStandardProps('nfl_season_2026');
    expect(props.map((p) => p.key)).toEqual(['bestRecord', 'worstRecord']);
  });

  it('prop keys match the config exactly, or the pot silently under-distributes', () => {
    const configKeys = NFL_SEASON_2026_CONFIG.propBets.map((p) => p.key).sort();
    const propKeys = getStandardProps('nfl_season_2026').map((p) => p.key).sort();
    expect(propKeys).toEqual(configKeys);
  });

  it('does not leak NFL props into other sports', () => {
    expect(getStandardProps('world_cup_2026').some((p) => p.key === 'bestRecord')).toBe(false);
  });
});

describe('syncPropsFromRules — create-session form default prop state (regression)', () => {
  // The create-session form renders the "Balanced" preset as selected on page
  // load, but historically only synced enabled props into state on a preset
  // CLICK, not on initial mount. NFL's Balanced preset enables bestRecord +
  // worstRecord (3% each = 6%) — with no click, those two props stayed
  // un-enabled, the total showed 94% in amber, and submitting wrote 0% for
  // both, leaving 6% of the pot with no rule to claim it.
  it("NFL's balanced preset enables bestRecord + worstRecord totaling 6%", () => {
    const balancedRules = getPayoutPresets('nfl_season_2026').balanced.rules;
    const standardProps = getStandardProps('nfl_season_2026');
    const { enabledKeys, percentages } = syncPropsFromRules(balancedRules, standardProps);

    expect(enabledKeys).toEqual(new Set(['bestRecord', 'worstRecord']));
    const total = [...enabledKeys].reduce((sum, key) => sum + (percentages[key] ?? 0), 0);
    expect(total).toBeCloseTo(6, 5);
  });

  it('other sports whose balanced preset has zero-valued props enable none', () => {
    // Regression guard: this must stay behavior-neutral for every non-NFL
    // tournament — golf and World Cup's balanced presets zero out their props.
    for (const id of ['masters_2026', 'world_cup_2026', 'march_madness_2026']) {
      const balancedRules = getPayoutPresets(id).balanced.rules;
      const standardProps = getStandardProps(id);
      const { enabledKeys } = syncPropsFromRules(balancedRules, standardProps);
      expect(enabledKeys.size).toBe(0);
    }
  });

  it('a prop present but zero-valued is not enabled', () => {
    const { enabledKeys } = syncPropsFromRules(
      { bestRecord: 0, worstRecord: 3 },
      getStandardProps('nfl_season_2026')
    );
    expect(enabledKeys).toEqual(new Set(['worstRecord']));
  });
});
