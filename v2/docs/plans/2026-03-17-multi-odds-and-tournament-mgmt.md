# Multi-Odds Source System + Tournament Management Deploy

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship tournament results management (migration + test + deploy) AND add multi-source odds toggling (Evan Miya, TeamRankings, sportsbook API) to the strategy tool.

**Architecture:** Three independent workstreams. WS1 deploys the already-built tournament management system (apply DB migration, verify, deploy). WS2 adds a multi-odds source system — static sources (Evan Miya updated, TeamRankings) stored in config, sportsbook odds fetched via The Odds API with server-side caching and devigging, user toggles source via dropdown in strategy tool. WS3 is marketing content. WS1 and WS2 can run in parallel.

**Tech Stack:** Next.js 16, Supabase PostgreSQL, TypeScript, Tailwind, shadcn/ui, The Odds API

---

## Workstream 1: Tournament Management — Deploy

### Context
All code exists and is wired up. The only missing step is applying migration 00003 to production Supabase and verifying everything works.

Files that exist (DO NOT recreate):
- Migration: `v2/supabase/migrations/00003_tournament_results.sql`
- Server actions: `v2/actions/tournament-results.ts`
- Calculations: `v2/lib/auction/live/actual-payouts.ts`
- Debt simplification: `v2/lib/auction/live/debt-simplification.ts`
- Bracket utils: `v2/lib/auction/live/bracket-utils.ts`
- Dashboard: `v2/components/live/tournament-dashboard.tsx`
- Sub-components: `bracket-entry.tsx`, `results-entry.tsx`, `leaderboard.tsx`, `settlement-matrix.tsx`, `props-entry.tsx`
- Already wired into `commissioner-view.tsx` and `participant-view.tsx`

### Task 1.1: Apply Migration to Production

**Step 1:** Read migration file to confirm contents:
```
v2/supabase/migrations/00003_tournament_results.sql
```

**Step 2:** Apply via Supabase MCP `apply_migration` tool. This creates:
- `tournament_results` table (session_id, team_id, round_key, result)
- RLS policies for participants (read) and commissioners (write)
- Indexes on session_id and session_id+round_key
- `tournament_status` column on `auction_sessions`

**Step 3:** Verify table exists:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'tournament_results';
```

**Step 4:** Verify column added:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'auction_sessions' AND column_name = 'tournament_status';
```

**Step 5:** Also add missing columns for props and payment tracking (referenced in `tournament-results.ts` server actions but not in migration):
```sql
ALTER TABLE public.auction_sessions
  ADD COLUMN IF NOT EXISTS prop_results jsonb DEFAULT '[]';
ALTER TABLE public.auction_sessions
  ADD COLUMN IF NOT EXISTS payment_tracking jsonb DEFAULT '{}';
```

### Task 1.2: Build Verification

**Step 1:** Run `cd v2 && npm run build` — ensure no TypeScript errors related to tournament management imports

**Step 2:** Run `cd v2 && npm test` — ensure all existing tests pass (55+)

**Step 3:** Fix any issues found

### Task 1.3: Deploy

**Step 1:** Commit any fixes from 1.2
**Step 2:** Push to main (auto-deploys on Vercel)
**Step 3:** Verify deployment succeeds on Vercel

---

## Workstream 2: Multi-Odds Source System

### Architecture Overview

