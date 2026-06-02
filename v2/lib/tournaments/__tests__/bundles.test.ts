import { describe, it, expect } from 'vitest';
import {
  detectPlayInBundles,
  deriveBundleLabel,
  generateBundles,
  getUnbundledTeams,
  countAuctionItems,
} from '../bundles';
import type { BaseTeam, TeamBundle } from '../types';
import {
  MARCH_MADNESS_2026_TEAMS,
  MARCH_MADNESS_2026_CONFIG,
} from '../configs/march-madness-2026';
import {
  WORLD_CUP_2026_TEAMS,
  WORLD_CUP_2026_CONFIG,
} from '../configs/world-cup-2026';

const teams = MARCH_MADNESS_2026_TEAMS;
const config = MARCH_MADNESS_2026_CONFIG;

describe('detectPlayInBundles', () => {
  it('finds the 4 play-in matchups', () => {
    const bundles = detectPlayInBundles(teams, config);
    expect(bundles).toHaveLength(4);

    // Verify the expected play-in matchups exist
    const bundleKeys = bundles.map((b) => b.id).sort();
    expect(bundleKeys).toEqual([
      'playin-Midwest-11',
      'playin-Midwest-16',
      'playin-South-16',
      'playin-West-11',
    ]);
  });

  it('West 11-seed play-in contains Texas and NC State', () => {
    const bundles = detectPlayInBundles(teams, config);
    const west11 = bundles.find((b) => b.id === 'playin-West-11')!;
    expect(west11.teamIds).toHaveLength(2);

    const teamNames = west11.teamIds.map(
      (id) => teams.find((t) => t.id === id)!.name
    );
    expect(teamNames).toContain('Texas');
    expect(teamNames).toContain('NC State');
  });

  it('Midwest 16-seed play-in contains UMBC and Howard', () => {
    const bundles = detectPlayInBundles(teams, config);
    const mw16 = bundles.find((b) => b.id === 'playin-Midwest-16')!;
    expect(mw16.teamIds).toHaveLength(2);

    const teamNames = mw16.teamIds.map(
      (id) => teams.find((t) => t.id === id)!.name
    );
    expect(teamNames).toContain('UMBC');
    expect(teamNames).toContain('Howard');
  });
});

describe('generateBundles — none preset', () => {
  it('returns only play-in bundles', () => {
    const bundles = generateBundles('none', teams, config);
    expect(bundles).toHaveLength(4);
    expect(bundles.every((b) => b.id.startsWith('playin-'))).toBe(true);
  });
});

describe('generateBundles — light preset', () => {
  it('creates 4 region bundles for seeds 13-16, with 16-seed play-ins absorbed', () => {
    const bundles = generateBundles('light', teams, config);
    const playInBundles = bundles.filter((b) => b.id.startsWith('playin-'));
    const regionBundles = bundles.filter((b) => b.id.startsWith('region-'));

    // Seed-16 play-in teams are absorbed into region bundles.
    // Seed-11 play-in teams are OUTSIDE the 13-16 range, so remain separate.
    expect(playInBundles).toHaveLength(2); // West-11 and Midwest-11
    expect(playInBundles.every((b) => b.id.includes('-11'))).toBe(true);
    expect(regionBundles).toHaveLength(4);
  });

  it('region bundles include play-in teams from their seed range', () => {
    const bundles = generateBundles('light', teams, config);
    const regionBundles = bundles.filter((b) => b.id.startsWith('region-'));
    const regionTeamIds = new Set(regionBundles.flatMap((b) => b.teamIds));

    // All 16-seed teams (including play-in pairs) should be in region bundles
    const seed16Teams = teams.filter((t) => t.seed === 16);
    for (const t of seed16Teams) {
      expect(regionTeamIds.has(t.id)).toBe(true);
    }
  });

  it('each region bundle covers seeds 13-16 in that region (including play-ins)', () => {
    const bundles = generateBundles('light', teams, config);
    const eastBundle = bundles.find((b) => b.id === 'region-East-13-16')!;
    const eastTeams = eastBundle.teamIds.map((id) => teams.find((t) => t.id === id)!);
    // East should have seeds 13, 14, 15, 16 (including any play-in 16-seeds)
    expect(eastTeams.length).toBeGreaterThanOrEqual(4);
    for (const t of eastTeams) {
      expect(t.seed).toBeGreaterThanOrEqual(13);
      expect(t.seed).toBeLessThanOrEqual(16);
      expect(t.group).toBe('East');
    }
  });
});

