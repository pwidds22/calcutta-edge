import { describe, it, expect } from 'vitest';
import { payingRounds } from '../rounds';
import {
  NFL_SEASON_2026_CONFIG,
  NFL_SEASON_2026_TEAMS,
} from '@/lib/tournaments/configs/nfl-season-2026';
import { getPayoutPresets } from '@/lib/tournaments/payout-presets';
import { initializeTeams } from '../initialize';

const PRESETS = getPayoutPresets(NFL_SEASON_2026_CONFIG.id);

describe('payingRounds', () => {
  it('drops the postseason ladder from a season-only league', () => {
    // The reported confusion: a league paying only for wins, division titles
    // and playoff berths still showed Div Rd / Conf Ch / SB / Champ beside its
    // fair value, styled identically to the rounds that actually pay.
    const shown = payingRounds(NFL_SEASON_2026_CONFIG, PRESETS.seasonOnly.rules);
    expect(shown.map((r) => r.key)).toEqual([
      'regularSeasonWins',
      'divisionWinner',
      'playoffBerth',
    ]);
  });

  it('keeps every round for a league that pays across the whole ladder', () => {
    const shown = payingRounds(NFL_SEASON_2026_CONFIG, PRESETS.balanced.rules);
    expect(shown.map((r) => r.key)).toEqual(NFL_SEASON_2026_CONFIG.rounds.map((r) => r.key));
  });

  it('falls back to every round when nothing pays at all', () => {
    // An all-zero structure means the league is unconfigured, not season-only.
    // Blanking the strip would hide the very data that makes that diagnosable.
    const allZero = Object.fromEntries(
      NFL_SEASON_2026_CONFIG.rounds.map((r) => [r.key, 0])
    );
    expect(payingRounds(NFL_SEASON_2026_CONFIG, allZero)).toHaveLength(
      NFL_SEASON_2026_CONFIG.rounds.length
    );
  });

  it('is inert when config or rules are missing', () => {
    expect(payingRounds(undefined, PRESETS.seasonOnly.rules)).toEqual([]);
    expect(payingRounds(null, null)).toEqual([]);
    expect(payingRounds(NFL_SEASON_2026_CONFIG, undefined)).toHaveLength(
      NFL_SEASON_2026_CONFIG.rounds.length
    );
  });
});

describe('hiding a round changes nothing about the money', () => {
  it('fair value already excludes zero-rate rounds, so the filter is display-only', () => {
    // This is the claim the UI change rests on: the hidden rounds were already
    // worth exactly nothing. If this ever stops being true, hiding them would
    // conceal real value rather than remove noise.
    const POT = 5000;
    const rules = PRESETS.seasonOnly.rules;
    const teams = initializeTeams(
      NFL_SEASON_2026_TEAMS,
      [],
      rules,
      POT,
      NFL_SEASON_2026_CONFIG
    );
    const bills = teams.find((t) => t.name === 'Buffalo Bills')!;

    const hidden = NFL_SEASON_2026_CONFIG.rounds.filter(
      (r) => !payingRounds(NFL_SEASON_2026_CONFIG, rules).some((p) => p.key === r.key)
    );
    expect(hidden.map((r) => r.key)).toEqual([
      'reachDivisional',
      'reachConfChamp',
      'reachSuperBowl',
      'superBowl',
    ]);

    // Every hidden round has real odds but contributes zero value.
    for (const round of hidden) {
      expect(bills.odds[round.key]).toBeGreaterThan(0);
      expect(bills.roundValues[round.key]).toBe(0);
    }

    // And fair value equals the sum of the VISIBLE rounds alone.
    const visibleTotal = payingRounds(NFL_SEASON_2026_CONFIG, rules).reduce(
      (sum, r) => sum + POT * bills.roundValues[r.key],
      0
    );
    expect(bills.fairValue).toBeCloseTo(visibleTotal, 10);
  });
});
