import { describe, it, expect } from 'vitest';
import { generateBundles, getBundlePresets } from '../bundles';
import { NFL_SEASON_2026_CONFIG, NFL_SEASON_2026_TEAMS } from '../configs/nfl-season-2026';

describe('NFL bundling', () => {
  it('has its own presets, not the bracket ones', () => {
    const presets = getBundlePresets('nfl');
    expect(presets.light.description).toContain('8');
  });

  it('none returns no bundles', () => {
    expect(generateBundles('none', NFL_SEASON_2026_TEAMS, NFL_SEASON_2026_CONFIG)).toEqual([]);
  });

  it('bundles the weakest teams by expected wins, never a full division', () => {
    const bundles = generateBundles('light', NFL_SEASON_2026_TEAMS, NFL_SEASON_2026_CONFIG);
    const bundled = bundles.flatMap((b) => b.teamIds);

    // The strongest team by expected regular-season wins must never be bundled.
    // (`seed` is division-positional, not a strength rank — see CLAUDE.md.)
    const best = [...NFL_SEASON_2026_TEAMS].sort(
      (a, b) => (b.probabilities?.regularSeasonWins ?? 0) - (a.probabilities?.regularSeasonWins ?? 0)
    )[0];
    expect(bundled).not.toContain(best.id);

    // No complete division (all 4 members) should ever land in the bundled set —
    // that's the defect: seeds 25-32 = NFC South + NFC West in their entirety.
    const bundledSet = new Set(bundled);
    const byGroup = new Map<string, number>();
    for (const team of NFL_SEASON_2026_TEAMS) {
      if (bundledSet.has(team.id)) {
        byGroup.set(team.group, (byGroup.get(team.group) ?? 0) + 1);
      }
    }
    for (const count of byGroup.values()) {
      expect(count).toBeLessThan(4);
    }

    // San Francisco (seed 29) and Seattle (seed 31) are strong teams the old
    // seed-based bundling wrongly swept into the "weakest 8" bucket.
    const niners = NFL_SEASON_2026_TEAMS.find((t) => t.name === 'San Francisco 49ers')!;
    const seahawks = NFL_SEASON_2026_TEAMS.find((t) => t.name === 'Seattle Seahawks')!;
    expect(bundled).not.toContain(niners.id);
    expect(bundled).not.toContain(seahawks.id);

    expect(bundled).toHaveLength(8);
  });

  it('every bundle holds at least two teams', () => {
    for (const preset of ['light', 'standard', 'heavy'] as const) {
      const bundles = generateBundles(preset, NFL_SEASON_2026_TEAMS, NFL_SEASON_2026_CONFIG);
      for (const b of bundles) expect(b.teamIds.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('throws instead of silently falling back to seed when a team has no regularSeasonWins probability', () => {
    // `seed` is division-positional, not a strength rank — falling back to it
    // would silently bundle the STRONGEST teams as if they were the weakest.
    // A missing probability must be a loud failure, not a silent bad bundle.
    const teamsMissingOdds = NFL_SEASON_2026_TEAMS.map((t, i) => {
      if (i !== 0) return t;
      const probs = { ...t.probabilities };
      delete probs.regularSeasonWins;
      return { ...t, probabilities: probs };
    });
    expect(() =>
      generateBundles('light', teamsMissingOdds, NFL_SEASON_2026_CONFIG)
    ).toThrow(/regularSeasonWins/);
  });
});
