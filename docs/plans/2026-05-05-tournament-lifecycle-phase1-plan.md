# Tournament Lifecycle Foundation — Phase 1 Plan (PGA Survival)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `isActive: boolean` with a date-driven phase model so the strategy page selector, dashboard, and tournament URLs all stop showing stale events. Ship PGA Championship 2026 config so it's hostable by May 14.

**Architecture:** Add `endDate`, `archiveAt`, `phaseOverride` fields to `TournamentConfig`. New pure helper `getTournamentPhase(config, now)` computes one of 5 phases. Registry exposes phase-aware helpers (`listSelectorTournaments`, `getFeaturedTournament`, `listPastTournaments`). Strategy page URL moves from `/auction` to `/strategy` with 308 redirects. Existing `isActive` boolean becomes a deprecated computed alias to keep current call sites working.

**Tech Stack:** TypeScript, Next.js 16 App Router, Vitest, Supabase (no schema changes — phase is purely derived from tournament config dates).

**Reference:** [2026-05-05-tournament-lifecycle-design.md](./2026-05-05-tournament-lifecycle-design.md)

---

### Task 1: Add `TournamentPhase` type and new lifecycle fields

**Files:**
- Modify: `v2/lib/tournaments/types.ts`

- [ ] **Step 1: Add `TournamentPhase` union type**

In `v2/lib/tournaments/types.ts`, add this type near the top of the file (after the existing `DevigStrategy` type, around line 11):

```typescript
/** Lifecycle phase derived from a tournament's dates. */
export type TournamentPhase =
  | 'upcoming'   // hosting not yet open
  | 'hostable'   // hosts can create auctions, no live data yet
  | 'live'       // tournament in progress, results syncing
  | 'completed'  // ended, frozen, visible in past leagues
  | 'archived';  // fully hidden from selectors and dashboards
```

- [ ] **Step 2: Add new fields to `TournamentConfig`**

In the same file, modify the existing `TournamentConfig` interface. Find the lines:

```typescript
  startDate: string;
  /** ISO date when hosting opens (typically 2-3 weeks before startDate). If omitted, hosting is always open. */
  hostingOpensAt?: string;
  isActive: boolean;
```

Replace with:

```typescript
  startDate: string;
  /** ISO date when hosting opens (typically 2-3 weeks before startDate). If omitted, hosting is always open. */
  hostingOpensAt?: string;
  /** ISO date of the last day of competition (inclusive). Required for new configs. */
  endDate: string;
  /** ISO date when the tournament should be hidden from all UI. Default: endDate + 30 days. */
  archiveAt?: string;
  /** Force a specific phase regardless of dates (escape hatch for delays/cancellations). */
  phaseOverride?: TournamentPhase;
  /** @deprecated Use `getTournamentPhase()` and check for 'hostable' or 'live'. Manually maintained during Phase 1 migration; field will be removed when all call sites are updated (Phase 2). */
  isActive: boolean;
```

- [ ] **Step 3: Verify the file typechecks**

Run from `v2/`:

```bash
npx tsc --noEmit
```

Expected: errors complaining that existing tournament configs don't have `endDate`. That's intentional — Task 4 adds them. The new types compile correctly.

- [ ] **Step 4: Commit**

```bash
git add v2/lib/tournaments/types.ts
git commit -m "feat: add TournamentPhase type and lifecycle date fields"
```

---

### Task 2: Implement `getTournamentPhase()` with full test coverage

**Files:**
- Create: `v2/lib/tournaments/phase.ts`
- Create: `v2/lib/tournaments/__tests__/phase.test.ts`

- [ ] **Step 1: Write failing tests for `getTournamentPhase`**

