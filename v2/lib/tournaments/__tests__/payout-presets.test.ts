import { describe, it, expect } from 'vitest';
import { getPayoutPresets } from '../payout-presets';
import { listTournamentsWithTeams } from '../registry';

/**
 * Every payout preset must sum to exactly 100% (within ±0.5% tolerance to allow
 * for clean per-golfer rates that don't divide perfectly into the tier shares).
 *
 * Sum formula: sum over rounds of (rate × teamsAdvancing) + sum of prop rates.
 *
 * Why this matters: the create-session form's "Total payout" indicator turns
 * amber when the sum diverges from 100%. A preset that doesn't sum to 100%
 * either over-distributes the pot (impossible — would short-pay winners) or
 * under-distributes (extra cash sits in the pot with no rule to claim it).
 *
 * This test catches regressions like the one that triggered its creation:
 * pga_championship_2026 was reusing MASTERS_PAYOUT_PRESETS, but PGA cuts at
 * 70 (vs Masters' 50), so the makeCut tier share went from 5% to 7% and the
 * Balanced preset summed to 102%.
 */
describe('payout presets sum to 100%', () => {
  const tournaments = listTournamentsWithTeams();

  for (const { config } of tournaments) {
    describe(config.id, () => {
      const presets = getPayoutPresets(config.id);
      const roundKeys = new Set(config.rounds.map((r) => r.key));

      for (const [presetName, preset] of Object.entries(presets)) {
        it(`${presetName} preset sums to 100%`, () => {
          // Round portion: each round's per-team-rate × teamsAdvancing.
          const roundTotal = config.rounds.reduce((sum, round) => {
            const rate = preset.rules[round.key] ?? 0;
            return sum + rate * round.teamsAdvancing;
          }, 0);

          // Prop portion: rates are absolute percentages of the pot (no
          // multiplication). Any key in the rules dict that isn't a round key
          // is treated as a prop.
          const propTotal = Object.entries(preset.rules)
            .filter(([key]) => !roundKeys.has(key))
            .reduce((sum, [, rate]) => sum + rate, 0);

          const total = roundTotal + propTotal;
          // 0.5% tolerance matches the create-session-form's "green/amber" boundary.
          expect(total).toBeGreaterThanOrEqual(99.5);
          expect(total).toBeLessThanOrEqual(100.5);
        });
      }
    });
  }
});