```
┌──────────────────────────────────────────────────┐
│  Strategy Tool UI  (auction-tool.tsx)             │
│  ┌──────────────────────────────────────────────┐ │
│  │  Odds Source Selector (dropdown)             │ │
│  │  [Evan Miya ▾] [TeamRankings] [Pinnacle]... │ │
│  └──────────────────────────────────────────────┘ │
│         │ SET_ODDS_SOURCE action                  │
│         ▼                                         │
│  AuctionState.oddsSource → swaps probabilities   │
│  on BaseTeam[] → re-runs initializeTeams()       │
│         │                                         │
│         ▼                                         │
│  calculateImpliedProbabilities() (existing)       │
│  calculateTeamValues() (existing)                 │
│  → fair values, edge, profit all recalculate     │
└──────────────────────────────────────────────────┘

Static Sources:                    API Sources:
┌─────────────┐                   ┌──────────────────┐
│ Evan Miya   │                   │ /api/odds/ncaab  │
│ (updated)   │                   │ ┌──────────────┐ │
├─────────────┤                   │ │ Cache (15min)│ │
│ TeamRankings│                   │ └──────┬───────┘ │
└─────────────┘                   │        │         │
                                  │  The Odds API    │
                                  │  ┌──────────────┐│
                                  │  │Devig futures ││
                                  │  │Binary YES/NO ││
                                  │  └──────────────┘│
                                  └──────────────────┘
```

### Task 2.1: Define Odds Source Types

**Files:**
- Create: `v2/lib/tournaments/odds-sources.ts`

**Step 1:** Create the odds source type definitions:

```typescript
// v2/lib/tournaments/odds-sources.ts
import type { RoundKey } from './types';

/** Per-team probability data from a single source */
export interface OddsSourceProbabilities {
  /** Map from teamId → per-round probabilities (0-1, cumulative) */
  teams: Record<number, Record<RoundKey, number>>;
  /** Timestamp when this data was last fetched/updated */
  updatedAt: string;
}

export interface OddsSource {
  id: string;
  name: string;
  description: string;
  type: 'model' | 'sportsbook';
  /** Whether this source requires an API call to fetch */
  isRemote: boolean;
  /** For sportsbook sources: which bookmaker key in The Odds API */
  bookmakerKey?: string;
}

/** Registry of available odds sources for a tournament */
export interface OddsSourceRegistry {
  sources: OddsSource[];
  defaultSourceId: string;
  /** Static probability data keyed by source ID */
  staticData: Record<string, OddsSourceProbabilities>;
}
```

**Step 2:** Run `cd v2 && npx tsc --noEmit` to verify types compile.

### Task 2.2: Update Evan Miya Probabilities from CSV

**Files:**
- Modify: `v2/lib/tournaments/configs/march-madness-2026.ts`

**Context:** The current probabilities in the config are stale. The updated CSV at `C:\Users\pwidd\Downloads\data (1).csv` has new values. The CSV has no `group` (region) column, so match by team name to existing region assignments. The CSV uses `team` column for names.

**Step 1:** Update each team's `probabilities` object in `MARCH_MADNESS_2026_TEAMS` to match the CSV values. Key changes include:
- Michigan champ: 0.3143 → 0.2647
- Arizona S16: 0.9084 → 0.8975
- Duke champ: 0.1884 → 0.1896
- (Update ALL 68 teams from CSV)

**IMPORTANT:** Match names carefully. CSV uses "McNeese State" but config uses "McNeese". CSV uses "St. John's" and config uses "St. John's". Fuzzy-match and verify each.

**Step 2:** Run `cd v2 && npm test` — verify all calculation tests still pass.

### Task 2.3: Add TeamRankings Static Data

**Files:**
- Create: `v2/lib/tournaments/data/team-rankings-2026.ts`

**Step 1:** Create a file with TeamRankings probabilities parsed from the data below. These are cumulative probabilities (probability of REACHING each round).

The raw data has columns: Seed, Team, Region, Exp. Wins, Make R32, Make S16, Make E8, Make F4, Make Final, Win It All.

Map to our round keys: R32→r32, S16→s16, E8→e8, F4→f4, Final→f2, Win It All→champ.

Convert percentages to decimals (87.9% → 0.879).

**IMPORTANT:** Match team names to IDs from `MARCH_MADNESS_2026_TEAMS`. Use the `name` field. TeamRankings uses slightly different names (e.g., "Iowa St" vs "Iowa State", "N Iowa" vs "Northern Iowa"). Create a name mapping.