describe('generateBundles — standard preset', () => {
  it('creates play-in bundles + seed-line bundles for 13-16', () => {
    const bundles = generateBundles('standard', teams, config);
    const playInBundles = bundles.filter((b) => b.id.startsWith('playin-'));
    const seedLineBundles = bundles.filter((b) => b.id.startsWith('seedline-'));

    expect(playInBundles).toHaveLength(4);
    expect(seedLineBundles).toHaveLength(4); // one for each seed 13, 14, 15, 16
  });

  it('seed-line bundles do not include play-in teams', () => {
    const bundles = generateBundles('standard', teams, config);
    const playInTeamIds = new Set(
      bundles
        .filter((b) => b.id.startsWith('playin-'))
        .flatMap((b) => b.teamIds)
    );
    const seedLineBundles = bundles.filter((b) => b.id.startsWith('seedline-'));
    for (const sb of seedLineBundles) {
      for (const id of sb.teamIds) {
        expect(playInTeamIds.has(id)).toBe(false);
      }
    }
  });
});

describe('generateBundles — heavy preset', () => {
  it('creates 4 region bundles for seeds 9-16, with play-in teams absorbed', () => {
    const bundles = generateBundles('heavy', teams, config);
    const playInBundles = bundles.filter((b) => b.id.startsWith('playin-'));
    const regionBundles = bundles.filter((b) => b.id.startsWith('region-'));

    // Play-in teams (16-seeds) are absorbed into region bundles, not listed separately
    expect(playInBundles).toHaveLength(0);
    expect(regionBundles).toHaveLength(4);

    // Verify play-in teams are inside region bundles
    const regionTeamIds = new Set(regionBundles.flatMap((b) => b.teamIds));
    const playInTeams = teams.filter((t) => t.seed === 16);
    for (const t of playInTeams) {
      expect(regionTeamIds.has(t.id)).toBe(true);
    }
  });

  it('heavy region bundles contain more teams than light', () => {
    const heavyBundles = generateBundles('heavy', teams, config);
    const lightBundles = generateBundles('light', teams, config);

    const heavyRegionTeamCount = heavyBundles
      .filter((b) => b.id.startsWith('region-'))
      .reduce((sum, b) => sum + b.teamIds.length, 0);
    const lightRegionTeamCount = lightBundles
      .filter((b) => b.id.startsWith('region-'))
      .reduce((sum, b) => sum + b.teamIds.length, 0);

    expect(heavyRegionTeamCount).toBeGreaterThan(lightRegionTeamCount);
  });
});

describe('getUnbundledTeams', () => {
  it('returns fewer teams as bundling increases', () => {
    const noneUnbundled = getUnbundledTeams(teams, generateBundles('none', teams, config));
    const lightUnbundled = getUnbundledTeams(teams, generateBundles('light', teams, config));
    const heavyUnbundled = getUnbundledTeams(teams, generateBundles('heavy', teams, config));

    expect(lightUnbundled.length).toBeLessThan(noneUnbundled.length);
    expect(heavyUnbundled.length).toBeLessThan(lightUnbundled.length);
  });
});

