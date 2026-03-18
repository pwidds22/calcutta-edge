import type { BaseTeam, TeamBundle, BundlePreset, TournamentConfig } from './types';

// ─── Preset Metadata ────────────────────────────────────────────────

export const BUNDLE_PRESETS: Record<BundlePreset, { label: string; description: string }> = {
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
};

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

// ─── Main Generator ─────────────────────────────────────────────────

/**
 * Generate all bundles for a given preset.
 * Play-in bundles are always included. Teams in play-in bundles are excluded
 * from seed-based bundles to avoid double-counting.
 */
export function generateBundles(
  preset: BundlePreset,
  teams: BaseTeam[],
  config: TournamentConfig
): TeamBundle[] {
  const playInBundles = detectPlayInBundles(teams, config);
  const playInTeamIds = getPlayInTeamIds(playInBundles);

  switch (preset) {
    case 'none':
      return playInBundles;

    case 'light': {
      // Region bundles absorb play-in teams whose seed is in range (13-16).
      // Only include play-in bundles for seeds OUTSIDE the region range.
      const regionBundles = bundleByRegion(teams, config, 13, 16, playInTeamIds);
      const regionTeamIds = new Set(regionBundles.flatMap((b) => b.teamIds));
      const extraPlayIns = playInBundles.filter(
        (b) => !b.teamIds.some((id) => regionTeamIds.has(id))
      );
      return [...extraPlayIns, ...regionBundles];
    }

    case 'standard':
      // Seed-line bundling keeps play-in bundles separate (different grouping axis)
      return [
        ...playInBundles,
        ...bundleBySeedLine(teams, 13, 16, playInTeamIds),
      ];

    case 'heavy': {
      // Region bundles absorb play-in teams whose seed is in range (9-16).
      const regionBundles = bundleByRegion(teams, config, 9, 16, playInTeamIds);
      const regionTeamIds = new Set(regionBundles.flatMap((b) => b.teamIds));
      const extraPlayIns = playInBundles.filter(
        (b) => !b.teamIds.some((id) => regionTeamIds.has(id))
      );
      return [...extraPlayIns, ...regionBundles];
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

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