Create `v2/lib/tournaments/__tests__/phase.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getTournamentPhase } from '../phase';
import type { TournamentConfig } from '../types';

function makeConfig(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return {
    id: 'test',
    name: 'Test',
    sport: 'golf',
    rounds: [],
    groups: [],
    devigStrategy: 'global',
    defaultPayoutRules: {},
    defaultPotSize: 1000,
    propBets: [],
    badge: 'Test',
    teamLabel: 'Player',
    groupLabel: 'Tier',
    startDate: '2026-06-01',
    endDate: '2026-06-04',
    hostingOpensAt: '2026-05-15',
    isActive: false,
    ...overrides,
  };
}

describe('getTournamentPhase', () => {
  it('returns "upcoming" before hostingOpensAt', () => {
    const config = makeConfig();
    const now = new Date('2026-05-01T12:00:00Z');
    expect(getTournamentPhase(config, now)).toBe('upcoming');
  });

  it('returns "hostable" between hostingOpensAt and startDate', () => {
    const config = makeConfig();
    const now = new Date('2026-05-20T12:00:00Z');
    expect(getTournamentPhase(config, now)).toBe('hostable');
  });

  it('returns "live" between startDate and endDate (inclusive)', () => {
    const config = makeConfig();
    const start = new Date('2026-06-01T12:00:00Z');
    const middle = new Date('2026-06-02T18:00:00Z');
    const lastDay = new Date('2026-06-04T20:00:00Z');
    expect(getTournamentPhase(config, start)).toBe('live');
    expect(getTournamentPhase(config, middle)).toBe('live');
    expect(getTournamentPhase(config, lastDay)).toBe('live');
  });

  it('returns "completed" after endDate but before default archive (endDate + 30 days)', () => {
    const config = makeConfig();
    const now = new Date('2026-06-15T00:00:00Z');
    expect(getTournamentPhase(config, now)).toBe('completed');
  });

  it('returns "archived" after default archive window (endDate + 30 days)', () => {
    const config = makeConfig();
    const now = new Date('2026-07-10T00:00:00Z');
    expect(getTournamentPhase(config, now)).toBe('archived');
  });

  it('respects custom archiveAt date', () => {
    const config = makeConfig({ archiveAt: '2026-06-10' });
    const dayAfterEnd = new Date('2026-06-05T00:00:00Z');
    const dayAfterArchive = new Date('2026-06-11T00:00:00Z');
    expect(getTournamentPhase(config, dayAfterEnd)).toBe('completed');
    expect(getTournamentPhase(config, dayAfterArchive)).toBe('archived');
  });

  it('treats missing hostingOpensAt as "always hostable"', () => {
    const config = makeConfig({ hostingOpensAt: undefined });
    const farPast = new Date('2020-01-01T00:00:00Z');
    expect(getTournamentPhase(config, farPast)).toBe('hostable');
  });

  it('returns phaseOverride when set, ignoring dates', () => {
    const config = makeConfig({ phaseOverride: 'live' });
    const farPast = new Date('2020-01-01T00:00:00Z');
    expect(getTournamentPhase(config, farPast)).toBe('live');
  });

  it('handles boundary: end of endDate is still live', () => {
    const config = makeConfig({ endDate: '2026-06-04' });
    const endOfDay = new Date('2026-06-04T23:59:59Z');
    expect(getTournamentPhase(config, endOfDay)).toBe('live');
  });

  it('handles boundary: start of day after endDate is completed', () => {
    const config = makeConfig({ endDate: '2026-06-04' });
    const nextDay = new Date('2026-06-05T00:00:00Z');
    expect(getTournamentPhase(config, nextDay)).toBe('completed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `v2/`:

```bash
npm test -- phase.test.ts
```

Expected: All tests fail with "Cannot find module '../phase'".

- [ ] **Step 3: Implement `phase.ts`**

Create `v2/lib/tournaments/phase.ts`:

```typescript
import type { TournamentConfig, TournamentPhase } from './types';

const DEFAULT_ARCHIVE_DAYS_AFTER_END = 30;

function parseISODate(date: string): Date {
  // Treat ISO date strings (no time component) as UTC midnight.
  return new Date(date.includes('T') ? date : `${date}T00:00:00Z`);
}