describe('countAuctionItems', () => {
  it('returns 68 total teams accounted for in each preset', () => {
    // Every team should be either unbundled or in exactly one bundle
    for (const preset of ['none', 'light', 'standard', 'heavy'] as const) {
      const bundles = generateBundles(preset, teams, config);
      const unbundled = getUnbundledTeams(teams, bundles);
      const bundledCount = bundles.reduce((sum, b) => sum + b.teamIds.length, 0);
      expect(unbundled.length + bundledCount).toBe(68);
    }
  });

  it('returns reasonable auction item counts for each preset', () => {
    const noneBundles = generateBundles('none', teams, config);
    const lightBundles = generateBundles('light', teams, config);
    const standardBundles = generateBundles('standard', teams, config);
    const heavyBundles = generateBundles('heavy', teams, config);

    const noneCount = countAuctionItems(teams, noneBundles);
    const lightCount = countAuctionItems(teams, lightBundles);
    const standardCount = countAuctionItems(teams, standardBundles);
    const heavyCount = countAuctionItems(teams, heavyBundles);

    // none: 60 unbundled + 4 play-in bundles = 64
    expect(noneCount).toBe(64);
    // More bundling = fewer auction items
    expect(lightCount).toBeLessThan(noneCount);
    expect(standardCount).toBeLessThan(noneCount);
    expect(heavyCount).toBeLessThan(lightCount);

    // Sanity: heavy should be significantly less
    expect(heavyCount).toBeLessThan(50);
  });
});

describe('deriveBundleLabel', () => {
  function makeTeam(id: number, name: string, group = 'field', seed = id): BaseTeam {
    return { id, name, seed, group, americanOdds: {} };
  }

  it('rebuilds golf-group-N labels from current team names', () => {
    // Simulates the PGA drift case: stored name has stale surnames, but
    // teamMap resolves the IDs to a different set of current golfers.
    const bundle: TeamBundle = {
      id: 'golf-group-1',
      name: 'Group 1 (McNealy / Wallace / Fox / Shattuck / Donald)',
      teamIds: [54, 59, 106, 111, 122],
    };
    const teamMap = new Map<number, BaseTeam>([
      [54, makeTeam(54, 'Maverick McNealy')],
      [59, makeTeam(59, 'Tony Fox')],
      [106, makeTeam(106, 'Andy Li')],
      [111, makeTeam(111, 'Joey Vermeer')],
      [122, makeTeam(122, 'Jason Dufner')],
    ]);
    expect(deriveBundleLabel(bundle, teamMap)).toBe(
      'Group 1 (McNealy / Fox / Li / Vermeer / Dufner)'
    );
  });

  it('rebuilds playin labels using full names and seed/group from first member', () => {
    const bundle: TeamBundle = {
      id: 'playin-West-11',
      name: 'West 11-seed (Texas / NC State)',
      teamIds: [101, 102],
    };
    const teamMap = new Map<number, BaseTeam>([
      [101, makeTeam(101, 'Texas', 'West', 11)],
      [102, makeTeam(102, 'NC State', 'West', 11)],
    ]);
    expect(deriveBundleLabel(bundle, teamMap)).toBe(
      'West 11-seed (Texas / NC State)'
    );
  });

  it('returns stored name unchanged when any teamId fails to resolve', () => {
    // Half-truths are worse than the stored label — preserve as-is.
    const bundle: TeamBundle = {
      id: 'golf-group-3',
      name: 'Group 3 (Smith / Jones)',
      teamIds: [200, 999],
    };
    const teamMap = new Map<number, BaseTeam>([
      [200, makeTeam(200, 'John Smith')],
      // 999 deliberately missing
    ]);
    expect(deriveBundleLabel(bundle, teamMap)).toBe('Group 3 (Smith / Jones)');
  });

  it('passes through region/seedline/custom labels (no embedded names)', () => {
    const region: TeamBundle = {
      id: 'region-East-13-16',
      name: 'East 13-16 seeds',
      teamIds: [1, 2, 3, 4],
    };
    const seedline: TeamBundle = {
      id: 'seedline-13',
      name: 'All 13-seeds',
      teamIds: [1, 2, 3, 4],
    };
    const custom: TeamBundle = {
      id: 'custom-abc123',
      name: 'My favorite longshots',
      teamIds: [1, 2],
    };
    const teamMap = new Map<number, BaseTeam>(
      [1, 2, 3, 4].map((id) => [id, makeTeam(id, `Team ${id}`)])
    );
    expect(deriveBundleLabel(region, teamMap)).toBe('East 13-16 seeds');
    expect(deriveBundleLabel(seedline, teamMap)).toBe('All 13-seeds');
    expect(deriveBundleLabel(custom, teamMap)).toBe('My favorite longshots');
  });
});

