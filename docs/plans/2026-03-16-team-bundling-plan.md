# Team Bundling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let commissioners bundle low seeds (13-16) into single auction items, auto-bundle play-in teams, and show bundles in both strategy tool and live auction.

**Architecture:** Bundles are a display/auction-level concept — each team keeps individual odds and values. A bundle = array of team IDs that are auctioned together. Bundle fair value = sum of member fair values. Presets generate bundles from seed ranges. Bundles stored in session settings (live auction) and auction state (strategy tool).

**Tech Stack:** TypeScript, React (Next.js 16), Supabase (session settings jsonb), existing tournament config system.

---

### Task 1: Add TeamBundle Type + Preset Generator

**Files:**
- Modify: `v2/lib/tournaments/types.ts`
- Create: `v2/lib/tournaments/bundles.ts`
- Test: `v2/lib/tournaments/__tests__/bundles.test.ts`

**Step 1: Add TeamBundle type to types.ts**

Add after the `BaseTeam` interface:

```typescript
/** A group of teams auctioned as a single item */
export interface TeamBundle {
  id: string;           // e.g., "east-13-16" or "playin-west-11"
  name: string;         // Display name: "East 13-16 Seeds"
  teamIds: number[];    // References to BaseTeam.id
}

export type BundlePreset = 'none' | 'light' | 'standard' | 'heavy';
```

**Step 2: Write bundles.ts with preset generator**

```typescript
// v2/lib/tournaments/bundles.ts
import type { BaseTeam, TeamBundle, BundlePreset, TournamentConfig } from './types';

export const BUNDLE_PRESETS: Record<BundlePreset, { label: string; description: string }> = {
  none: { label: 'No Bundling', description: 'All teams auctioned individually (play-ins merged)' },
  light: { label: 'Light Bundling', description: 'Seeds 1-12 individual, 13-16 bundled per region' },
  standard: { label: 'Standard', description: 'Seeds 1-12 individual, 13-16 bundled by seed line' },
  heavy: { label: 'Heavy Bundling', description: 'Seeds 1-8 individual, 9-16 bundled per region' },
};

/** Detect play-in matchups: multiple teams with same seed + group */
export function detectPlayInBundles(teams: BaseTeam[], config: TournamentConfig): TeamBundle[] {
  const bundles: TeamBundle[] = [];
  const seen = new Map<string, BaseTeam[]>();

  for (const team of teams) {
    const key = `${team.group}-${team.seed}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(team);
  }

  for (const [key, group] of seen) {
    if (group.length > 1) {
      const [region, seed] = key.split('-');
      bundles.push({
        id: `playin-${key}`,
        name: `${group.map(t => t.name).join(' / ')} (${seed})`,
        teamIds: group.map(t => t.id),
      });
    }
  }
  return bundles;
}

/** Generate bundles for a preset */
export function generateBundles(
  preset: BundlePreset,
  teams: BaseTeam[],
  config: TournamentConfig
): TeamBundle[] {
  const playIns = detectPlayInBundles(teams, config);
  // Team IDs already in play-in bundles
  const playInIds = new Set(playIns.flatMap(b => b.teamIds));

  if (preset === 'none') return playIns;

  const bundleSeedMin = preset === 'heavy' ? 9 : 13;
  const byRegion = preset !== 'standard'; // standard = by seed line

  const bundles = [...playIns];
  const bundleable = teams.filter(t => t.seed >= bundleSeedMin && !playInIds.has(t.id));

  if (byRegion) {
    // Group by region
    for (const group of config.groups) {
      const regionTeams = bundleable.filter(t => t.group === group.key);
      if (regionTeams.length === 0) continue;
      const seedRange = `${bundleSeedMin}-16`;
      bundles.push({
        id: `${group.key.toLowerCase()}-${seedRange}`,
        name: `${group.label} ${seedRange} Seeds`,
        teamIds: regionTeams.map(t => t.id),
      });
    }
  } else {
    // Group by seed line (standard)
    const seedGroups = new Map<number, BaseTeam[]>();
    for (const team of bundleable) {
      if (!seedGroups.has(team.seed)) seedGroups.set(team.seed, []);
      seedGroups.get(team.seed)!.push(team);
    }
    for (const [seed, seedTeams] of seedGroups) {
      bundles.push({
        id: `seed-${seed}`,
        name: `All ${seed}-Seeds`,
        teamIds: seedTeams.map(t => t.id),
      });
    }
  }

  return bundles;
}

