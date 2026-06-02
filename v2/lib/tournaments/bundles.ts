import type { BaseTeam, TeamBundle, BundlePreset, TournamentConfig } from './types';

// ─── Preset Metadata ────────────────────────────────────────────────

/** Default bundle preset metadata — used for bracket sports (March Madness, etc.) */
const BRACKET_BUNDLE_PRESETS: Record<BundlePreset, { label: string; description: string }> = {
  none: {
    label: 'No Bundling',
    description: 'Every team auctioned individually (play-in pairs still bundled)',
  },
  light: {
    label: 'Light Bundling',
    description: 'Seeds 13-16 bundled per region, reducing low-value items',
  },
  standard: {
    label: 'Standard Bundling',
    description: 'Seeds 13-16 bundled by seed line (all 13s together, all 14s, etc.)',
  },
  heavy: {
    label: 'Heavy Bundling',
    description: 'Seeds 9-16 bundled per region for a fast auction',
  },
  custom: {
    label: 'Custom',
    description: 'Define your own team groupings',
  },
};

/** Golf-specific bundle presets — groups lower-ranked players */
const GOLF_BUNDLE_PRESETS: Record<BundlePreset, { label: string; description: string }> = {
  none: {
    label: 'No Bundling',
    description: 'Every golfer auctioned individually (~89 items, 3+ hours)',
  },
  light: {
    label: 'Top 50 Individual',
    description: 'Top 50 golfers individual, rest in balanced groups of 3-4',
  },
  standard: {
    label: 'Top 40 Individual',
    description: 'Top 40 golfers individual, rest in balanced groups of 3-4 (~52 items)',
  },
  heavy: {
    label: 'Top 30 Individual',
    description: 'Top 30 golfers individual, rest in balanced groups of 4-5 (~42 items)',
  },
  custom: {
    label: 'Custom',
    description: 'Define your own player groupings',
  },
};

/** Soccer-specific bundle presets — groups the weakest teams within each group. */
const SOCCER_BUNDLE_PRESETS: Record<BundlePreset, { label: string; description: string }> = {
  none: {
    label: 'No Bundling',
    description: 'Every nation auctioned individually (48 items)',
  },
  light: {
    label: 'Light Bundling',
    description: 'Bottom 2 of each group bundled (~36 items)',
  },
  standard: {
    label: 'Standard Bundling',
    description: 'Bottom 3 of each group bundled — only group favorites solo (~24 items)',
  },
  heavy: {
    label: 'Heavy Bundling',
    description: 'Each group sold as one bundle (12 items)',
  },
  custom: {
    label: 'Custom',
    description: 'Define your own nation groupings',
  },
};

/** Get bundle preset metadata based on sport type */
export function getBundlePresets(sport?: string): Record<BundlePreset, { label: string; description: string }> {
  if (sport === 'golf') return GOLF_BUNDLE_PRESETS;
  if (sport === 'soccer') return SOCCER_BUNDLE_PRESETS;
  return BRACKET_BUNDLE_PRESETS;
}

/** @deprecated Use getBundlePresets(sport) instead */
export const BUNDLE_PRESETS = BRACKET_BUNDLE_PRESETS;

// ─── Play-In Detection ──────────────────────────────────────────────

/**
 * Finds teams that share the same seed+group — these are play-in opponents
 * and must always be bundled together regardless of preset.
 */
export function detectPlayInBundles(
  teams: BaseTeam[],
  _config: TournamentConfig
): TeamBundle[] {
  // Group teams by seed+group key
  const byKey = new Map<string, BaseTeam[]>();
  for (const team of teams) {
    const key = `${team.group}-${team.seed}`;
    const arr = byKey.get(key);
    if (arr) {
      arr.push(team);
    } else {
      byKey.set(key, [team]);
    }
  }

  const bundles: TeamBundle[] = [];
  for (const [key, groupTeams] of byKey) {
    if (groupTeams.length > 1) {
      const names = groupTeams.map((t) => t.name);
      bundles.push({
        id: `playin-${key}`,
        name: `${groupTeams[0].group} ${groupTeams[0].seed}-seed (${names.join(' / ')})`,
        teamIds: groupTeams.map((t) => t.id),
      });
    }
  }

  // Sort for deterministic order
  bundles.sort((a, b) => a.id.localeCompare(b.id));
  return bundles;
}

// ─── Seed-Based Bundling ────────────────────────────────────────────