// ─── Soccer (World Cup) bundling: bottom-of-group tiers ──────────────
describe('generateBundles — soccer (World Cup)', () => {
  const wc = WORLD_CUP_2026_CONFIG;
  const wcTeams = WORLD_CUP_2026_TEAMS;
  const NUM_GROUPS = wc.groups.length; // 12

  it('none preset creates no bundles (48 individual nations)', () => {
    const bundles = generateBundles('none', wcTeams, wc);
    expect(bundles).toHaveLength(0);
    expect(countAuctionItems(wcTeams, bundles)).toBe(48);
  });

  it('light bundles the bottom 2 of each group (→ 36 items)', () => {
    const bundles = generateBundles('light', wcTeams, wc);
    expect(bundles).toHaveLength(NUM_GROUPS);
    for (const b of bundles) {
      expect(b.teamIds).toHaveLength(2);
      const members = b.teamIds.map((id) => wcTeams.find((t) => t.id === id)!);
      expect(members.every((m) => m.seed >= 3)).toBe(true); // two weakest per group
      expect(new Set(members.map((m) => m.group)).size).toBe(1); // same group
    }
    expect(countAuctionItems(wcTeams, bundles)).toBe(36);
  });

  it('standard bundles the bottom 3 of each group, leaving only the favorite solo (→ 24 items)', () => {
    const bundles = generateBundles('standard', wcTeams, wc);
    expect(bundles).toHaveLength(NUM_GROUPS);
    for (const b of bundles) {
      expect(b.teamIds).toHaveLength(3);
      const members = b.teamIds.map((id) => wcTeams.find((t) => t.id === id)!);
      expect(members.every((m) => m.seed >= 2)).toBe(true);
    }
    expect(countAuctionItems(wcTeams, bundles)).toBe(24);
  });

  it('heavy bundles whole groups (→ 12 items)', () => {
    const bundles = generateBundles('heavy', wcTeams, wc);
    expect(bundles).toHaveLength(NUM_GROUPS);
    for (const b of bundles) expect(b.teamIds).toHaveLength(4);
    expect(getUnbundledTeams(wcTeams, bundles)).toHaveLength(0);
    expect(countAuctionItems(wcTeams, bundles)).toBe(12);
  });

  it('custom preset auto-generates nothing (manual builder handles it)', () => {
    expect(generateBundles('custom', wcTeams, wc)).toHaveLength(0);
  });

  it('accounts for every nation in each preset, and more bundling = fewer items', () => {
    const counts: number[] = [];
    for (const preset of ['none', 'light', 'standard', 'heavy'] as const) {
      const bundles = generateBundles(preset, wcTeams, wc);
      const unbundled = getUnbundledTeams(wcTeams, bundles);
      const bundledCount = bundles.reduce((s, b) => s + b.teamIds.length, 0);
      expect(unbundled.length + bundledCount).toBe(48);
      counts.push(countAuctionItems(wcTeams, bundles));
    }
    // none > light > standard > heavy
    expect(counts[0]).toBeGreaterThan(counts[1]);
    expect(counts[1]).toBeGreaterThan(counts[2]);
    expect(counts[2]).toBeGreaterThan(counts[3]);
  });
});

describe('deriveBundleLabel — soccer-group', () => {
  function makeTeam(id: number, name: string, group: string, seed: number): BaseTeam {
    return { id, name, seed, group, americanOdds: {} };
  }
  it('rebuilds soccer-group labels from current member names', () => {
    const bundle: TeamBundle = {
      id: 'soccer-group-A',
      name: 'Group A — stale / names',
      teamIds: [3, 4],
    };
    const teamMap = new Map<number, BaseTeam>([
      [3, makeTeam(3, 'Czechia', 'A', 3)],
      [4, makeTeam(4, 'South Africa', 'A', 4)],
    ]);
    expect(deriveBundleLabel(bundle, teamMap)).toBe('Group A — Czechia / South Africa');
  });
});