/** Get teams not in any bundle (individual auction items) */
export function getUnbundledTeams(teams: BaseTeam[], bundles: TeamBundle[]): BaseTeam[] {
  const bundledIds = new Set(bundles.flatMap(b => b.teamIds));
  return teams.filter(t => !bundledIds.has(t.id));
}

/** Count total auction items (individual teams + bundles) */
export function countAuctionItems(teams: BaseTeam[], bundles: TeamBundle[]): number {
  return getUnbundledTeams(teams, bundles).length + bundles.length;
}
```

**Step 3: Write test**

```typescript
// v2/lib/tournaments/__tests__/bundles.test.ts
import { describe, it, expect } from 'vitest';
import { detectPlayInBundles, generateBundles, countAuctionItems } from '../bundles';
import { MARCH_MADNESS_2026_TEAMS, MARCH_MADNESS_2026_CONFIG } from '../configs/march-madness-2026';

const teams = MARCH_MADNESS_2026_TEAMS;
const config = MARCH_MADNESS_2026_CONFIG;

describe('detectPlayInBundles', () => {
  it('detects play-in matchups (same seed + region)', () => {
    const bundles = detectPlayInBundles(teams, config);
    expect(bundles.length).toBeGreaterThan(0);
    // Every play-in bundle should have 2+ teams
    for (const b of bundles) {
      expect(b.teamIds.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('generateBundles', () => {
  it('none preset only returns play-in bundles', () => {
    const bundles = generateBundles('none', teams, config);
    for (const b of bundles) {
      expect(b.id).toContain('playin');
    }
  });

  it('light preset bundles seeds 13-16 per region', () => {
    const bundles = generateBundles('light', teams, config);
    const regionBundles = bundles.filter(b => !b.id.startsWith('playin'));
    expect(regionBundles.length).toBe(4); // 4 regions
  });

  it('heavy preset bundles seeds 9-16 per region', () => {
    const bundles = generateBundles('heavy', teams, config);
    const regionBundles = bundles.filter(b => !b.id.startsWith('playin'));
    expect(regionBundles.length).toBe(4);
  });
});

describe('countAuctionItems', () => {
  it('none preset: ~64 items (68 teams minus play-in dupes + play-in bundles)', () => {
    const bundles = generateBundles('none', teams, config);
    const count = countAuctionItems(teams, bundles);
    expect(count).toBeLessThanOrEqual(64);
    expect(count).toBeGreaterThanOrEqual(60);
  });

  it('light preset: ~52 items', () => {
    const bundles = generateBundles('light', teams, config);
    const count = countAuctionItems(teams, bundles);
    expect(count).toBeGreaterThanOrEqual(48);
    expect(count).toBeLessThanOrEqual(56);
  });
});
```

**Step 4: Run tests**

```bash
cd v2 && npm test
```

**Step 5: Commit**

```bash
git add v2/lib/tournaments/types.ts v2/lib/tournaments/bundles.ts v2/lib/tournaments/__tests__/bundles.test.ts
git commit -m "feat: add TeamBundle type and preset generator for Calcutta bundling"
```

---

### Task 2: Strategy Tool — Bundle-Aware Team Table

**Files:**
- Modify: `v2/lib/auction/auction-state.ts` (add bundles to state + actions)
- Modify: `v2/components/auction/team-table.tsx` (render bundle rows)
- Modify: `v2/components/auction/team-table-row.tsx` (add BundleRow component)
- Modify: `v2/lib/auction/auction-context.ts` (expose bundles)

**Step 1: Add bundles to AuctionState**

In `auction-state.ts`, add to `AuctionState`:

```typescript
bundles: TeamBundle[];
bundlePreset: BundlePreset;
```

Add new action:

```typescript
| { type: 'SET_BUNDLE_PRESET'; preset: BundlePreset }
```

Handle in reducer — calls `generateBundles()` and stores result.

**Step 2: Add bundle preset selector to strategy tool UI**

In `team-table.tsx`, add a Select dropdown in the filter bar for bundle preset (None / Light / Standard / Heavy). Dispatches `SET_BUNDLE_PRESET`.

**Step 3: Render bundle rows**

In `team-table.tsx`, when bundles exist:
1. Partition teams into bundled vs unbundled
2. Render unbundled teams normally
3. Render each bundle as a collapsible `BundleRow` (new component)

`BundleRow` shows:
- Combined name (e.g., "East 13-16 Seeds")
- Combined fair value = SUM of member team fair values
- Combined bid = SUM of member team suggested bids
- Single price input (splits proportionally on blur)
- Single "Mine" checkbox (toggles all members)
- Expandable to show individual member team rows (indented)

**Step 4: Run build + verify**

```bash
cd v2 && npm run build && npm test
```

**Step 5: Commit**

```bash
git commit -m "feat: bundle-aware strategy tool with preset selector and collapsible bundle rows"
```

---

### Task 3: Live Auction — Bundle Support in Session Setup

**Files:**
- Modify: `v2/lib/auction/live/types.ts` (add bundles to SessionSettings)
- Modify: `v2/components/live/create-session-form.tsx` (add bundle preset selector)
- Modify: `v2/actions/session.ts` (store bundles in settings, generate team_order from bundles)

**Step 1: Add bundles to SessionSettings**

```typescript
// In types.ts
export interface SessionSettings {
  timer?: TimerSettings;
  bidIncrements?: number[];
  autoMode?: boolean;
  bundles?: TeamBundle[];
  bundlePreset?: BundlePreset;
}
```

**Step 2: Add bundle preset selector to create-session-form**

Add a Select with bundle preset options between payout rules and timer settings. Default to 'light'. Show auction item count dynamically.

**Step 3: Update createSession to store bundles and order**

In `session.ts`, when creating session:
- Generate bundles from preset
- Store in `settings.bundles`
- Generate `team_order` that includes bundle IDs (prefixed with `b:`) alongside individual team IDs

**Step 4: Run build + verify**

```bash
cd v2 && npm run build
```

**Step 5: Commit**

```bash
git commit -m "feat: bundle preset selector in live auction session creation"
```

---

### Task 4: Live Auction — Bundle-Aware Bidding + Queue

**Files:**
- Modify: `v2/components/live/team-queue.tsx` (show bundles as single items)
- Modify: `v2/components/live/commissioner-view.tsx` (present bundles)
- Modify: `v2/actions/bidding.ts` (sellTeam handles bundles — assigns all member teams)

**Step 1: Update team queue to render bundles**

When `team_order` contains a `b:bundle-id` entry, look up the bundle from settings, render as a single queue item showing all member team names.

**Step 2: Update commissioner view to present bundles**

When current item is a bundle, show all member teams with their individual odds/values, plus the combined fair value.

**Step 3: Update sellTeam to handle bundles**

When a bundle is sold:
- Record winning bid in `auction_bids` for each team in the bundle
- Split purchase price proportionally by fair value
- Broadcast TEAM_SOLD with bundle metadata
- Auto-sync each member team to strategy tool's `auction_data`

**Step 4: Run build + test**

```bash
cd v2 && npm run build && npm test
```

**Step 5: Commit**

```bash
git commit -m "feat: live auction bundle-aware bidding, queue, and settlement"
```

---

### Priority / Ship Order

**Must ship before First Four (March 17):**
- Task 1 (types + generator) — foundation for everything

**Must ship before Round 1 (March 19):**
- Task 2 (strategy tool bundles) — users need this for auction prep
- Task 3 (live auction setup) — commissioners need bundle presets

**Can ship same day or day after:**
- Task 4 (live auction bidding) — needed when auctions actually run