```typescript
// v2/lib/tournaments/data/team-rankings-2026.ts
import type { OddsSourceProbabilities } from '../odds-sources';

/** TeamRankings March Madness 2026 probabilities */
export const TEAM_RANKINGS_2026: OddsSourceProbabilities = {
  updatedAt: '2026-03-17T00:00:00Z',
  teams: {
    // Match IDs from MARCH_MADNESS_2026_TEAMS
    1: { r32: 0.993, s16: 0.803, e8: 0.608, f4: 0.456, f2: 0.296, champ: 0.178 }, // Duke
    // ... all 68 teams
  },
};
```

**Step 2:** Verify all 68 team IDs are present and probabilities are reasonable.

### Task 2.4: Build Odds Source Registry for March Madness

**Files:**
- Modify: `v2/lib/tournaments/configs/march-madness-2026.ts`
- Modify: `v2/lib/tournaments/odds-sources.ts`

**Step 1:** Add a function to build the registry:

```typescript
// In odds-sources.ts, add:
export function buildMarchMadness2026Registry(): OddsSourceRegistry {
  // Import static data
  const evanMiyaData = buildEvanMiyaData(); // extract from MARCH_MADNESS_2026_TEAMS
  const teamRankingsData = TEAM_RANKINGS_2026;

  return {
    sources: [
      { id: 'evan_miya', name: 'Evan Miya', description: 'Statistical model (updated 3/17)', type: 'model', isRemote: false },
      { id: 'team_rankings', name: 'TeamRankings', description: 'Composite model', type: 'model', isRemote: false },
      { id: 'pinnacle', name: 'Pinnacle', description: 'Sharp sportsbook odds (devigged)', type: 'sportsbook', isRemote: true, bookmakerKey: 'pinnacle' },
      { id: 'draftkings', name: 'DraftKings', description: 'Sportsbook odds (devigged)', type: 'sportsbook', isRemote: true, bookmakerKey: 'draftkings' },
      { id: 'fanduel', name: 'FanDuel', description: 'Sportsbook odds (devigged)', type: 'sportsbook', isRemote: true, bookmakerKey: 'fanduel' },
    ],
    defaultSourceId: 'evan_miya',
    staticData: {
      evan_miya: evanMiyaData,
      team_rankings: teamRankingsData,
    },
  };
}
```

**Step 2:** Add helper to extract Evan Miya probabilities from the existing teams array into the OddsSourceProbabilities format:

```typescript
function buildEvanMiyaData(): OddsSourceProbabilities {
  const teams: Record<number, Record<string, number>> = {};
  for (const t of MARCH_MADNESS_2026_TEAMS) {
    if (t.probabilities) {
      teams[t.id] = { ...t.probabilities };
    }
  }
  return { updatedAt: '2026-03-17T00:00:00Z', teams };
}
```

### Task 2.5: API Route for Sportsbook Odds

**Files:**
- Create: `v2/app/api/odds/ncaab/route.ts`
- Create: `v2/lib/odds-api/client.ts`
- Create: `v2/lib/odds-api/devig.ts`
- Create: `v2/lib/odds-api/team-mapping.ts`

**Step 1:** Create The Odds API client (`v2/lib/odds-api/client.ts`):