function getPlayInTeamIds(playInBundles: TeamBundle[]): Set<number> {
  const ids = new Set<number>();
  for (const bundle of playInBundles) {
    for (const id of bundle.teamIds) {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * Bundle teams by seed range per region.
 * Play-in teams whose seed falls within [seedMin, seedMax] are INCLUDED in
 * the region bundle (not listed separately). This prevents 16-seed play-in
 * teams from showing as standalone items when light/heavy bundling groups
 * seeds 13-16 per region.
 */
function bundleByRegion(
  teams: BaseTeam[],
  config: TournamentConfig,
  seedMin: number,
  seedMax: number,
  _playInTeamIds: Set<number>
): TeamBundle[] {
  const bundles: TeamBundle[] = [];

  for (const group of config.groups) {
    // Include ALL teams in the seed range, including play-in teams
    const regionTeams = teams.filter(
      (t) =>
        t.group === group.key &&
        t.seed >= seedMin &&
        t.seed <= seedMax
    );
    if (regionTeams.length === 0) continue;

    regionTeams.sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name));
    bundles.push({
      id: `region-${group.key}-${seedMin}-${seedMax}`,
      name: `${group.label} ${seedMin}-${seedMax} seeds`,
      teamIds: regionTeams.map((t) => t.id),
    });
  }

  return bundles;
}

/**
 * Bundle teams by seed line across all regions (e.g., all 13-seeds together).
 * Teams already in play-in bundles are excluded.
 */
function bundleBySeedLine(
  teams: BaseTeam[],
  seedMin: number,
  seedMax: number,
  playInTeamIds: Set<number>
): TeamBundle[] {
  const bundles: TeamBundle[] = [];

  for (let seed = seedMin; seed <= seedMax; seed++) {
    const seedTeams = teams.filter(
      (t) => t.seed === seed && !playInTeamIds.has(t.id)
    );
    if (seedTeams.length === 0) continue;

    seedTeams.sort((a, b) => a.group.localeCompare(b.group));
    bundles.push({
      id: `seedline-${seed}`,
      name: `All ${seed}-seeds`,
      teamIds: seedTeams.map((t) => t.id),
    });
  }

  return bundles;
}

// ─── Golf Bundling ─────────────────────────────────────────────────

/**
 * Bundle lower-ranked golfers into balanced groups.
 * Golfers ranked above `individualCutoff` stay individual.
 * Remaining golfers are split into balanced groups using a "pot draft" method:
 * sort remaining by seed, distribute round-robin across N groups.
 * This ensures each group has a mix of better and worse longshots.
 */
function bundleGolf(
  teams: BaseTeam[],
  individualCutoff: number,
  groupSize: number
): TeamBundle[] {
  const sorted = [...teams].sort((a, b) => a.seed - b.seed);
  const toBundles = sorted.filter((t) => t.seed > individualCutoff);

  if (toBundles.length === 0) return [];

  const numGroups = Math.ceil(toBundles.length / groupSize);
  const groups: BaseTeam[][] = Array.from({ length: numGroups }, () => []);

  // Round-robin distribution (serpentine) for balance
  for (let i = 0; i < toBundles.length; i++) {
    const round = Math.floor(i / numGroups);
    const idx = round % 2 === 0 ? i % numGroups : numGroups - 1 - (i % numGroups);
    groups[idx].push(toBundles[i]);
  }

  return groups
    .filter((g) => g.length > 0)
    .map((g, i) => ({
      id: `golf-group-${i + 1}`,
      name: `Group ${i + 1} (${g.map((t) => t.name.split(' ').pop()).join(' / ')})`,
      teamIds: g.map((t) => t.id),
    }));
}

// ─── Soccer Bundling ────────────────────────────────────────────────

/**
 * Bundle the weakest teams within each group. `bundleFromSeed` is the within-group
 * seed (1 = group favorite … 4 = weakest) at/above which teams get bundled:
 *   - 3 → bottom 2 of each group (light)
 *   - 2 → bottom 3, leaving only the group favorite solo (standard)
 *   - 1 → the whole group as one item (heavy)
 * Concentrates longshot value into a biddable item and keeps groups intact.
 */
function bundleSoccer(
  teams: BaseTeam[],
  config: TournamentConfig,
  bundleFromSeed: number
): TeamBundle[] {
  const bundles: TeamBundle[] = [];
  for (const group of config.groups) {
    const groupTeams = teams
      .filter((t) => t.group === group.key && t.seed >= bundleFromSeed)
      .sort((a, b) => a.seed - b.seed);
    if (groupTeams.length < 2) continue; // a "bundle" needs at least two teams
    bundles.push({
      id: `soccer-group-${group.key}`,
      name: `Group ${group.key} — ${groupTeams.map((t) => t.name).join(' / ')}`,
      teamIds: groupTeams.map((t) => t.id),
    });
  }
  return bundles;
}

// ─── Main Generator ─────────────────────────────────────────────────

/**
 * Generate all bundles for a given preset.
 * Play-in bundles are always included. Teams in play-in bundles are excluded
 * from seed-based bundles to avoid double-counting.
 * For golf, uses rank-based grouping instead of seed/region bundling.
 */
export function generateBundles(
  preset: BundlePreset,
  teams: BaseTeam[],
  config: TournamentConfig,
  customConfig?: { cutoff: number; groupSize: number }
): TeamBundle[] {
  // Golf-specific bundling
  if (config.sport === 'golf') {
    switch (preset) {
      case 'none':
        return [];
      case 'light':
        return bundleGolf(teams, 50, 4);   // Top 50 individual, rest in groups of ~4
      case 'standard':
        return bundleGolf(teams, 40, 4);   // Top 40 individual, rest in groups of ~4
      case 'heavy':
        return bundleGolf(teams, 30, 5);   // Top 30 individual, rest in groups of ~5
      case 'custom':
        if (customConfig) {
          return bundleGolf(teams, customConfig.cutoff, customConfig.groupSize);
        }
        return [];
    }
  }

  // Soccer-specific bundling (World Cup): bundle the weakest teams per group.
  if (config.sport === 'soccer') {
    switch (preset) {
      case 'none':
        return [];
      case 'light':
        return bundleSoccer(teams, config, 3); // bottom 2 per group
      case 'standard':
        return bundleSoccer(teams, config, 2); // bottom 3 per group
      case 'heavy':
        return bundleSoccer(teams, config, 1); // whole group
      case 'custom':
        return []; // manual builder handles custom bundles
    }
  }

  // Bracket-sport bundling (March Madness, etc.)
  const playInBundles = detectPlayInBundles(teams, config);
  const playInTeamIds = getPlayInTeamIds(playInBundles);

  switch (preset) {
    case 'none':
      return playInBundles;

    case 'light': {
      const regionBundles = bundleByRegion(teams, config, 13, 16, playInTeamIds);
      const regionTeamIds = new Set(regionBundles.flatMap((b) => b.teamIds));
      const extraPlayIns = playInBundles.filter(
        (b) => !b.teamIds.some((id) => regionTeamIds.has(id))
      );
      return [...extraPlayIns, ...regionBundles];
    }

    case 'standard':
      return [
        ...playInBundles,
        ...bundleBySeedLine(teams, 13, 16, playInTeamIds),
      ];

    case 'heavy': {
      const regionBundles = bundleByRegion(teams, config, 9, 16, playInTeamIds);
      const regionTeamIds = new Set(regionBundles.flatMap((b) => b.teamIds));
      const extraPlayIns = playInBundles.filter(
        (b) => !b.teamIds.some((id) => regionTeamIds.has(id))
      );
      return [...extraPlayIns, ...regionBundles];
    }

    case 'custom':
      return playInBundles;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Rebuild a bundle's display label from its current team members.
 *
 * Bundle `name` is computed and frozen at bundle-creation time. If the team
 * roster shifts later (e.g., an odds-refresh script reassigns IDs), the stored
 * `name` can disagree with what `teamIds` now resolves to. Calling this at
 * render time keeps the title in sync with the chips shown below it.
 *
 * Returns the stored `bundle.name` unchanged when:
 *  - Any team ID doesn't resolve (avoid showing a half-truth)
 *  - The bundle uses a fixed-format label that doesn't embed member names
 *    (region/seedline bundles, custom user-named bundles)
 */
export function deriveBundleLabel(
  bundle: TeamBundle,
  teamMap: Map<number, BaseTeam>,
): string {
  const members = bundle.teamIds.map((id) => teamMap.get(id));
  const allResolved = members.every((m): m is BaseTeam => !!m);
  if (!allResolved) return bundle.name;

  if (bundle.id.startsWith('golf-group-')) {
    const num = bundle.id.slice('golf-group-'.length);
    return `Group ${num} (${members.map((t) => t.name.split(' ').pop()).join(' / ')})`;
  }

  if (bundle.id.startsWith('soccer-group-')) {
    return `Group ${members[0].group} — ${members.map((t) => t.name).join(' / ')}`;
  }

  if (bundle.id.startsWith('playin-')) {
    return `${members[0].group} ${members[0].seed}-seed (${members.map((t) => t.name).join(' / ')})`;
  }

  // region-*, seedline-*, custom-* don't embed member names — preserve as-is.
  return bundle.name;
}

/** Returns teams that are NOT part of any bundle */
export function getUnbundledTeams(
  teams: BaseTeam[],
  bundles: TeamBundle[]
): BaseTeam[] {
  const bundledIds = new Set<number>();
  for (const bundle of bundles) {
    for (const id of bundle.teamIds) {
      bundledIds.add(id);
    }
  }
  return teams.filter((t) => !bundledIds.has(t.id));
}

/** Total auction items = unbundled teams + bundles */
export function countAuctionItems(
  teams: BaseTeam[],
  bundles: TeamBundle[]
): number {
  const unbundled = getUnbundledTeams(teams, bundles);
  return unbundled.length + bundles.length;
}