function endOfDay(date: string): Date {
  const d = parseISODate(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Compute the lifecycle phase of a tournament.
 *
 * Boundaries:
 *   - upcoming:  now < hostingOpensAt
 *   - hostable:  hostingOpensAt <= now < startDate
 *   - live:      startDate <= now <= end-of-endDate (inclusive)
 *   - completed: end-of-endDate < now < archiveAt (default: endDate + 30d)
 *   - archived:  now >= archiveAt
 *
 * If `phaseOverride` is set, returns it directly.
 * If `hostingOpensAt` is missing, the tournament is hostable from the beginning of time.
 */
export function getTournamentPhase(
  config: TournamentConfig,
  now: Date = new Date()
): TournamentPhase {
  if (config.phaseOverride) return config.phaseOverride;

  const hostingOpens = config.hostingOpensAt
    ? parseISODate(config.hostingOpensAt)
    : null;
  const startDate = parseISODate(config.startDate);
  const endDateInclusive = endOfDay(config.endDate);
  const archiveAt = config.archiveAt
    ? parseISODate(config.archiveAt)
    : addDays(endDateInclusive, DEFAULT_ARCHIVE_DAYS_AFTER_END);

  if (hostingOpens && now < hostingOpens) return 'upcoming';
  if (now < startDate) return 'hostable';
  if (now <= endDateInclusive) return 'live';
  if (now < archiveAt) return 'completed';
  return 'archived';
}

/** True when a tournament is in the bookable + active windows. Replacement for legacy `isActive`. */
export function isTournamentActive(
  config: TournamentConfig,
  now: Date = new Date()
): boolean {
  const phase = getTournamentPhase(config, now);
  return phase === 'hostable' || phase === 'live';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `v2/`:

```bash
npm test -- phase.test.ts
```

Expected: All 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add v2/lib/tournaments/phase.ts v2/lib/tournaments/__tests__/phase.test.ts
git commit -m "feat: add getTournamentPhase helper with date-derived phases"
```

---

### Task 3: Add phase-aware registry helpers

**Files:**
- Modify: `v2/lib/tournaments/registry.ts`
- Create: `v2/lib/tournaments/__tests__/registry.test.ts`

- [ ] **Step 1: Write failing tests for new registry helpers**

Create `v2/lib/tournaments/__tests__/registry.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listSelectorTournaments,
  listPastTournaments,
  getFeaturedTournament,
} from '../registry';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('phase-aware registry helpers', () => {
  it('listSelectorTournaments excludes completed and archived', () => {
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    const ids = listSelectorTournaments().map((t) => t.config.id);

    expect(ids).not.toContain('march_madness_2026');
    expect(ids).not.toContain('masters_2026');
    expect(ids).not.toContain('kentucky_derby_2026');
  });

  it('listSelectorTournaments includes PGA Championship 2026 on May 10', () => {
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    const ids = listSelectorTournaments().map((t) => t.config.id);
    expect(ids).toContain('pga_championship_2026');
  });

  it('listPastTournaments includes recently-ended tournaments', () => {
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    const ids = listPastTournaments().map((t) => t.config.id);

    expect(ids).toContain('masters_2026');
    expect(ids).toContain('kentucky_derby_2026');
  });

  it('getFeaturedTournament prefers live > soonest hostable > soonest upcoming', () => {
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    const featured = getFeaturedTournament();
    // On May 10 with PGA hostable May 14, PGA should be the next hostable.
    expect(featured?.config.id).toBe('pga_championship_2026');
  });
});
```

> Note: `vi.useFakeTimers()` mocks `Date` globally, so the registry helpers' default `now = new Date()` parameter picks up the faked time. Static imports work fine — the helpers compute phase lazily on each call.

Note: this test depends on Task 4 (existing configs get `endDate`) and Task 5 (PGA config exists). The test file is committed now but assertions only pass after those tasks land. That's intentional — it forces us to keep the registry honest as we add configs.

- [ ] **Step 2: Add new helpers to `registry.ts`**

Open `v2/lib/tournaments/registry.ts`. After the existing `listHostableTournaments` function (around line 83), append:

```typescript
import { getTournamentPhase } from './phase';
import type { TournamentPhase } from './types';

/** Get the current phase for a tournament by ID. */
export function getPhase(id: string, now: Date = new Date()): TournamentPhase | undefined {
  const entry = TOURNAMENTS[id];
  return entry ? getTournamentPhase(entry.config, now) : undefined;
}

/** All tournaments grouped by current phase. */
export function listTournamentsByPhase(now: Date = new Date()): Record<TournamentPhase, TournamentEntry[]> {
  const buckets: Record<TournamentPhase, TournamentEntry[]> = {
    upcoming: [],
    hostable: [],
    live: [],
    completed: [],
    archived: [],
  };
  for (const entry of Object.values(TOURNAMENTS)) {
    const phase = getTournamentPhase(entry.config, now);
    buckets[phase].push(entry);
  }
  return buckets;
}

/** Tournaments to show in selectors and the "upcoming" strip — excludes completed/archived. */
export function listSelectorTournaments(now: Date = new Date()): TournamentEntry[] {
  const buckets = listTournamentsByPhase(now);
  return [...buckets.live, ...buckets.hostable, ...buckets.upcoming].sort((a, b) =>
    a.config.startDate.localeCompare(b.config.startDate)
  );
}

/** Tournaments in the "past" bucket — completed only, sorted by endDate descending (most recent first). */
export function listPastTournaments(now: Date = new Date()): TournamentEntry[] {
  const buckets = listTournamentsByPhase(now);
  return [...buckets.completed].sort((a, b) => b.config.endDate.localeCompare(a.config.endDate));
}

/**
 * The single tournament to feature on the homepage hero.
 * Priority: live (soonest endDate) > hostable (soonest startDate) > upcoming (soonest startDate).
 * Returns undefined if no tournament is in any of those phases.
 */
export function getFeaturedTournament(now: Date = new Date()): TournamentEntry | undefined {
  const buckets = listTournamentsByPhase(now);
  if (buckets.live.length > 0) {
    return [...buckets.live].sort((a, b) =>
      a.config.endDate.localeCompare(b.config.endDate)
    )[0];
  }
  if (buckets.hostable.length > 0) {
    return [...buckets.hostable].sort((a, b) =>
      a.config.startDate.localeCompare(b.config.startDate)
    )[0];
  }
  if (buckets.upcoming.length > 0) {
    return [...buckets.upcoming].sort((a, b) =>
      a.config.startDate.localeCompare(b.config.startDate)
    )[0];
  }
  return undefined;
}
```

- [ ] **Step 3: Update `getActiveTournament` to use phase logic**

Find the existing `getActiveTournament` function and replace it with:

```typescript
/**
 * Returns the tournament to default to in protected pages (strategy, payment).
 * Equivalent to getFeaturedTournament but always returns a value (falls back to first config).
 */
export function getActiveTournament(): TournamentEntry {
  const featured = getFeaturedTournament();
  if (featured) return featured;
  return Object.values(TOURNAMENTS)[0];
}
```

- [ ] **Step 4: Run new registry tests**

```bash
npm test -- registry.test.ts
```

Expected: tests for `listSelectorTournaments`/`listPastTournaments` pass for already-completed tournaments (March Madness/Masters/Derby) once Task 4 adds their `endDate`s. The PGA test fails until Task 5. That's OK for now — leave them.

- [ ] **Step 5: Run all existing tests to make sure nothing else broke**

```bash
npm test
```

Expected: existing 140+ tests still pass. New tests in `phase.test.ts` pass. Tests in `registry.test.ts` partially pass (the ones not depending on PGA).

- [ ] **Step 6: Commit**

```bash
git add v2/lib/tournaments/registry.ts v2/lib/tournaments/__tests__/registry.test.ts
git commit -m "feat: add phase-aware registry helpers (selector/past/featured)"
```

---

### Task 4: Migrate existing tournament configs with `endDate`

**Files:**
- Modify: `v2/lib/tournaments/configs/march-madness-2026.ts`
- Modify: `v2/lib/tournaments/configs/masters-2026.ts`
- Modify: `v2/lib/tournaments/configs/kentucky-derby-2026.ts`
- Modify: `v2/lib/tournaments/configs/world-cup-2026.ts`
- Modify: `v2/lib/tournaments/configs/nfl-season-2026.ts`
- Modify: `v2/lib/tournaments/configs/nfl-playoffs-2026.ts`

- [ ] **Step 1: Add `endDate` to March Madness 2026**

In `v2/lib/tournaments/configs/march-madness-2026.ts`, find the line with `startDate` and add `endDate` immediately after it:

```typescript
  startDate: '2026-03-17',
  endDate: '2026-04-06',
  hostingOpensAt: '...',
```

(Keep the existing `hostingOpensAt`. Set `endDate` to the day of the championship game: April 6, 2026.)

- [ ] **Step 2: Add `endDate` to Masters 2026**

In `v2/lib/tournaments/configs/masters-2026.ts`, after `startDate: '2026-04-09'`, add:

```typescript
  endDate: '2026-04-12',
```

- [ ] **Step 3: Add `endDate` to Kentucky Derby 2026**

In `v2/lib/tournaments/configs/kentucky-derby-2026.ts`, after `startDate: '2026-05-02'`, add:

```typescript
  endDate: '2026-05-02',
```

(Single-day event — start and end are the same.)

- [ ] **Step 4: Add `endDate` to World Cup 2026**

In `v2/lib/tournaments/configs/world-cup-2026.ts`, after the existing `startDate`, add:

```typescript
  endDate: '2026-07-19',
```

- [ ] **Step 5: Add `endDate` to NFL Season 2026**

In `v2/lib/tournaments/configs/nfl-season-2026.ts`, after the existing `startDate`, add:

```typescript
  endDate: '2027-02-07',
```

(Approximate Super Bowl date. Revise when official.)

- [ ] **Step 6: Add `endDate` to NFL Playoffs 2026**

In `v2/lib/tournaments/configs/nfl-playoffs-2026.ts`, after the existing `startDate`, add:

```typescript
  endDate: '2026-02-08',
```

(Already past — falls into archived once 30 days have elapsed.)

- [ ] **Step 7: Verify typecheck and tests**

Run from `v2/`:

```bash
npx tsc --noEmit
npm test
```

Expected: typecheck passes (no more "missing endDate" errors). All tests pass including the registry tests for completed tournaments.

- [ ] **Step 8: Commit**

```bash
git add v2/lib/tournaments/configs/
git commit -m "chore: backfill endDate on existing tournament configs"
```

---

### Task 5: Add PGA Championship 2026 skeleton config

**Files:**
- Create: `v2/lib/tournaments/configs/pga-championship-2026.ts`
- Modify: `v2/lib/tournaments/registry.ts`

- [ ] **Step 1: Create PGA config skeleton**

Create `v2/lib/tournaments/configs/pga-championship-2026.ts`:

```typescript
import type { TournamentConfig, BaseTeam } from '../types';

export const PGA_CHAMPIONSHIP_2026_CONFIG: TournamentConfig = {
  id: 'pga_championship_2026',
  name: 'PGA Championship 2026',
  sport: 'golf',
  rounds: [
    { key: 'makeCut', label: 'Cut', teamsAdvancing: 70, payoutLabel: 'Make the Cut', gameLabel: 'Cut' },
    { key: 'top20', label: 'T20', teamsAdvancing: 20, payoutLabel: 'Top 20', gameLabel: 'Top 20' },
    { key: 'top10', label: 'T10', teamsAdvancing: 10, payoutLabel: 'Top 10', gameLabel: 'Top 10' },
    { key: 'top5', label: 'T5', teamsAdvancing: 5, payoutLabel: 'Top 5', gameLabel: 'Top 5' },
    { key: 'winner', label: 'Win', teamsAdvancing: 1, payoutLabel: 'Winner', gameLabel: 'Final' },
  ],
  groups: [
    { key: 'favorites', label: 'Favorites' },
    { key: 'contenders', label: 'Contenders' },
    { key: 'longshots', label: 'Longshots' },
    { key: 'field', label: 'Field' },
  ],
  devigStrategy: 'global',
  defaultPayoutRules: {
    makeCut: 0.20,
    top20: 0.50,
    top10: 1.50,
    top5: 4.00,
    winner: 45.00,
    lowRoundR1: 0,
    lowRoundR2: 0,
    lowRoundR3: 0,
    lowRoundR4: 0,
    worstRound: 0,
    worstOverall: 0,
  },
  defaultPotSize: 5000,
  propBets: [
    { key: 'lowRoundR1', label: 'Low Round — Thu' },
    { key: 'lowRoundR2', label: 'Low Round — Fri' },
    { key: 'lowRoundR3', label: 'Low Round — Sat' },
    { key: 'lowRoundR4', label: 'Low Round — Sun' },
    { key: 'worstRound', label: 'Worst Single Round' },
    { key: 'worstOverall', label: 'DFL (Dead Last Overall)' },
  ],
  badge: 'PGA Championship 2026',
  teamLabel: 'Golfer',
  groupLabel: 'Tier',
  startDate: '2026-05-14',
  endDate: '2026-05-17',
  hostingOpensAt: '2026-04-30',
  isActive: true, // legacy field — derived alias would also be true (phase: hostable on May 5)
  strategyPrice: 1999,
  stripePaymentLinkEnvKey: 'NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PGA',
};

/**
 * PGA Championship 2026 field — placeholder until real DataGolf odds are pulled.
 * Run `node scripts/fetch-pga-odds.mjs` (to be created from fetch-masters-odds.mjs)
 * before May 14 to populate the full field.
 */
export const PGA_CHAMPIONSHIP_2026_TEAMS: BaseTeam[] = [
  // TODO: populate from DataGolf before May 14, 2026.
  // Use scripts/fetch-masters-odds.mjs as template — adapt event slug to PGA Championship.
  { id: 1, name: 'Scottie Scheffler', seed: 1, group: 'favorites', americanOdds: { makeCut: -10000, top20: -1000, top10: -400, top5: -150, winner: +600 } },
  { id: 2, name: 'Rory McIlroy', seed: 2, group: 'favorites', americanOdds: { makeCut: -5000, top20: -500, top10: -200, top5: +100, winner: +1000 } },
];
```

> Note: The 2-player placeholder field is intentional. A follow-up commit before May 14 runs the DataGolf script to populate the full field. The skeleton is sufficient to verify lifecycle plumbing through Phase 1.

- [ ] **Step 2: Register PGA in the tournament registry**

In `v2/lib/tournaments/registry.ts`, add the import alongside other tournament imports (around line 8-23):

```typescript
import {
  PGA_CHAMPIONSHIP_2026_CONFIG,
  PGA_CHAMPIONSHIP_2026_TEAMS,
} from './configs/pga-championship-2026';
```

Then add an entry to the `TOURNAMENTS` map (right after `masters_2026`, before `kentucky_derby_2026`):

```typescript
  pga_championship_2026: {
    config: PGA_CHAMPIONSHIP_2026_CONFIG,
    teams: PGA_CHAMPIONSHIP_2026_TEAMS,
  },
```

- [ ] **Step 3: Verify Masters and PGA isActive flags**

In `v2/lib/tournaments/configs/masters-2026.ts`, change:

```typescript
  isActive: true,
```

to:

```typescript
  isActive: false, // Tournament completed 2026-04-12 — kept for legacy alias compat
```

(Phase logic now derives this from dates; the explicit `false` keeps the legacy boolean honest for any code still reading it directly.)

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: All tests pass including `registry.test.ts` PGA assertions.

- [ ] **Step 5: Commit**

```bash
git add v2/lib/tournaments/configs/pga-championship-2026.ts v2/lib/tournaments/registry.ts v2/lib/tournaments/configs/masters-2026.ts
git commit -m "feat: add PGA Championship 2026 skeleton config"
```

---

### Task 6: Rename `/auction` route to `/strategy` with redirects

**Files:**
- Move: `v2/app/(protected)/auction/` → `v2/app/(protected)/strategy/`
- Modify: `v2/next.config.ts`
- Modify: any internal links pointing to `/auction`

- [ ] **Step 1: Move the route directory**

From the repo root:

```bash
git mv v2/app/\(protected\)/auction v2/app/\(protected\)/strategy
```

Verify with:

```bash
ls v2/app/\(protected\)/strategy/
```

Expected: contains `page.tsx`.

- [ ] **Step 2: Add 308 redirects in `next.config.ts`**

Open `v2/next.config.ts`. Replace the entire file with:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/auction",
        destination: "/strategy",
        permanent: true,
      },
      {
        source: "/auction/:path*",
        destination: "/strategy/:path*",
        permanent: true,
      },
    ];
  },
  // PostHog reverse proxy — prevent ad blockers from blocking analytics
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
```

- [ ] **Step 3: Find all internal links to `/auction`**

```bash
grep -rn "href=\"/auction\|href={\`/auction\|href=['\"]/auction" v2/ | grep -v node_modules | grep -v ".next"
```

Expected: a list of files with hardcoded `/auction` links (likely in landing components, dashboards, navbar).

- [ ] **Step 4: Replace each `/auction` link with `/strategy`**

For each file in the grep output, change:
- `href="/auction"` → `href="/strategy"`
- `` href={`/auction?tournament=${id}`} `` → `` href={`/strategy?tournament=${id}`} ``
- Etc.

Use the editor's find/replace per file rather than sed. Common locations:
- `v2/components/layout/navbar.tsx`
- `v2/components/landing/hero-section.tsx` (line 46)
- `v2/components/landing/cta-section.tsx`
- `v2/components/dashboard/user-dashboard.tsx`

Do NOT edit blog post markdown content — those external-facing URLs already redirect.

- [ ] **Step 5: Verify the redirect locally**

Start the dev server:

```bash
cd v2 && npm run dev
```

In a browser, visit `http://localhost:3000/auction`. Expected: redirects to `/strategy`.

Visit `http://localhost:3000/auction?tournament=pga_championship_2026`. Expected: redirects to `/strategy?tournament=pga_championship_2026`.

- [ ] **Step 6: Build to confirm no broken imports**

```bash
npm run build
```

Expected: build succeeds. Any "module not found" errors mean an import wasn't updated.

- [ ] **Step 7: Commit**

```bash
git add v2/app v2/next.config.ts v2/components
git commit -m "feat: rename /auction route to /strategy with 308 redirect"
```

---

### Task 7: Update strategy page selector to filter by phase

**Files:**
- Modify: `v2/app/(protected)/strategy/page.tsx`

- [ ] **Step 1: Update tournament selector logic**

Open `v2/app/(protected)/strategy/page.tsx`. Find the import line (around line 5):

```typescript
import { getActiveTournament, getTournament, listTournaments, getOddsRegistry } from '@/lib/tournaments/registry'
```

Replace `listTournaments` with `listSelectorTournaments`:

```typescript
import { getActiveTournament, getTournament, listSelectorTournaments, getOddsRegistry } from '@/lib/tournaments/registry'
import { getTournamentPhase } from '@/lib/tournaments/phase'
```

Find the line:

```typescript
  const allTournaments = listTournaments()
```

Replace with:

```typescript
  const allTournaments = listSelectorTournaments().map((entry) => entry.config)
```

- [ ] **Step 2: Update tournament URL validation**

Find the existing block:

```typescript
  // Resolve tournament: use ?tournament= param if it's an active tournament, else default
  const activeTournament = getActiveTournament()
  const requestedTournament = params.tournament ? getTournament(params.tournament) : null
  const selectedTournament = (requestedTournament && requestedTournament.config.isActive)
    ? requestedTournament
    : activeTournament
```

Replace with:

```typescript
  // Resolve tournament: use ?tournament= param if it's still in selector phase, else default to featured.
  // Visiting a completed/archived tournament URL silently falls back to the featured event.
  const activeTournament = getActiveTournament()
  const requestedTournament = params.tournament ? getTournament(params.tournament) : null
  const requestedPhase = requestedTournament ? getTournamentPhase(requestedTournament.config) : undefined
  const isRequestedSelectable = requestedPhase === 'live' || requestedPhase === 'hostable' || requestedPhase === 'upcoming'
  const selectedTournament = (requestedTournament && isRequestedSelectable)
    ? requestedTournament
    : activeTournament
```

- [ ] **Step 3: Update the selector pill rendering**

Around line 56, find the loop that renders pills:

```typescript
          {allTournaments.map((t) => {
            if (t.isActive) {
```

Replace the entire pill-rendering block with phase-aware version:

```typescript
          {allTournaments.map((t) => {
            const phase = getTournamentPhase(t)
            const isSelectable = phase === 'live' || phase === 'hostable'
            if (isSelectable) {
              const isSelected = t.id === config.id
              return (
                <Link
                  key={t.id}
                  href={`/strategy?tournament=${t.id}`}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                      : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.06] hover:text-white/70 ring-1 ring-white/10'
                  }`}
                >
                  {t.name}
                </Link>
              )
            }
            // Upcoming tournaments: disabled "Coming Soon" pill (Phase 2 makes these click-to-buy CTAs)
            const startDate = new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            return (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-white/[0.02] text-white/20 cursor-default select-none"
                title={`Coming ${startDate}`}
              >
                <Lock className="size-3 text-white/15" />
                {t.name}
                <span className="text-[10px] text-white/15 ml-0.5">{startDate}</span>
              </span>
            )
          })}