```typescript
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

export interface OddsApiResponse {
  id: string;
  sport_key: string;
  commence_time: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number; // decimal odds
      }>;
    }>;
  }>;
}

/**
 * Fetch NCAAB championship winner odds from The Odds API.
 * Sport key: 'basketball_ncaab_championship_winner'
 * Also try round-specific futures if available.
 */
export async function fetchNcaabFutures(apiKey: string): Promise<OddsApiResponse[]> {
  const sportKeys = [
    'basketball_ncaab_championship_winner',
  ];

  const results: OddsApiResponse[] = [];

  for (const sportKey of sportKeys) {
    try {
      const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?apiKey=${apiKey}&regions=us,us2&oddsFormat=decimal&markets=outrights`;
      const res = await fetch(url, { next: { revalidate: 900 } }); // 15 min cache
      if (res.ok) {
        const data = await res.json();
        // The Odds API returns an array or single object depending on endpoint
        if (Array.isArray(data)) {
          results.push(...data);
        } else {
          results.push(data);
        }
      }
    } catch {
      // Silently skip unavailable markets
    }
  }

  return results;
}
```

**Step 2:** Create devig utility (`v2/lib/odds-api/devig.ts`):

```typescript
/**
 * Devig a set of outright/futures decimal odds.
 *
 * For an outright market (68 teams to win championship):
 * 1. Convert each decimal odds → implied probability: 1/odds
 * 2. Sum all implied probabilities (will be > 1 due to vig)
 * 3. Fair probability = implied / sum (normalize to 1)
 *
 * For binary YES/NO markets (e.g., "Team X to reach S16"):
 * 1. impliedYes = 1/yesOdds, impliedNo = 1/noOdds
 * 2. fairYes = impliedYes / (impliedYes + impliedNo)
 */

export function devigOutrightMarket(
  outcomes: Array<{ name: string; decimalOdds: number }>
): Array<{ name: string; fairProbability: number }> {
  const implied = outcomes.map((o) => ({
    name: o.name,
    impliedProb: 1 / o.decimalOdds,
  }));

  const totalImplied = implied.reduce((sum, o) => sum + o.impliedProb, 0);
  if (totalImplied === 0) return [];

  return implied.map((o) => ({
    name: o.name,
    fairProbability: o.impliedProb / totalImplied,
  }));
}

export function devigBinaryMarket(
  yesDecimalOdds: number,
  noDecimalOdds: number
): number {
  const impliedYes = 1 / yesDecimalOdds;
  const impliedNo = 1 / noDecimalOdds;
  return impliedYes / (impliedYes + impliedNo);
}
```

**Step 3:** Create team name mapping (`v2/lib/odds-api/team-mapping.ts`):

Sportsbook team names differ from our config names. Create a mapping:

```typescript
import { MARCH_MADNESS_2026_TEAMS } from '@/lib/tournaments/configs/march-madness-2026';

/**
 * Map sportsbook team names to our internal team IDs.
 * Sportsbooks use various name formats:
 * - "Duke Blue Devils" vs our "Duke"
 * - "UConn Huskies" vs our "Connecticut"
 * - "Miami (FL) Hurricanes" vs our "Miami (Fla.)"
 */
const SPORTSBOOK_NAME_MAP: Record<string, string> = {
  // Add known mismatches
  'UConn Huskies': 'Connecticut',
  'Connecticut Huskies': 'Connecticut',
  'Miami Hurricanes': 'Miami (Fla.)',
  'Miami (FL) Hurricanes': 'Miami (Fla.)',
  'Miami FL': 'Miami (Fla.)',
  'St Johns': "St. John's",
  "St. John's Red Storm": "St. John's",
  'Cal Baptist': 'California Baptist',
  'N Dakota St': 'North Dakota State',
  'McNeese St': 'McNeese',
  'McNeese State': 'McNeese',
  'McNeese Cowboys': 'McNeese',
  'Iowa St': 'Iowa State',
  'Iowa State Cyclones': 'Iowa State',
  'Michigan St': 'Michigan State',
  'NC St': 'NC State',
  'NC State Wolfpack': 'NC State',
  'N Iowa': 'Northern Iowa',
  "Saint Mary's Gaels": "Saint Mary's",
  'Miami Ohio': 'Miami (OH)',
  'Miami (OH) RedHawks': 'Miami (OH)',
  'USF Bulls': 'South Florida',
  'South Florida Bulls': 'South Florida',
  'NDSU': 'North Dakota State',
  'LIU Sharks': 'Long Island',
  'Prairie View A&M': 'Prairie View',
  // Most teams will match by stripping " [Mascot]" suffix
};

