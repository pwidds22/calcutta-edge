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

  it('bundles the WEAKEST teams, never a division', () => {
    const bundles = generateBundles('light', NFL_SEASON_2026_TEAMS, NFL_SEASON_2026_CONFIG);
    const bundled = bundles.flatMap((b) => b.teamIds);
    // The strongest team by seed must never be bundled.
    const best = [...NFL_SEASON_2026_TEAMS].sort((a, b) => a.seed - b.seed)[0];
    expect(bundled).not.toContain(best.id);
    expect(bundled).toHaveLength(8);
  });

  it('every bundle holds at least two teams', () => {
    for (const preset of ['light', 'standard', 'heavy'] as const) {
      const bundles = generateBundles(preset, NFL_SEASON_2026_TEAMS, NFL_SEASON_2026_CONFIG);
      for (const b of bundles) expect(b.teamIds.length).toBeGreaterThanOrEqual(2);
    }
  });
});