```

- [ ] **Step 4: Verify locally**

Restart dev server (`npm run dev` from `v2/`) and visit `http://localhost:3000/strategy`.

Expected behavior on May 5, 2026:
- Selector shows PGA Championship 2026 as the active selectable pill
- Masters, March Madness, Kentucky Derby are NOT in the selector (completed)
- Other golf tournaments and NFL season may show as disabled "Coming Soon" pills if their `hostingOpensAt` is in the future

Visit `http://localhost:3000/strategy?tournament=masters_2026`. Expected: silently redirects to PGA (the featured tournament).

- [ ] **Step 5: Run tests + build**

```bash
npm test
npm run build
```

Expected: all tests pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add v2/app/\(protected\)/strategy/page.tsx
git commit -m "feat: strategy page selector filters by tournament phase"
```

---

### Task 8: Update payment route for phase awareness

**Files:**
- Modify: `v2/app/(protected)/payment/page.tsx`

- [ ] **Step 1: Inspect current payment route logic**

Read `v2/app/(protected)/payment/page.tsx` lines 40-60. Find the `isActive` reference around line 48:

```typescript
  const { config } = (requestedTournament && requestedTournament.config.isActive)
    ? requestedTournament
    : activeTournament
```

- [ ] **Step 2: Update to phase-aware tournament resolution**

Replace the same block with:

```typescript
  const requestedPhase = requestedTournament ? getTournamentPhase(requestedTournament.config) : undefined
  const isPayable = requestedPhase === 'live' || requestedPhase === 'hostable' || requestedPhase === 'upcoming'
  const { config } = (requestedTournament && isPayable)
    ? requestedTournament
    : activeTournament