/**
 * Resolve a sportsbook team name to our internal team ID.
 * Strategy:
 * 1. Exact match on our name
 * 2. Lookup in SPORTSBOOK_NAME_MAP
 * 3. Strip common suffixes and try fuzzy match
 */
export function resolveTeamId(sportsbookName: string): number | null {
  // Direct match
  const direct = MARCH_MADNESS_2026_TEAMS.find(
    (t) => t.name.toLowerCase() === sportsbookName.toLowerCase()
  );
  if (direct) return direct.id;

  // Mapped name
  const mapped = SPORTSBOOK_NAME_MAP[sportsbookName];
  if (mapped) {
    const team = MARCH_MADNESS_2026_TEAMS.find(
      (t) => t.name.toLowerCase() === mapped.toLowerCase()
    );
    if (team) return team.id;
  }

  // Strip common mascot suffixes (e.g., "Duke Blue Devils" → "Duke")
  for (const t of MARCH_MADNESS_2026_TEAMS) {
    if (sportsbookName.toLowerCase().startsWith(t.name.toLowerCase())) {
      return t.id;
    }
  }

  return null;
}
```

**Step 4:** Create the API route (`v2/app/api/odds/ncaab/route.ts`):

```typescript
import { NextResponse } from 'next/server';
import { fetchNcaabFutures } from '@/lib/odds-api/client';
import { devigOutrightMarket } from '@/lib/odds-api/devig';
import { resolveTeamId } from '@/lib/odds-api/team-mapping';
import type { OddsSourceProbabilities } from '@/lib/tournaments/odds-sources';
import { MARCH_MADNESS_2026_TEAMS } from '@/lib/tournaments/configs/march-madness-2026';

// In-memory cache with 15-minute TTL
let cache: { data: Record<string, OddsSourceProbabilities>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET() {
  // Check cache
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.data);
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Odds API not configured' }, { status: 500 });
  }

  try {
    const responses = await fetchNcaabFutures(apiKey);

    // Group by bookmaker
    const byBookmaker: Record<string, OddsSourceProbabilities> = {};

    for (const event of responses) {
      for (const bookmaker of event.bookmakers) {
        if (!byBookmaker[bookmaker.key]) {
          byBookmaker[bookmaker.key] = {
            teams: {},
            updatedAt: new Date().toISOString(),
          };
        }

        for (const market of bookmaker.markets) {
          if (market.key === 'outrights') {
            // Devig the full outright market
            const outcomes = market.outcomes.map((o) => ({
              name: o.name,
              decimalOdds: o.price,
            }));
            const devigged = devigOutrightMarket(outcomes);

            for (const dv of devigged) {
              const teamId = resolveTeamId(dv.name);
              if (teamId === null) continue;

              // Championship outright → champ round probability
              if (!byBookmaker[bookmaker.key].teams[teamId]) {
                byBookmaker[bookmaker.key].teams[teamId] = {
                  r32: 0, s16: 0, e8: 0, f4: 0, f2: 0, champ: 0,
                };
              }
              byBookmaker[bookmaker.key].teams[teamId].champ = dv.fairProbability;
            }
          }
        }
      }
    }

    // Derive missing round probabilities from championship odds
    // Strategy: scale the default model (Evan Miya) proportionally
    for (const [, sourceData] of Object.entries(byBookmaker)) {
      for (const [teamIdStr, probs] of Object.entries(sourceData.teams)) {
        const teamId = parseInt(teamIdStr, 10);
        const baseTeam = MARCH_MADNESS_2026_TEAMS.find((t) => t.id === teamId);
        if (!baseTeam?.probabilities) continue;

        const baseChamp = baseTeam.probabilities.champ;
        if (baseChamp <= 0 || probs.champ <= 0) continue;

        // Scale factor: sportsbook champ / model champ
        const scale = probs.champ / baseChamp;

        // Apply to other rounds, capping at reasonable bounds
        const roundKeys = ['r32', 's16', 'e8', 'f4', 'f2'] as const;
        for (const rk of roundKeys) {
          if (probs[rk] === 0) {
            const baseProb = baseTeam.probabilities[rk] ?? 0;
            // Scale and cap between 0 and 0.999
            probs[rk] = Math.min(0.999, Math.max(0, baseProb * scale));
          }
        }

        // Ensure monotonic decrease: r32 >= s16 >= e8 >= f4 >= f2 >= champ
        const orderedKeys = ['r32', 's16', 'e8', 'f4', 'f2', 'champ'] as const;
        for (let i = 1; i < orderedKeys.length; i++) {
          if (probs[orderedKeys[i]] > probs[orderedKeys[i - 1]]) {
            probs[orderedKeys[i]] = probs[orderedKeys[i - 1]];
          }
        }
      }
    }

    // Cache results
    cache = { data: byBookmaker, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(byBookmaker);
  } catch (error) {
    console.error('Odds API error:', error);
    return NextResponse.json({ error: 'Failed to fetch odds' }, { status: 500 });
  }
}
```

**Step 5:** Run `cd v2 && npx tsc --noEmit` — verify all types compile.

### Task 2.6: Add Odds Source to Auction State

**Files:**
- Modify: `v2/lib/auction/auction-state.ts`
- Modify: `v2/lib/calculations/initialize.ts`

**Step 1:** Add `oddsSource` and `oddsSourceRegistry` to AuctionState:

```typescript
// In AuctionState interface, add:
oddsSource: string; // source ID (e.g., 'evan_miya')

// In INITIAL_STATE, add:
oddsSource: 'evan_miya',
```

**Step 2:** Add new action:

```typescript
// In AuctionAction union, add:
| { type: 'SET_ODDS_SOURCE'; sourceId: string; probabilities: Record<number, Record<string, number>> }
```

**Step 3:** Add reducer case:

```typescript
case 'SET_ODDS_SOURCE': {
  // Swap probabilities on each team, then recalculate
  const teams = state.teams.map((t) => {
    const sourceProbs = action.probabilities[t.id];
    if (!sourceProbs) return t;
    return {
      ...t,
      probabilities: sourceProbs,
      // Reset calculated fields (will be recalculated)
      rawImpliedProbabilities: Object.fromEntries(
        Object.keys(sourceProbs).map((k) => [k, sourceProbs[k]])
      ),
    };
  });

  const newState: AuctionState = {
    ...state,
    teams,
    oddsSource: action.sourceId,
  };

  // Recalculate probabilities and values with new odds
  if (state.config) {
    calculateImpliedProbabilities(newState.teams, state.config);
    recalculateValues(newState);
  }

  return newState;
}
```

**Step 4:** Import `calculateImpliedProbabilities` at top of file:
```typescript
import { calculateImpliedProbabilities } from '@/lib/calculations/odds';
```

### Task 2.7: Odds Source Selector UI Component

**Files:**
- Create: `v2/components/auction/odds-source-selector.tsx`

**Step 1:** Create the dropdown component:

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { OddsSource, OddsSourceRegistry, OddsSourceProbabilities } from '@/lib/tournaments/odds-sources';
import { useAuction } from '@/lib/auction/auction-context';
import { BarChart3, Globe, Loader2 } from 'lucide-react';

interface OddsSourceSelectorProps {
  registry: OddsSourceRegistry;
}

export function OddsSourceSelector({ registry }: OddsSourceSelectorProps) {
  const { state, dispatch } = useAuction();
  const [loading, setLoading] = useState<string | null>(null);
  const [remoteData, setRemoteData] = useState<Record<string, OddsSourceProbabilities>>({});
  const [error, setError] = useState<string | null>(null);

  const handleSourceChange = async (source: OddsSource) => {
    if (source.id === state.oddsSource) return;

    if (source.isRemote) {
      // Fetch from API if not already cached
      if (!remoteData[source.bookmakerKey ?? source.id]) {
        setLoading(source.id);
        setError(null);
        try {
          const res = await fetch('/api/odds/ncaab');
          if (!res.ok) throw new Error('Failed to fetch');
          const data: Record<string, OddsSourceProbabilities> = await res.json();
          setRemoteData(data);

          const bookData = data[source.bookmakerKey ?? ''];
          if (bookData) {
            dispatch({
              type: 'SET_ODDS_SOURCE',
              sourceId: source.id,
              probabilities: bookData.teams,
            });
          } else {
            setError(`No data available from ${source.name}`);
          }
        } catch {
          setError(`Could not load ${source.name} odds`);
        } finally {
          setLoading(null);
        }
        return;
      }

      // Use cached remote data
      const bookData = remoteData[source.bookmakerKey ?? ''];
      if (bookData) {
        dispatch({
          type: 'SET_ODDS_SOURCE',
          sourceId: source.id,
          probabilities: bookData.teams,
        });
      }
    } else {
      // Static source
      const staticData = registry.staticData[source.id];
      if (staticData) {
        dispatch({
          type: 'SET_ODDS_SOURCE',
          sourceId: source.id,
          probabilities: staticData.teams,
        });
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <BarChart3 className="size-3.5 text-white/30" />
      <span className="text-[10px] uppercase tracking-wider text-white/30">Odds:</span>
      <div className="flex gap-1">
        {registry.sources.map((source) => {
          const isActive = state.oddsSource === source.id;
          const isLoading = loading === source.id;
          const Icon = source.type === 'sportsbook' ? Globe : BarChart3;

          return (
            <button
              key={source.id}
              onClick={() => handleSourceChange(source)}
              disabled={isLoading}
              title={source.description}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                  : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60'
              }`}
            >
              {isLoading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Icon className="size-3" />
              )}
              {source.name}
            </button>
          );
        })}
      </div>
      {error && (
        <span className="text-[10px] text-red-400">{error}</span>
      )}
    </div>
  );
}
```

### Task 2.8: Wire Odds Source Selector into Strategy Tool

**Files:**
- Modify: `v2/components/auction/auction-tool.tsx`

**Step 1:** Import and add the selector. Find where the filter bar / toolbar is rendered. Add `OddsSourceSelector` to the top area of the strategy tool, below the header and above the team table.

```typescript
import { OddsSourceSelector } from './odds-source-selector';
import { buildMarchMadness2026Registry } from '@/lib/tournaments/odds-sources';
```

**Step 2:** Build the registry and pass it:

```typescript
// Inside the component, memoize the registry
const oddsRegistry = useMemo(
  () => buildMarchMadness2026Registry(),
  []
);