```

Add the import at the top:

```typescript
import { getTournamentPhase } from '@/lib/tournaments/phase'
```

- [ ] **Step 3: Verify build**

```bash
cd v2 && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add v2/app/\(protected\)/payment/page.tsx
git commit -m "feat: payment route uses phase logic instead of isActive"
```

---

### Task 9: Filter dashboard sessions by tournament phase

**Files:**
- Modify: `v2/actions/dashboard.ts`

- [ ] **Step 1: Find current session filtering logic**

Open `v2/actions/dashboard.ts`. The `getDashboardData()` function builds `dashboardSessions: DashboardSession[]` (declared earlier in the function) and returns it directly. Each entry has a `tournamentId`. The function already imports `getTournament` from registry (around line 4).

- [ ] **Step 2: Add the phase import**

Near the existing import for `getTournament` (around line 4), add:

```typescript
import { getTournamentPhase } from '@/lib/tournaments/phase';
```

- [ ] **Step 3: Filter completed/archived sessions before returning**

Find the existing return block at the bottom of the function (around line 392-403):

```typescript
  const totalPotExposure = dashboardSessions.reduce((s, d) => s + d.userTotalSpent, 0);
  const totalEarned = dashboardSessions.reduce((s, d) => s + d.userTotalEarned, 0);
  const totalNetPL = dashboardSessions.reduce((s, d) => s + d.userNetPL, 0);

  return {
    sessions: dashboardSessions,
    totalPotExposure,
    totalEarned,
    totalNetPL,
    aliveTeams: allAliveTeams,
  };
}
```

Replace it with:

```typescript
  // Totals are lifetime — computed across ALL sessions including completed.
  const totalPotExposure = dashboardSessions.reduce((s, d) => s + d.userTotalSpent, 0);
  const totalEarned = dashboardSessions.reduce((s, d) => s + d.userTotalEarned, 0);
  const totalNetPL = dashboardSessions.reduce((s, d) => s + d.userNetPL, 0);

  // Phase 1: hide sessions for completed/archived tournaments from the active list.
  // Phase 2 will reintroduce them under a collapsible "Past Leagues" section.
  const visibleSessions = dashboardSessions.filter((session) => {
    const tournament = getTournament(session.tournamentId);
    if (!tournament) return true; // unknown tournament — keep visible to avoid orphaning
    const phase = getTournamentPhase(tournament.config);
    return phase === 'live' || phase === 'hostable' || phase === 'upcoming';
  });

  return {
    sessions: visibleSessions,
    totalPotExposure,
    totalEarned,
    totalNetPL,
    aliveTeams: allAliveTeams,
  };
}
```

> Note: lifetime totals (`totalPotExposure`, `totalEarned`, `totalNetPL`) are computed BEFORE filtering, so the dashboard's top-level stats remain accurate. Only the per-league list shrinks.

- [ ] **Step 4: Verify locally**

Start dev server, log in as a user with a completed Masters auction. Expected: dashboard no longer shows Masters in active leagues. Active list shows only sessions where the tournament is still hostable/live (e.g., PGA hosts).

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: existing tests pass. (Dashboard isn't currently unit-tested — manual verification is the gate here.)

- [ ] **Step 6: Commit**

```bash
git add v2/actions/dashboard.ts
git commit -m "feat: dashboard hides sessions for completed tournaments"
```

---

### Task 10: End-to-end smoke test + final verification

**Files:** none (manual verification + final build).

- [ ] **Step 1: Full build**

```bash
cd v2 && npm run build
```

Expected: clean build with no errors or warnings about deprecated APIs.

- [ ] **Step 2: Full test suite**

```bash
npm test
```

Expected: all tests pass (existing 140+ plus new phase + registry tests).

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Local smoke test checklist**

Start dev server (`npm run dev`). With browser logged in as `pwiddoss22@gmail.com`:

- [ ] Visit `/` (homepage) — still shows hardcoded Masters hero (Phase 2 changes this)
- [ ] Visit `/strategy` — selector shows PGA as active, completed tournaments absent
- [ ] Visit `/auction` — redirects to `/strategy` with 308
- [ ] Visit `/auction?tournament=masters_2026` — redirects to `/strategy?tournament=masters_2026`, then silently falls back to featured (PGA)
- [ ] Visit `/strategy?tournament=masters_2026` directly — silently loads PGA
- [ ] Visit `/strategy?tournament=pga_championship_2026` — loads PGA strategy page
- [ ] Visit `/dashboard` — Masters auctions no longer in active leagues
- [ ] Visit `/payment?tournament=pga_championship_2026` — loads payment page for PGA

- [ ] **Step 5: Confirm Vercel preview deploy works**

```bash
git push origin <current-branch>
```

(Replace `<current-branch>` with `claude/laughing-chaplygin-4380f4`.)

Vercel will auto-create a preview deployment. Open the preview URL and re-run the smoke test checklist.

> **Important:** Do NOT push to `main` without user approval. The user runs `/pre-deploy-review` before any production deploy.

- [ ] **Step 6: Final commit (if any cleanup)**

If the smoke test surfaced any issues, fix them in a final commit:

```bash
git add <files>
git commit -m "fix: <issue from smoke test>"
```

If everything's clean, no commit needed. Phase 1 complete.

---

## Post-Phase-1 Follow-ups (NOT part of this plan)

These get tracked separately and ship before May 14 but are independent of this lifecycle plan:

1. **Populate full PGA Championship 2026 field** — adapt `scripts/fetch-masters-odds.mjs` to pull DataGolf odds for PGA. Replace the 2-player placeholder in `pga-championship-2026.ts`.
2. **Create PGA Stripe Product manually** — Stripe dashboard → create Product → create Payment Link → add `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PGA` env var to Vercel. (Phase 3 automates this; Phase 1 does it once by hand.)

## Phase 2 Preview (separate plan)

After Phase 1 ships:
- Date-aware homepage hero (replace hardcoded Masters copy)
- Wire up unused `EventsStripSection` component on homepage
- Locked tournament pills become "Buy access" CTAs
- Dashboard "Past Leagues" collapsible section