// In the JSX, add above the team table / filter bar:
<OddsSourceSelector registry={oddsRegistry} />
```

### Task 2.9: Write Tests for Devig Functions

**Files:**
- Create: `v2/lib/odds-api/__tests__/devig.test.ts`

**Step 1:** Write tests:

```typescript
import { describe, it, expect } from 'vitest';
import { devigOutrightMarket, devigBinaryMarket } from '../devig';

describe('devigOutrightMarket', () => {
  it('removes vig from a simple two-way market', () => {
    const result = devigOutrightMarket([
      { name: 'Team A', decimalOdds: 1.9 },
      { name: 'Team B', decimalOdds: 1.9 },
    ]);
    expect(result).toHaveLength(2);
    // Each should be ~50% after removing ~5.26% vig
    expect(result[0].fairProbability).toBeCloseTo(0.5, 2);
    expect(result[1].fairProbability).toBeCloseTo(0.5, 2);
    // Should sum to 1
    const total = result.reduce((s, r) => s + r.fairProbability, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('removes vig from outright futures market', () => {
    const result = devigOutrightMarket([
      { name: 'Favorite', decimalOdds: 3.0 },   // ~33% implied
      { name: 'Contender', decimalOdds: 5.0 },   // ~20% implied
      { name: 'Longshot', decimalOdds: 10.0 },   // ~10% implied
    ]);
    // Total implied = 0.333 + 0.2 + 0.1 = 0.633
    // Fair probs = 0.527, 0.316, 0.158
    expect(result[0].fairProbability).toBeCloseTo(0.527, 2);
    const total = result.reduce((s, r) => s + r.fairProbability, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('handles empty input', () => {
    expect(devigOutrightMarket([])).toEqual([]);
  });
});

describe('devigBinaryMarket', () => {
  it('devigs a YES/NO futures market', () => {
    // Arizona to reach S16: Yes 1.090, No 7.670 (from Pinnacle)
    const fair = devigBinaryMarket(1.090, 7.670);
    // Implied: Yes = 91.74%, No = 13.04%, Total = 104.78%
    // Fair Yes = 91.74 / 104.78 = 87.56%
    expect(fair).toBeCloseTo(0.8756, 2);
  });

  it('returns 0.5 for even odds', () => {
    const fair = devigBinaryMarket(1.95, 1.95);
    expect(fair).toBeCloseTo(0.5, 2);
  });
});
```

**Step 2:** Run `cd v2 && npm test -- --run lib/odds-api` — verify tests pass.

### Task 2.10: Build + Full Test

**Step 1:** Run `cd v2 && npm run build`
**Step 2:** Run `cd v2 && npm test`
**Step 3:** Fix any issues
**Step 4:** Manually verify: load /auction, see the odds source selector, toggle between sources, verify values change

---

## Workstream 3: Marketing Content

### Task 3.1: Draft Twitter Thread

Write a Twitter/X thread about Calcutta Edge. Template inspired by the Anthropic growth marketing thread — tell the builder story. Key angles:

1. **Hook**: "I built the only Calcutta auction platform that combines free hosting + paid strategy analytics"
2. **Problem**: Every March Madness, groups run Calcutta auctions on paper or spreadsheets. No real-time bidding. No odds-based strategy. No settlement tracking.
3. **What we built**: Free live auction hosting (real-time bidding, timers, auto-mode) + strategy tool with multiple odds sources (Evan Miya, TeamRankings, sportsbook odds)
4. **Tech stack story**: Built with Claude Code — Next.js, Supabase Realtime for live bidding, multi-source odds with devigging
5. **The edge**: "Compare what statistical models say vs. what the sportsbooks say. Find undervalued teams before the auction."
6. **CTA**: calcuttaedge.com — free to host, $29.99 for strategy

Save drafts to `v2/docs/marketing/twitter-thread-draft.md` for the user to review and post manually.

---

## Execution Strategy

WS1 (tournament management deploy) and WS2 (multi-odds) are independent and should run in parallel.

| Workstream | Priority | Est. Tasks | Dependencies |
|-----------|----------|-----------|-------------|
| WS1: Tournament Mgmt Deploy | CRITICAL | 3 tasks | Supabase migration |
| WS2: Multi-Odds Sources | HIGH | 10 tasks | None |
| WS3: Marketing | MEDIUM | 1 task | WS2 (needs feature to exist for screenshots) |

### Environment Variables Needed
- `ODDS_API_KEY` — already added to `.env.local`
- Must also add to Vercel environment variables before deploy

### Key Anti-Patterns to Avoid
- **DON'T** commit the API key or `.env.local`
- **DON'T** call The Odds API from the client — server-side only via API route
- **DON'T** skip devigging — raw sportsbook odds include 4-8% vig
- **DON'T** assume all 68 teams will have sportsbook odds — handle missing gracefully
- **DON'T** make sportsbook the default source — use Evan Miya (complete coverage) as default
